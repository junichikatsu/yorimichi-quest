/**
 * 町丁目ごとの浸水想定を取り込む（#72 の判定をサーバー側へ）。
 *
 *   pnpm ingest:hazard
 *
 * ★ **判定のコードを写さない。** 浸水深の凡例と色の許容幅は
 * `apps/web/src/hazard.ts` にあり、そこには「色は実際のタイルから読み出して
 * 確かめている。覚えている値を書き写してはいけない」と書いてある。
 * ここでは**その実装をそのまま呼ぶ**。写すと、表示と取り込みで別の深さを言い出す。
 *
 * ★ なぜサーバー側に要るか：いまハザードはブラウザがタイルの画素を読んでいるだけで、
 * **サーバーは浸水想定を1件も持っていない。** そのためナレッジ（#75）に町丁目の層が
 * 作れず、「ここは浸水想定区域なので垂直避難向き」といった**その場所でしか言えない
 * こと**が出せない。FR-04-4（避難シミュレーションクイズ）の前提でもある。
 *
 * ★ 出力は生成物ファイル。`opendata-spots.ts`・`chome-data.ts` と同じ扱いである。
 */

import { inflateSync } from 'node:zlib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CHOMES, pointInChome, type Chome } from '@imanouchi/shared'
import {
  classifyPixel,
  DEPTH_LEGEND,
  hazardTileUrl,
  HAZARD_LAYERS,
  HAZARD_SAMPLE_ZOOM,
  tilePointOf,
  worseSample,
  type HazardSample,
} from '../../apps/web/src/hazard.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
/*
 * ★ **サーバー側に置く**（`packages/shared` ではなく）。shared はフロントエンドの
 * バンドルにそのまま入るが、**画面側はこのデータを使わない**（地図はタイルの
 * 画素を直接読む）。1件も使わない 69KB を端末へ送る理由がない。
 */
const OUT = join(ROOT, 'apps/function/src/data/chome-hazard.ts')
const CACHE = join(ROOT, 'tools/ingest/.cache/hazard')

const TODAY = new Date().toISOString().slice(0, 10)

/**
 * 標本の間隔（m）。
 *
 * ★ z16 で 1px ≒ 2.4m なので、25m は画素 10 個ぶんに相当する。これより細かくしても
 * 元データの精度は上がらず、標本の数だけが増える。逆に粗くすると、**細い川沿いの
 * 区域を丸ごと見落とす。**
 */
const SAMPLE_STEP_M = 25

/* ------------------------------------------------------------------ *
 * PNG の読み取り
 * ------------------------------------------------------------------ */

/**
 * 8bit RGBA・非インターレースの PNG を画素へ直す。
 *
 * ★ 依存を足さずに済ませている。対象のタイルは 256x256・colorType 6・
 * interlace 0 に固定されており（2026-08-30 に確認）、**その形だけを読む。**
 * 想定と違う形が来たら例外にする。黙って別の解釈をすると、**色が化けたまま
 * 浸水深を判定する**ことになる。
 */
function decodePng(bytes: Buffer): { width: number; height: number; data: Buffer } {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error('PNG ではありません')

  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const bitDepth = bytes[24]
  const colorType = bytes[25]
  const interlace = bytes[28]

  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`想定外の PNG（bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}）`)
  }

  // IDAT をつなぐ。分割されていることがある
  const idat: Buffer[] = []
  let offset = 8
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + length))
    if (type === 'IEND') break
    offset += 12 + length
  }

  const raw = inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = width * bpp
  const data = Buffer.alloc(height * stride)

  /*
   * ★ フィルタを解く。行ごとに先頭 1 バイトが種類で、直前の画素（a）と
   * 真上の画素（b）と左上（c）を使って戻す。**ここを間違えると絵は出るが色がずれる。**
   */
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)]
    const src = row * (stride + 1) + 1
    const dst = row * stride

    for (let i = 0; i < stride; i += 1) {
      const x = raw[src + i]!
      const a = i >= bpp ? data[dst + i - bpp]! : 0
      const b = row > 0 ? data[dst - stride + i]! : 0
      const c = row > 0 && i >= bpp ? data[dst - stride + i - bpp]! : 0

      let value: number
      switch (filter) {
        case 0:
          value = x
          break
        case 1:
          value = x + a
          break
        case 2:
          value = x + b
          break
        case 3:
          value = x + ((a + b) >> 1)
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          value = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default:
          throw new Error(`未知のフィルタ ${String(filter)}`)
      }
      data[dst + i] = value & 0xff
    }
  }

  return { width, height, data }
}

/* ------------------------------------------------------------------ *
 * タイルの取得
 * ------------------------------------------------------------------ */

