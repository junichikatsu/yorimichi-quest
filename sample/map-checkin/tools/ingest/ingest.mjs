#!/usr/bin/env node
/**
 * オープンデータ取込スクリプト（FR-10-2）。
 *
 * 4つの公開データを取得して正規化し、TypeScript のデータファイルを生成する。
 * **再実行可能**で、出典と取得日をスポットごとに保持する。
 *
 * ネットワークへ出るのはこのスクリプトだけである。関数側は生成済みのファイルを
 * 読むだけなので、デプロイ先から外部へ取りに行かない。
 *
 *   node tools/ingest/ingest.mjs                                    全件取り込む
 *   node tools/ingest/ingest.mjs --offline                           キャッシュだけで実行
 *   node tools/ingest/ingest.mjs --center 35.669,139.753 --radius 1200
 *   node tools/ingest/ingest.mjs --cap aed=60
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SOURCES, TARGET_WARDS, TOKYO_BBOX } from './sources.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const CACHE = join(HERE, '.cache')
const OUT = join(ROOT, 'apps/function/src/data/opendata-spots.ts')

/* ------------------------------------------------------------------ *
 * 引数
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = { offline: false, center: undefined, radiusM: undefined, caps: new Map(), out: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--offline') {
      opts.offline = true
    } else if (a === '--center') {
      const [lat, lng] = (argv[++i] ?? '').split(',').map(Number)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('--center は lat,lng で指定する')
      opts.center = { lat, lng }
    } else if (a === '--radius') {
      opts.radiusM = Number(argv[++i])
      if (!Number.isFinite(opts.radiusM)) throw new Error('--radius は数値で指定する')
    } else if (a === '--cap') {
      const [key, n] = (argv[++i] ?? '').split('=')
      opts.caps.set(key, Number(n))
    } else if (a === '--out') {
      opts.out = resolve(argv[++i])
    } else {
      throw new Error(`不明な引数: ${a}`)
    }
  }
  if (opts.radiusM !== undefined && opts.center === undefined) {
    throw new Error('--radius は --center と一緒に指定する')
  }
  return opts
}

/* ------------------------------------------------------------------ *
 * 取得
 * ------------------------------------------------------------------ */

