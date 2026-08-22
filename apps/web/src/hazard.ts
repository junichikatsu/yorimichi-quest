import type { DataSourceCredit } from '@imanouchi/shared'

/**
 * ハザード（浸水想定）の扱い（#72）。
 *
 * ★ ねらいは「ここは危ないと学べ」に着地させることである（設計原則 G-2 の具体化）。
 * **近づくと何かが得られる形にしてはいけない。** ポイントもカードも一切動かさない。
 *
 * ★ 出すのは国土交通省ハザードマップポータルサイトが配信しているタイルである。
 * 自前で危険度を計算しない。**色も凡例もそのまま使う**（独自の危険色を作ると、
 * 他の地図と読み替えができなくなる）。
 *
 * ★ 平時は探索済みの範囲にだけ出し、**有事モードでは探索に関係なく全面に出す。**
 * 霧を有事に消すのと同じ理由（FR-08-2）で、「歩いていないから危険が見えない」は
 * 有事に人を危険へ晒す。
 *
 * ★ 対象は洪水と高潮だけにしてある。津波と土砂は対象エリア（千代田区・港区）に
 * 区域が無く、タイルが 404 を返す（2026-08-22 に確認）。**出ないものを出す作りに
 * すると、区域が無いのか実装が壊れているのか分からなくなる。**
 */

export type HazardId = 'flood' | 'hightide'

export interface HazardLayer {
  id: HazardId
  /** 画面に出す名前 */
  label: string
  /** タイルの並び（地理院タイル仕様の {z}/{x}/{y}.png） */
  path: string
}

/**
 * 出すハザード。
 *
 * ★ 並びは**深い側の想定から**にしてある。文言を組み立てるときに、
 * 先に来たものから読ませる。
 */
export const HAZARD_LAYERS: readonly HazardLayer[] = [
  { id: 'hightide', label: '高潮', path: '03_hightide_l2_shinsuishin_data' },
  { id: 'flood', label: '洪水', path: '01_flood_l2_shinsuishin' },
]

const TILE_BASE = 'https://disaportaldata.gsi.go.jp/raster'

export function hazardTileUrl(layer: HazardLayer, z: number, x: number, y: number): string {
  return `${TILE_BASE}/${layer.path}/${z}/${x}/${y}.png`
}

/**
 * 出典表示（国土地理院コンテンツ利用規約）。
 *
 * ★ 消せる作りにしない。スポットの出典（FR-10-2）と同じ扱いで画面に出す。
 */
export const HAZARD_CREDITS: readonly DataSourceCredit[] = [
  {
    title: '国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）',
    url: 'https://disaportal.gsi.go.jp/',
    fetchedAt: '',
  },
]

/**
 * 判定に使うズーム。
 *
 * ★ z16 で 1px ≒ 2.4m（緯度35度）。区域の内側かどうかを見るには十分で、
 * これ以上上げてもタイルの元データの精度は上がらない。
 */
export const HAZARD_SAMPLE_ZOOM = 16

/** 地図に描くズームの範囲。低すぎるとタイル枚数が跳ね、高すぎても絵は変わらない */
export const HAZARD_MIN_ZOOM = 12
export const HAZARD_MAX_ZOOM = 16

/** 1回の描画で読むタイルの上限。これを超えたら描かない（引きの画では意味が薄い） */
export const HAZARD_MAX_TILES = 30

export interface TilePoint {
  z: number
  x: number
  y: number
  /** タイルの中の位置（0〜255） */
  px: number
  py: number
}

/** 緯度経度をタイル番号とタイル内の画素へ直す（Web メルカトル） */
export function tilePointOf(lat: number, lng: number, z: number): TilePoint {
  const n = 2 ** z
  const fx = ((lng + 180) / 360) * n
  const rad = (lat * Math.PI) / 180
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n

  const x = Math.floor(fx)
  const y = Math.floor(fy)

  return {
    z,
    x,
    y,
    // 端に来たときに 256 へ回り込まないように留める
    px: Math.min(255, Math.floor((fx - x) * 256)),
    py: Math.min(255, Math.floor((fy - y) * 256)),
  }
}

/** タイルの北西角の緯度経度（描く位置を出すため） */
export function tileNorthWest(z: number, x: number, y: number): { lat: number; lng: number } {
  const n = 2 ** z
  const lng = (x / n) * 360 - 180
  const rad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
  return { lat: (rad * 180) / Math.PI, lng }
}

/**
 * 浸水深の凡例。
 *
 * ★ 色は**実際のタイルから読み出して確かめている**（2026-08-22、港区の z16）。
 * 覚えている値を書き写してはいけない。深さの文言を間違えると、危険の程度を
 * 誤って伝えることになる。
 *
 * ★ ここに無い色も区域内として扱う（下の `classifyPixel`）。高潮のタイルには
 * この表に無い色が含まれており、**深さが分からないことと区域外であることは違う。**
 */