type Tile = { data: Buffer } | 'outside'

const tiles = new Map<string, Tile>()

/**
 * タイルを1枚取る。**404 は区域外である**（エラーではない）。
 *
 * ★ ディスクへ残す。取り込みをやり直すたびに国土地理院へ取りに行くのは
 * 失礼だし遅い。`.cache/` は .gitignore の対象である。
 */
async function fetchTile(path: string, z: number, x: number, y: number): Promise<Tile> {
  const key = `${path}/${z}/${x}/${y}`
  const cached = tiles.get(key)
  if (cached) return cached

  const file = join(CACHE, path, String(z), String(x), `${y}.png`)
  const miss = join(CACHE, path, String(z), String(x), `${y}.404`)

  let tile: Tile
  try {
    tile = { data: await readFile(file) }
  } catch {
    try {
      await readFile(miss)
      tile = 'outside'
    } catch {
      const layer = HAZARD_LAYERS.find((entry) => entry.path === path)!
      const response = await fetch(hazardTileUrl(layer, z, x, y))

      if (response.status === 404) {
        await mkdir(dirname(miss), { recursive: true })
        await writeFile(miss, '')
        tile = 'outside'
      } else if (!response.ok) {
        throw new Error(`タイルの取得に失敗 ${key}: ${response.status}`)
      } else {
        const bytes = Buffer.from(await response.arrayBuffer())
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, bytes)
        tile = { data: bytes }
      }
    }
  }

  tiles.set(key, tile)
  return tile
}

async function sampleAt(path: string, lat: number, lng: number): Promise<HazardSample> {
  const point = tilePointOf(lat, lng, HAZARD_SAMPLE_ZOOM)
  const tile = await fetchTile(path, point.z, point.x, point.y)
  if (tile === 'outside') return { inside: false }

  const { data } = decodePng(tile.data)
  const index = (point.py * 256 + point.px) * 4
  return classifyPixel(data[index]!, data[index + 1]!, data[index + 2]!, data[index + 3]!)
}

/* ------------------------------------------------------------------ *
 * 町丁目ごとの集計
 * ------------------------------------------------------------------ */

interface LayerResult {
  id: string
  label: string
  /** 区域内だった標本の割合（0〜1・小数3桁） */
  ratio: number
  /** いちばん深い区分。分からなければ undefined */
  worstDepth: string | undefined
}

interface ChomeHazardResult {
  code: string
  samples: number
  layers: LayerResult[]
}

/** 町丁目の中に標本点を格子状に置く。**外に出た点は使わない** */
function samplePoints(chome: Chome): { lat: number; lng: number }[] {
  const [minLng, minLat, maxLng, maxLat] = chome.bbox
  // 緯度1度 ≒ 111km。経度は緯度によって縮む
  const stepLat = SAMPLE_STEP_M / 111_000
  const stepLng = stepLat / Math.cos(((minLat + maxLat) / 2 / 180) * Math.PI)

  const points: { lat: number; lng: number }[] = []
  for (let lat = minLat; lat <= maxLat; lat += stepLat) {
    for (let lng = minLng; lng <= maxLng; lng += stepLng) {
      if (pointInChome(chome, lat, lng)) points.push({ lat, lng })
    }
  }

  /*
   * ★ 1点も入らないことがある（細長い区画で格子が全部すり抜ける）。
   * そのときは重心を1点だけ使う。**0 標本で「区域外」と言い切らない。**
   */
  if (points.length === 0) {
    points.push({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 })
  }

  return points
}

async function analyze(chome: Chome): Promise<ChomeHazardResult> {
  const points = samplePoints(chome)
  const layers: LayerResult[] = []

  for (const layer of HAZARD_LAYERS) {
    let inside = 0
    let worst: HazardSample = { inside: false }

    for (const point of points) {
      const sample = await sampleAt(layer.path, point.lat, point.lng)
      if (sample.inside) {
        inside += 1
        worst = worseSample(worst, sample)
      }
    }

    // ★ 1点も入らなかった層は載せない。**「区域が無い」と「深さ不明」は違う**
    if (inside === 0) continue

    layers.push({
      id: layer.id,
      label: layer.label,
      ratio: Math.round((inside / points.length) * 1000) / 1000,
      worstDepth: worst.inside ? worst.depth : undefined,
    })
  }

  return { code: chome.code, samples: points.length, layers }
}

/* ------------------------------------------------------------------ *
 * ハザードの型（プロファイル）
 * ------------------------------------------------------------------ */