async function fetchBytes(source, offline) {
  const path = join(CACHE, `${source.key}.bin`)
  if (offline) {
    return { bytes: await readFile(path), cached: true }
  }
  const res = await fetch(source.url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${source.key}: HTTP ${res.status} ${source.url}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  await mkdir(CACHE, { recursive: true })
  await writeFile(path, bytes)
  return { bytes, cached: false }
}

/**
 * 文字コードは推測しない。出典ごとに定義しておく（sources.mjs）。
 * 実測で避難所と給水が CP932、千代田区が UTF-8 BOM 付きだった。
 */
function decode(bytes, encoding) {
  const text = new TextDecoder(encoding, { fatal: false }).decode(bytes)
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

/** 引用符と改行を含むセルを扱う最小限の CSV パーサ */
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\r') {
      // 無視して \n 側で行を確定する
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function toRecords(rows, headerMatch) {
  const headerIndex = rows.findIndex((r) => r.some((c) => c.includes(headerMatch)))
  if (headerIndex < 0) throw new Error(`ヘッダ行が見つからない（${headerMatch}）`)
  const header = rows[headerIndex]
  const out = []
  for (const r of rows.slice(headerIndex + 1)) {
    if (!r.some((c) => c.trim() !== '')) continue
    const rec = {}
    header.forEach((h, i) => {
      rec[h] = r[i] ?? ''
    })
    out.push(rec)
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 正規化
 * ------------------------------------------------------------------ */

const num = (v) => Number.parseFloat(String(v ?? '').trim())

function inBbox(lat, lng) {
  return (
    lat >= TOKYO_BBOX.minLat &&
    lat <= TOKYO_BBOX.maxLat &&
    lng >= TOKYO_BBOX.minLng &&
    lng <= TOKYO_BBOX.maxLng
  )
}

function distanceM(a, b) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * スポットIDは出典・名称・座標から作る。
 *
 * 連番にすると、上流の行順が変わるだけで別のスポットになってしまう。
 * 場所カード（FR-14）の達成記録がIDに紐づくため、IDが動くと収集済みが消える。
 */
function spotIdFor(sourceKey, name, lat, lng) {
  const h = createHash('sha1').update(`${sourceKey}|${name}|${lat}|${lng}`).digest('hex').slice(0, 10)
  return `${sourceKey}-${h}`
}

function normalize(source, records) {
  const stats = { total: records.length, outOfWard: 0, skipped: 0, badCoords: 0, kept: 0 }
  const spots = []
  for (const row of records) {
    if (source.skip?.(row)) {
      stats.skipped += 1
      continue
    }
    const ward = (source.ward(row) ?? '').trim()
    if (!TARGET_WARDS.includes(ward)) {
      stats.outOfWard += 1
      continue
    }
    const lat = num(source.lat ? source.lat(row) : row.__lat)
    const lng = num(source.lng ? source.lng(row) : row.__lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBbox(lat, lng)) {
      stats.badCoords += 1
      continue
    }
    const name = (source.name(row) ?? '').replace(/\s+/g, ' ').trim()
    if (name === '') {
      stats.badCoords += 1
      continue
    }
    spots.push({
      spotId: spotIdFor(source.key, name, lat, lng),
      name,
      category: source.category,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      address: (source.address(row) ?? '').replace(/\s+/g, ' ').trim(),
      attributes: source.attributes(row).filter((a) => a !== ''),
      ward,
      source: source.key,
    })
    stats.kept += 1
  }
  return { spots, stats }
}

function geojsonRecords(text) {
  const g = JSON.parse(text)
  return (g.features ?? []).map((f) => ({
    ...f.properties,
    __lat: f.geometry?.coordinates?.[1],
    __lng: f.geometry?.coordinates?.[0],
  }))
}

/* ------------------------------------------------------------------ *
 * 出力
 * ------------------------------------------------------------------ */

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function emit(spots, manifest) {
  const L = []
  L.push('/**')
  L.push(' * ★ 自動生成ファイル。手で編集しないこと。')
  L.push(' *')
  L.push(' * 生成元: tools/ingest/ingest.mjs（FR-10-2）／再生成: pnpm ingest')
  L.push(' *')
  L.push(' * 対象エリアは千代田区・港区（#6 決着）。両区を1つのパーティションへ入れる。')
  L.push(' * ★ 空欄の属性は「設備が無い」ではなく「未記入」である。')
  L.push(' *   記入済みの値だけを attributes に入れており、空欄は何も足していない。')
  L.push(' *   この空欄そのものがクエストの対象になる（FR-12）。')
  L.push(' *')
  L.push(' * 出典')
  for (const m of manifest.sources) {
    L.push(` * - ${m.title}`)
    L.push(` *   ${m.url}`)
    L.push(` *   取得日 ${m.fetchedAt}／採用 ${m.kept} 件`)
  }
  L.push(' */')
  L.push("import { asSpotId, type AreaId, type Spot, type SpotCategory } from '@map-checkin/shared'")
  L.push('')
  L.push('interface OpenDataSeed {')
  L.push('  id: string')
  L.push('  name: string')
  L.push('  category: SpotCategory')
  L.push('  lat: number')
  L.push('  lng: number')
  L.push('  address: string')
  L.push('  attributes: string[]')
  L.push('  /** 出典キー。取得日は OPENDATA_SOURCES から引く */')
  L.push('  source: string')
  L.push('}')
  L.push('')
  L.push('export interface OpenDataSource {')
  L.push('  key: string')
  L.push('  title: string')
  L.push('  url: string')
  L.push('  fetchedAt: string')
  L.push('  count: number')
  L.push('}')
  L.push('')
  L.push('/** 出典と取得日（FR-10-2）。画面のクレジット表示にも使う */')
  L.push('export const OPENDATA_SOURCES: readonly OpenDataSource[] = [')
  for (const m of manifest.sources) {
    L.push(
      `  { key: ${q(m.key)}, title: ${q(m.title)}, url: ${q(m.url)}, fetchedAt: ${q(m.fetchedAt)}, count: ${m.kept} },`,
    )
  }
  L.push(']')
  L.push('')
  L.push('/** 生成時点の件数。取り込み漏れに気づけるように残す */')
  L.push(`export const OPENDATA_SPOT_COUNT = ${spots.length}`)
  L.push('')
  L.push('const SEEDS: readonly OpenDataSeed[] = [')
  for (const s of spots) {
    const attrs = s.attributes.map(q).join(', ')
    L.push(
      `  { id: ${q(s.spotId)}, name: ${q(s.name)}, category: ${q(s.category)}, lat: ${s.lat}, lng: ${s.lng}, address: ${q(s.address)}, attributes: [${attrs}], source: ${q(s.source)} },`,
    )
  }
  L.push(']')
  L.push('')
  L.push('/**')
  L.push(' * 取り込んだ実データ。')
  L.push(' *')
  L.push(' * areaId は引数で受ける。千代田区・港区を1つのパーティションに入れる方針のため、')
  L.push(' * 区ごとに固定せず設定（AREA_ID）に従わせる。')
  L.push(' */')
  L.push('export function opendataSpots(areaId: AreaId, updatedAt: string): Spot[] {')
  L.push('  const fetchedAtOf = new Map(OPENDATA_SOURCES.map((s) => [s.key, s.fetchedAt]))')
  L.push('  return SEEDS.map((seed) => ({')
  L.push('    spotId: asSpotId(seed.id),')
  L.push('    areaId,')
  L.push('    name: seed.name,')
  L.push('    category: seed.category,')
  L.push('    lat: seed.lat,')
  L.push('    lng: seed.lng,')
  L.push('    address: seed.address,')
  L.push('    attributes: seed.attributes,')
  L.push('    source: seed.source,')
  L.push("    fetchedAt: fetchedAtOf.get(seed.source) ?? '',")
  L.push('    checkinCount: 0,')
  L.push('    updatedAt,')
  L.push('  }))')
  L.push('}')
  L.push('')
  return L.join('\n')
}

/* ------------------------------------------------------------------ *
 * 本体
 * ------------------------------------------------------------------ */

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const today = new Date().toISOString().slice(0, 10)
  const manifest = { sources: [] }
  let all = []

  for (const source of SOURCES) {
    const { bytes, cached } = await fetchBytes(source, opts.offline)
    const text = decode(bytes, source.encoding)
    const records =
      source.kind === 'geojson' ? geojsonRecords(text) : toRecords(parseCsv(text), source.headerMatch)
    const { spots, stats } = normalize(source, records)
    all.push(...spots)
    manifest.sources.push({
      key: source.key,
      title: source.title,
      url: source.url,
      fetchedAt: today,
      kept: stats.kept,
    })
    console.log(
      `${source.key.padEnd(8)} ${String(bytes.length).padStart(9)}B ${cached ? '(cache)' : '(fetch)'}  ` +
        `行=${String(stats.total).padStart(6)} 採用=${String(stats.kept).padStart(4)} ` +
        `対象外区=${stats.outOfWard} 停止=${stats.skipped} 座標不正=${stats.badCoords}`,
    )
  }

  // 重複IDの確認。同一出典で同名・同座標が二重に載っている場合に気づけるようにする
  const seen = new Map()
  let duplicates = 0
  for (const s of all) {
    if (seen.has(s.spotId)) duplicates += 1
    else seen.set(s.spotId, s)
  }
  if (duplicates > 0) console.log(`\n重複を除外: ${duplicates} 件（同一出典・同名・同座標）`)
  all = [...seen.values()]

  // 撮影ルートに合わせた絞り込み（FR-10-5）
  if (opts.center) {
    const before = all.length
    all = all.filter((s) => distanceM(opts.center, s) <= opts.radiusM)
    console.log(
      `\n中心 ${opts.center.lat},${opts.center.lng} 半径 ${opts.radiusM}m で絞り込み: ${before} → ${all.length} 件`,
    )
  }

  // カテゴリ上限（FR-10-4）。落とした件数は必ず出す
  for (const [category, limit] of opts.caps) {
    const target = all.filter((s) => s.category === category)
    if (target.length <= limit) continue
    const sorted = opts.center
      ? [...target].sort((a, b) => distanceM(opts.center, a) - distanceM(opts.center, b))
      : target
    const keep = new Set(sorted.slice(0, limit).map((s) => s.spotId))
    all = all.filter((s) => s.category !== category || keep.has(s.spotId))
    console.log(
      `${category} を ${target.length} → ${limit} 件に制限（${target.length - limit} 件を除外` +
        `${opts.center ? '／中心から近い順に採用' : ''}）`,
    )
  }

  all.sort((a, b) => a.spotId.localeCompare(b.spotId))

  const byCategory = {}
  const byWard = {}
  for (const s of all) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + 1
    byWard[s.ward] = (byWard[s.ward] ?? 0) + 1
  }

  const out = opts.out ?? OUT
  await writeFile(out, emit(all, manifest), 'utf-8')

  console.log(`\n合計 ${all.length} 件`)
  console.log('カテゴリ別:', byCategory)
  console.log('区別      :', byWard)
  console.log(`出力      : ${out}`)
  if (all.length > 200) {
    console.log(
      '\n⚠ 200 件（MAX_SPOTS_PER_REQUEST の既定）を超えている。' +
        '\n  --center と --radius、または --cap aed=N で撮影ルート周辺に絞ること（FR-10-4）。',
    )
  }
}

main().catch((e) => {
  console.error(String(e?.stack ?? e))
  process.exit(1)
})
