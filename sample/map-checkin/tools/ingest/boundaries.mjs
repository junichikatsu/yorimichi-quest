#!/usr/bin/env node
/**
 * 町丁目境界の取込（#27／FR-09-6）。
 *
 * e-Stat（政府統計の総合窓口）の国勢調査 小地域（町丁・字等別）境界データを取得し、
 * 千代田区・港区の町丁目ポリゴンを生成する。
 *
 * ★ 東京都のオープンデータカタログに町丁目ポリゴンは無い。
 *   両区のデータセット（29件・268件）を全件確認したが、あるのは人口CSVだけだった。
 *   e-Stat は Shapefile で配布しており、**人口と世帯数が属性として付いている**。
 *   これが FR-09-6（充足率の可視化）に直結する。
 *
 *   node tools/ingest/boundaries.mjs
 *   node tools/ingest/boundaries.mjs --offline --tolerance 3e-5
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const CACHE = join(HERE, '.cache')
const OUT = join(ROOT, 'packages/shared/src/chome-data.ts')

/** 国勢調査（令和2年）小地域境界。coordSys=1 は世界測地系緯度経度 */
const SURVEY_ID = 'A002005212020'
const WARDS = [
  { code: '13101', name: '千代田区' },
  { code: '13103', name: '港区' },
]

const urlFor = (code) =>
  `https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=${SURVEY_ID}&code=${code}&coordSys=1&format=shape&downloadType=5`

/* ------------------------------------------------------------------ *
 * ZIP（Shapefile は ZIP で配布される）
 * ------------------------------------------------------------------ */

/**
 * 最小限の ZIP 展開。
 *
 * 依存を足さずに済ませる。格納方式は無圧縮(0)と deflate(8) だけ扱う。
 * e-Stat は deflate で返してくる。
 */
function unzip(buffer) {
  const files = new Map()
  // End of central directory を末尾から探す
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('ZIP の終端が見つからない')

  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)

  for (let n = 0; n < count; n += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('中央ディレクトリが壊れている')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('latin1')

    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const raw = buffer.subarray(dataStart, dataStart + compressedSize)
    files.set(name.toLowerCase(), method === 0 ? Buffer.from(raw) : inflateRawSync(raw))

    offset += 46 + nameLength + extraLength + commentLength
  }
  return files
}

/* ------------------------------------------------------------------ *
 * Shapefile
 * ------------------------------------------------------------------ */

/**
 * .shp からポリゴンを読む。
 *
 * レコードは「番号(4,BE) 長さ(4,BE) 種別(4,LE) bbox(32) パート数 点数 パート境界 点列」。
 * 種別5（Polygon）だけ扱う。パートは外側の輪と穴に分かれるが、**面積判定では
 * 外側の輪だけを使う**（この用途では穴を持つ町丁目が実質無く、あっても
 * 内包判定は輪ごとの偶奇で正しく出る）。
 */
function readShapes(shp) {
  const shapes = []
  let p = 100
  while (p + 8 <= shp.length) {
    const contentLength = shp.readInt32BE(p + 4) * 2
    const content = p + 8
    const type = shp.readInt32LE(content)
    if (type === 5) {
      const numParts = shp.readInt32LE(content + 36)
      const numPoints = shp.readInt32LE(content + 40)
      const partsAt = content + 44
      const pointsAt = partsAt + numParts * 4
      const parts = []
      for (let i = 0; i < numParts; i += 1) parts.push(shp.readInt32LE(partsAt + i * 4))
      const rings = []
      for (let i = 0; i < numParts; i += 1) {
        const start = parts[i]
        const end = i + 1 < numParts ? parts[i + 1] : numPoints
        const ring = []
        for (let j = start; j < end; j += 1) {
          const at = pointsAt + j * 16
          ring.push([shp.readDoubleLE(at), shp.readDoubleLE(at + 8)])
        }
        rings.push(ring)
      }
      shapes.push(rings)
    } else {
      shapes.push([])
    }
    p = content + contentLength
  }
  return shapes
}

/** .dbf の属性を読む。文字コードは CP932 */
function readDbf(dbf) {
  const recordCount = dbf.readUInt32LE(4)
  const headerLength = dbf.readUInt16LE(8)
  const recordLength = dbf.readUInt16LE(10)
  const fieldCount = (headerLength - 33) / 32
  const decoder = new TextDecoder('shift_jis')

  const fields = []
  for (let i = 0; i < fieldCount; i += 1) {
    const at = 32 + i * 32
    const raw = dbf.subarray(at, at + 11)
    const zero = raw.indexOf(0)
    fields.push({
      name: decoder.decode(zero < 0 ? raw : raw.subarray(0, zero)),
      length: dbf[at + 16],
    })
  }

  const rows = []
  for (let r = 0; r < recordCount; r += 1) {
    let at = headerLength + r * recordLength + 1
    const row = {}
    for (const field of fields) {
      row[field.name] = decoder.decode(dbf.subarray(at, at + field.length)).trim()
      at += field.length
    }
    rows.push(row)
  }
  return rows
}