/**
 * 町丁目を**避難行動が変わる境目**でまとめる。
 *
 * ★ 249 区画それぞれにナレッジを作ると、**防災士が読み切れない。** かといって
 * 全部を「浸水想定区域」と一括りにすると、垂直避難でよいのか立ち退くべきなのかが
 * 言えなくなる。**行動が変わるところだけで割る。**
 *
 * ★ 深さの3段は、建物の階と対応させてある：
 *   浅（0.5m未満）  足首程度。屋内に留まれる
 *   中（0.5〜3m）   1階が水没しうる。上の階へ
 *   深（3m以上）    2階でも危ない。区域の外へ立ち退く
 * この境目は浸水想定区域図の一般的な読み方に沿っている。**独自の危険度ではない。**
 *
 * ★ 層の組み合わせ（洪水／高潮／両方）も分ける。**同じ深さでも、川からの水と
 * 海からの水では、いつ・どこから来るかが違う。**
 */
type DepthBucket = 'shallow' | 'mid' | 'deep' | 'unknown'

const DEPTH_BUCKET_LABELS: Record<DepthBucket, string> = {
  shallow: '0.5m未満',
  mid: '0.5〜3m未満',
  deep: '3m以上',
  unknown: '深さ不明',
}

/** 深さの区分を3段へ畳む。**凡例の並び（深い順）を使う**ので、文言を写していない */
function bucketOf(depth: string | undefined): DepthBucket {
  if (depth === undefined) return 'unknown'
  const index = DEPTH_LEGEND.findIndex((entry) => entry.label === depth)
  if (index < 0) return 'unknown'
  // DEPTH_LEGEND は深い順。0〜3 が 3m以上、4 が 0.5〜3m、5 が 0.5m未満
  if (index <= 3) return 'deep'
  if (index === 4) return 'mid'
  return 'shallow'
}

interface Profile {
  id: string
  label: string
  /** 層のID（'flood' | 'hightide'）を並べたもの */
  layers: string[]
  depthBucket: DepthBucket
  depthLabel: string
  /** この型に属する町丁目の数。レビューのときに重みが分かる */
  chomeCount: number
}

function profileOf(result: ChomeHazardResult): { id: string; layers: string[]; bucket: DepthBucket } | undefined {
  if (result.layers.length === 0) return undefined

  const layers = result.layers.map((layer) => layer.id).sort()

  // 全層のうち、いちばん深い区分を採る（安全側）
  let worst: string | undefined
  let worstIndex = Number.POSITIVE_INFINITY
  for (const layer of result.layers) {
    const index = layer.worstDepth === undefined ? 98 : DEPTH_LEGEND.findIndex((e) => e.label === layer.worstDepth)
    if (index < worstIndex) {
      worstIndex = index
      worst = layer.worstDepth
    }
  }

  const bucket = bucketOf(worst)
  return { id: `${layers.join('-')}-${bucket}`, layers, bucket }
}

function buildProfiles(results: ChomeHazardResult[]): Profile[] {
  const counts = new Map<string, { layers: string[]; bucket: DepthBucket; count: number }>()

  for (const result of results) {
    const profile = profileOf(result)
    if (!profile) continue
    const entry = counts.get(profile.id)
    if (entry) entry.count += 1
    else counts.set(profile.id, { layers: profile.layers, bucket: profile.bucket, count: 1 })
  }

  const layerLabel = (ids: string[]): string =>
    ids
      .map((id) => HAZARD_LAYERS.find((layer) => layer.id === id)?.label ?? id)
      .join('と')

  return [...counts.entries()]
    .map(([id, entry]) => ({
      id,
      label: `${layerLabel(entry.layers)}の浸水想定区域（最大 ${DEPTH_BUCKET_LABELS[entry.bucket]}）`,
      layers: entry.layers,
      depthBucket: entry.bucket,
      depthLabel: DEPTH_BUCKET_LABELS[entry.bucket],
      chomeCount: entry.count,
    }))
    .sort((a, b) => b.chomeCount - a.chomeCount || a.id.localeCompare(b.id))
}

/* ------------------------------------------------------------------ *
 * 出力
 * ------------------------------------------------------------------ */