export const DEPTH_LEGEND: readonly { rgb: readonly [number, number, number]; label: string }[] = [
  { rgb: [220, 122, 220], label: '20m以上' },
  { rgb: [242, 133, 201], label: '10〜20m未満' },
  { rgb: [255, 145, 145], label: '5〜10m未満' },
  { rgb: [255, 183, 183], label: '3〜5m未満' },
  { rgb: [255, 216, 192], label: '0.5〜3m未満' },
  { rgb: [247, 245, 169], label: '0.5m未満' },
]

/**
 * 色の揺れを許す幅。
 *
 * ★ **狭くしなければならない。** 高潮のタイルに含まれる `#FFFFB3` は、
 * 浸水深 0.5m未満の `#F7F5A9` と各成分で 8〜10 しか違わない。幅を広く取ると
 * **別の区分を「0.5m未満」と言ってしまう**（危険を浅く見せる）。
 * タイルは境界がはっきりしていて中間色が無いので、狭くても取りこぼさない。
 */
const COLOR_TOLERANCE = 4

export type HazardSample = { inside: false } | { inside: true; depth: string | undefined }

const OUTSIDE: HazardSample = { inside: false }

/**
 * 画素1つを判定する。
 *
 * ★ 透明かどうかで区域の内外を決める。**これは常に正しい**（区域の外は塗られて
 * いない）。深さは色から引くが、表に無ければ「区域内・深さ不明」にする。
 * 分からないものを分かったように書かない。
 */
export function classifyPixel(r: number, g: number, b: number, a: number): HazardSample {
  if (a === 0) return OUTSIDE

  for (const rank of DEPTH_LEGEND) {
    if (
      Math.abs(r - rank.rgb[0]) <= COLOR_TOLERANCE &&
      Math.abs(g - rank.rgb[1]) <= COLOR_TOLERANCE &&
      Math.abs(b - rank.rgb[2]) <= COLOR_TOLERANCE
    ) {
      return { inside: true, depth: rank.label }
    }
  }

  return { inside: true, depth: undefined }
}

/**
 * 深さの深い側を採る。
 *
 * ★ 境界に立っているときは**安全側（深い側）へ倒す。** ラスタの境界は数十m
 * ずれうるので、浅く見せるより深く見せるほうがよい。文言は「このあたりは」に
 * してあり、断定はしていない。
 */
export function worseSample(a: HazardSample, b: HazardSample): HazardSample {
  if (!a.inside) return b
  if (!b.inside) return a
  const rank = (depth: string | undefined): number =>
    depth === undefined ? -1 : DEPTH_LEGEND.findIndex((entry) => entry.label === depth)
  // findIndex は深い側が小さい（表が深い順）。小さいほうを採る
  const ra = rank(a.depth)
  const rb = rank(b.depth)
  if (ra < 0) return b
  if (rb < 0) return a
  return ra <= rb ? a : b
}

export interface HazardHere {
  id: HazardId
  label: string
  /** 浸水深の文言。分からなければ undefined */
  depth: string | undefined
}

/**
 * いまいる場所の説明文。
 *
 * ★ 断定しない（「ここは」ではなく「このあたりは」）。判定はラスタの画素であり、
 * 境界は数十mずれる。
 *
 * ★ **想定であることを必ず添える。** いま水が来ていることを示すものではない。
 * 有事モードのデモ表示の明示（FR-08-9）と同じ作法である。
 */
export function hazardSentence(here: readonly HazardHere[]): string {
  if (here.length === 0) return ''

  return `このあたりは ${hazardParts(here)} の浸水想定区域です`
}

/**
 * 区域の内訳だけ（「洪水（3〜5m）・高潮」）。
 *
 * ★ 見出しと組み合わせて使う。**入った瞬間**は「入りました」を主役にしたいので、
 * 文全体ではなく内訳だけが要る。文言を組み立てる場所を1つにしておかないと、
 * 帯と読み上げで区分の書き方がずれる。
 */
export function hazardParts(here: readonly HazardHere[]): string {
  return here
    .map((item) => (item.depth === undefined ? item.label : `${item.label}（${item.depth}）`))
    .join('・')
}

/**
 * 区域に入った瞬間の見出し。
 *
 * ★ **祝わない**（#72・G-2）。危ないことを知らせる文にする。点数もカードも動かさない。
 */
export const HAZARD_ENTERED_TITLE = '浸水想定区域に入りました'

/** 区域の中に居るあいだの見出し */
export const HAZARD_INSIDE_TITLE = '浸水想定区域の中'