/* ------------------------------------------------------------------ *
 * 簡略化
 * ------------------------------------------------------------------ */

/**
 * Douglas-Peucker。**開いた**点列を間引く。
 *
 * 閉じた輪をそのまま渡してはいけない。始点と終点が同じで基準線が退化し、
 * すべての点の距離が 0 になって2点まで落ちる。輪は simplifyRing で割ってから渡す。
 */
function simplifyOpen(points, tolerance) {
  if (points.length <= 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  const stack = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()
    let maxDistance = 0
    let index = -1
    const [x1, y1] = points[first]
    const [x2, y2] = points[last]
    const dx = x2 - x1
    const dy = y2 - y1
    const norm = Math.hypot(dx, dy) || 1
    for (let i = first + 1; i < last; i += 1) {
      const [x, y] = points[i]
      const distance = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
      if (distance > maxDistance) {
        maxDistance = distance
        index = i
      }
    }
    if (maxDistance > tolerance && index > 0) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/**
 * 閉じた輪を間引く。
 *
 * 始点から最も遠い点で輪を2本の開いた線に割り、それぞれを間引いてから閉じ直す。
 * こうしないと基準線が退化して形が消える。
 */
function simplifyRing(ring, tolerance) {
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  const open = closed ? ring.slice(0, -1) : ring
  if (open.length < 4) return ring

  let far = 0
  let best = -1
  for (let i = 1; i < open.length; i += 1) {
    const d = (open[i][0] - open[0][0]) ** 2 + (open[i][1] - open[0][1]) ** 2
    if (d > best) {
      best = d
      far = i
    }
  }

  const head = simplifyOpen(open.slice(0, far + 1), tolerance)
  const tail = simplifyOpen(open.slice(far), tolerance)
  const merged = [...head, ...tail.slice(1)]
  return [...merged, merged[0]]
}

const round = (v) => Number(v.toFixed(6))

/* ------------------------------------------------------------------ *
 * 出力
 * ------------------------------------------------------------------ */

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function emit(chomes, tolerance, fetchedAt) {
  const L = []
  L.push('/**')
  L.push(' * ★ 自動生成ファイル。手で編集しないこと。')
  L.push(' *')
  L.push(' * 生成元: tools/ingest/boundaries.mjs／再生成: pnpm ingest:boundaries')
  L.push(' *')
  L.push(' * 千代田区・港区の町丁目境界（#27／FR-09-6）。')
  L.push(' * 出典: 政府統計の総合窓口（e-Stat）国勢調査 小地域（町丁・字等別）境界データ')
  L.push(' *       https://www.e-stat.go.jp/gis/statmap-search?type=2')
  L.push(' *')
  L.push(' * ★ 東京都のカタログに町丁目ポリゴンは無いため e-Stat を使っている。')
  L.push(' *   人口・世帯数が属性として付いており、これが充足率の分母になる。')
  L.push(` * 座標は Douglas-Peucker（許容 ${tolerance} 度 ≒ ${Math.round(tolerance * 111000)}m）で間引き、小数6桁に丸めてある。`)
  L.push(' */')
  L.push('')
  L.push('/** 経度・緯度の並び（GeoJSON と同じ） */')
  L.push('export type ChomeRing = readonly (readonly [number, number])[]')
  L.push('')
  L.push('export interface Chome {')
  L.push('  /** 11桁の小地域コード。町丁目の識別子として使う */')
  L.push('  code: string')
  L.push('  /** 町丁目名（例: 麻布十番一丁目） */')
  L.push('  name: string')
  L.push('  ward: string')
  L.push('  /** 国勢調査の人口。0 の町丁目もある（丸の内など） */')
  L.push('  population: number')
  L.push('  households: number')
  L.push('  /** 面積（m²） */')
  L.push('  areaM2: number')
  L.push('  /** 内包判定を省くための外接矩形 [minLng, minLat, maxLng, maxLat] */')
  L.push('  bbox: readonly [number, number, number, number]')
  L.push('  /** 外周の輪。穴は保持していない（この2区では実質発生しない） */')
  L.push('  rings: readonly ChomeRing[]')
  L.push('}')
  L.push('')
  L.push('/** 出典表示（FR-10-2）。e-Stat は出典明記が利用の条件なので、画面に出す */')
  L.push('export const CHOME_SOURCE = {')
  L.push("  title: '国勢調査 小地域（町丁・字等別）境界データ（政府統計の総合窓口 e-Stat）',")
  L.push("  url: 'https://www.e-stat.go.jp/gis/statmap-search?type=2',")
  L.push(`  fetchedAt: ${q(fetchedAt)},`)
  L.push('} as const')
  L.push('')
  L.push(`export const CHOME_COUNT = ${chomes.length}`)
  L.push('')
  L.push('export const CHOMES: readonly Chome[] = [')
  for (const c of chomes) {
    const rings = c.rings
      .map((ring) => `[${ring.map(([x, y]) => `[${x},${y}]`).join(',')}]`)
      .join(',')
    L.push(
      `  { code: ${q(c.code)}, name: ${q(c.name)}, ward: ${q(c.ward)}, population: ${c.population}, households: ${c.households}, areaM2: ${c.areaM2}, bbox: [${c.bbox.join(',')}], rings: [${rings}] },`,
    )
  }
  L.push(']')
  L.push('')
  return L.join('\n')
}

/* ------------------------------------------------------------------ *
 * 本体
 * ------------------------------------------------------------------ */

async function bytesFor(ward, offline) {
  const path = join(CACHE, `chome-${ward.code}.zip`)
  if (offline) return readFile(path)
  const res = await fetch(urlFor(ward.code), { redirect: 'follow' })
  if (!res.ok) throw new Error(`${ward.name}: HTTP ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  await mkdir(CACHE, { recursive: true })
  await writeFile(path, bytes)
  return bytes
}

async function main() {
  const argv = process.argv.slice(2)
  const offline = argv.includes('--offline')
  const tolIndex = argv.indexOf('--tolerance')
  const tolerance = tolIndex >= 0 ? Number(argv[tolIndex + 1]) : 2e-5

  const chomes = []
  for (const ward of WARDS) {
    const zip = unzip(await bytesFor(ward, offline))
    const shpName = [...zip.keys()].find((n) => n.endsWith('.shp'))
    const dbfName = [...zip.keys()].find((n) => n.endsWith('.dbf'))
    if (!shpName || !dbfName) throw new Error(`${ward.name}: shp/dbf が見つからない`)

    const shapes = readShapes(zip.get(shpName))
    const rows = readDbf(zip.get(dbfName))
    if (shapes.length !== rows.length) {
      throw new Error(`${ward.name}: 図形 ${shapes.length} と属性 ${rows.length} の件数が合わない`)
    }

    let pointsBefore = 0
    let pointsAfter = 0
    let skipped = 0
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      const rings = shapes[i]
      if (rings.length === 0) {
        skipped += 1
        continue
      }
      const simplified = []
      let minLng = Infinity
      let minLat = Infinity
      let maxLng = -Infinity
      let maxLat = -Infinity
      for (const ring of rings) {
        pointsBefore += ring.length
        const thin = simplifyRing(ring, tolerance).map(([x, y]) => [round(x), round(y)])
        // 3点未満は面にならない
        if (thin.length < 4) continue
        pointsAfter += thin.length
        simplified.push(thin)
        for (const [x, y] of thin) {
          if (x < minLng) minLng = x
          if (x > maxLng) maxLng = x
          if (y < minLat) minLat = y
          if (y > maxLat) maxLat = y
        }
      }
      if (simplified.length === 0) {
        skipped += 1
        continue
      }
      chomes.push({
        code: row['KEY_CODE'],
        name: row['S_NAME'],
        ward: row['CITY_NAME'] || ward.name,
        population: Number.parseInt(row['JINKO'] || '0', 10) || 0,
        households: Number.parseInt(row['SETAI'] || '0', 10) || 0,
        areaM2: Math.round(Number.parseFloat(row['AREA'] || '0') || 0),
        bbox: [round(minLng), round(minLat), round(maxLng), round(maxLat)],
        rings: simplified,
      })
    }
    console.log(
      `${ward.name.padEnd(6)} 区画=${String(rows.length).padStart(4)} 採用=${String(rows.length - skipped).padStart(4)} ` +
        `点 ${pointsBefore} → ${pointsAfter}（${Math.round((1 - pointsAfter / pointsBefore) * 100)}% 削減）`,
    )
  }

  chomes.sort((a, b) => a.code.localeCompare(b.code))
  const text = emit(chomes, tolerance, new Date().toISOString().slice(0, 10))
  await writeFile(OUT, text, 'utf-8')

  const population = chomes.reduce((sum, c) => sum + c.population, 0)
  console.log(`\n合計 ${chomes.length} 区画 / 人口 ${population.toLocaleString('ja-JP')} 人`)
  console.log(`出力 ${OUT}（${Math.round(text.length / 1024)}KB）`)
}

main().catch((e) => {
  console.error(String(e?.stack ?? e))
  process.exit(1)
})