function emit(results: ChomeHazardResult[]): string {
  const withZone = results
    .filter((result) => result.layers.length > 0)
    .map((result) => ({ ...result, profile: profileOf(result)!.id }))
  const profiles = buildProfiles(results)

  return `/**
 * ★ 自動生成ファイル。手で編集しないこと。
 *
 * 生成元: tools/ingest/hazard.ts（#72・#75）／再生成: pnpm ingest:hazard
 *
 * 町丁目ごとの浸水想定。**判定は apps/web/src/hazard.ts の実装をそのまま使っている**
 * ので、地図の色と取り込んだ深さが食い違わない。
 *
 * ★ **区域が無い町丁目は載せていない。** 「区域が無い」と「深さが分からない」は
 * 違うので、載せないことで前者を表す（chome.ts が0件の町丁目を返さないのと同じ）。
 *
 * ★ \`ratio\` は町丁目の中に置いた標本点のうち、区域内だった割合である。
 * **危険度ではない。** 面積の割合の目安であって、そこに居る人の危なさではない。
 *
 * 出典: 国土交通省 ハザードマップポータルサイト
 *       （洪水浸水想定区域・高潮浸水想定区域）https://disaportal.gsi.go.jp/
 * 取得日: ${TODAY}
 * 標本の間隔: ${SAMPLE_STEP_M}m ／ 判定ズーム: z${HAZARD_SAMPLE_ZOOM}
 * 町丁目: 全 ${results.length} のうち、区域にかかるもの ${withZone.length}
 * ハザードの型: ${profiles.length} 通り
 */

export interface ChomeHazardLayer {
  id: string
  label: string
  /** 区域内だった標本の割合（0〜1）。**危険度ではない** */
  ratio: number
  /**
   * いちばん深い区分。
   *
   * ★ **省略されることがある**（区域内だが凡例に無い色だった場合）。
   * JSON は undefined のキーを持てないので、任意の項目にしてある。
   * **「区域外」ではなく「深さが分からない」である。**
   */
  worstDepth?: string
}

export interface ChomeHazard {
  code: string
  samples: number
  layers: ChomeHazardLayer[]
  /**
   * ハザードの型（避難行動が変わる境目でまとめたもの）。
   *
   * ★ 249 区画それぞれにナレッジを作ると防災士が読み切れないので、
   * **行動が変わるところだけで割ってある**（\`HAZARD_PROFILES\` を参照）。
   */
  profile: string
}

export interface HazardProfile {
  id: string
  label: string
  /** 層のID。'flood' ｜ 'hightide' */
  layers: string[]
  /** 'shallow' ｜ 'mid' ｜ 'deep' ｜ 'unknown' */
  depthBucket: string
  depthLabel: string
  /** この型に属する町丁目の数 */
  chomeCount: number
}

/**
 * ハザードの型の一覧。
 *
 * ★ 深さの3段は建物の階と対応している：
 *   0.5m未満   足首程度。屋内に留まれる
 *   0.5〜3m    1階が水没しうる。上の階へ
 *   3m以上     2階でも危ない。区域の外へ立ち退く
 * **独自の危険度ではなく**、浸水想定区域図の一般的な読み方に沿っている。
 */
export const HAZARD_PROFILES: readonly HazardProfile[] = ${JSON.stringify(profiles, null, 2)}

export const CHOME_HAZARDS: readonly ChomeHazard[] = ${JSON.stringify(withZone, null, 2)}

const BY_CODE = new Map<string, ChomeHazard>(CHOME_HAZARDS.map((entry) => [entry.code, entry]))

/** 町丁目の浸水想定。区域にかからなければ undefined */
export function chomeHazardOf(code: string): ChomeHazard | undefined {
  return BY_CODE.get(code)
}

const PROFILE_BY_ID = new Map<string, HazardProfile>(HAZARD_PROFILES.map((entry) => [entry.id, entry]))

export function hazardProfileOf(id: string): HazardProfile | undefined {
  return PROFILE_BY_ID.get(id)
}
`
}

/* ------------------------------------------------------------------ *
 * 実行
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log(`町丁目 ${CHOMES.length} 区画を ${SAMPLE_STEP_M}m 間隔で調べます（z${HAZARD_SAMPLE_ZOOM}）`)

  const results: ChomeHazardResult[] = []
  let done = 0

  for (const chome of CHOMES) {
    results.push(await analyze(chome))
    done += 1
    if (done % 25 === 0) console.log(`  ${done}/${CHOMES.length}（タイル ${tiles.size} 枚）`)
  }

  const withZone = results.filter((result) => result.layers.length > 0)
  await writeFile(OUT, emit(results), 'utf-8')

  console.log(`\n出力 ${OUT}`)
  console.log(`区域にかかる町丁目 ${withZone.length}/${results.length}`)
  for (const layer of HAZARD_LAYERS) {
    const hit = withZone.filter((result) => result.layers.some((entry) => entry.id === layer.id))
    console.log(`  ${layer.label}: ${hit.length} 区画`)
  }
  console.log(`ハザードの型 ${buildProfiles(results).length} 通り`)
  for (const profile of buildProfiles(results)) {
    console.log(`    ${String(profile.chomeCount).padStart(3)} 区画  ${profile.label}`)
  }
  console.log(`取得したタイル ${tiles.size} 枚`)
}

await main()
