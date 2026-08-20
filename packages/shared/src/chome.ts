import { CHOMES, type Chome } from './chome-data.js'
import { SPOT_CATEGORIES, type SpotCategory } from './spot.js'

/**
 * 町丁目の判定と集計（#27／FR-09）。
 *
 * 探索の区画と集計の単位を、格子ではなく**行政の町丁目**に合わせる。
 * 「300m四方の区画3つ」ではなく「麻布十番一丁目」と言えるようになり、
 * 集めたデータをそのまま自治体の単位で返せる。
 *
 * データは e-Stat の国勢調査 小地域境界（`chome-data.ts`）。**人口と世帯数が付いている**ため、
 * 記録件数を人口と対比できる。
 */

/** コードで引く。呼ぶたびに探さないよう一度だけ作る */
const BY_CODE = new Map<string, Chome>(CHOMES.map((c) => [c.code, c]))

export function chomeByCode(code: string): Chome | undefined {
  return BY_CODE.get(code)
}

/**
 * 点が輪の内側にあるか（交差数判定）。
 *
 * 境界線上の扱いは決めていない。50m タイルの中心や施設の座標を渡す用途なので、
 * 線上に乗る確率が実質的に無く、どちらに転んでも表示が変わらない。
 */
function pointInRing(ring: readonly (readonly [number, number])[], lng: number, lat: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

export function pointInChome(chome: Chome, lat: number, lng: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = chome.bbox
  // 外接矩形で弾く。256 区画すべてに交差数判定をかけると重い
  if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false
  // 輪ごとの偶奇。穴があっても正しく落ちる
  let inside = false
  for (const ring of chome.rings) {
    if (pointInRing(ring, lng, lat)) inside = !inside
  }
  return inside
}

/** 座標が属する町丁目。どこにも入らなければ undefined（区の外） */
export function findChomeAt(lat: number, lng: number): Chome | undefined {
  for (const chome of CHOMES) {
    if (pointInChome(chome, lat, lng)) return chome
  }
  return undefined
}

/* ------------------------------------------------------------------ *
 * 集計
 * ------------------------------------------------------------------ */

export interface ChomeRecordCount {
  chome: Chome
  /** カテゴリ別の記録件数 */
  counts: Record<SpotCategory, number>
  total: number
}

interface Located {
  lat: number
  lng: number
  category: SpotCategory
}

function emptyCounts(): Record<SpotCategory, number> {
  const counts = {} as Record<SpotCategory, number>
  for (const category of SPOT_CATEGORIES) counts[category] = 0
  return counts
}

/**
 * 町丁目ごとの記録件数（FR-09）。
 *
 * ★ これは**行政に返すための集計**であり、プレイヤーに危険度として見せるものではない。
 * 「設備が少ない町丁目」を強調すると、リスクを地図上の優劣として提示することになり、
 * 設計原則 G-2 に反する。件数と人口を並べるところまでに留める。
 *
 * 1件も無い町丁目は返さない。**「データが無い」と「設備が無い」は違う**ためである。
 */
export function chomeRecordCounts(spots: readonly Located[]): ChomeRecordCount[] {
  const byCode = new Map<string, ChomeRecordCount>()

  for (const spot of spots) {
    const chome = findChomeAt(spot.lat, spot.lng)
    if (!chome) continue

    let entry = byCode.get(chome.code)
    if (!entry) {
      entry = { chome, counts: emptyCounts(), total: 0 }
      byCode.set(chome.code, entry)
    }
    entry.counts[spot.category] += 1
    entry.total += 1
  }

  return [...byCode.values()].sort((a, b) => b.total - a.total || a.chome.code.localeCompare(b.chome.code))
}

/**
 * 町丁目に含まれるタイル数の目安。
 *
 * 面積をタイルの面積で割る。タイルを1枚ずつ内包判定するより桁違いに軽く、
 * 踏破率の分母としては十分である。
 */
export function tilesInChome(chome: Chome, tileSizeM: number): number {
  if (tileSizeM <= 0) return 0
  return Math.max(1, Math.round(chome.areaM2 / (tileSizeM * tileSizeM)))
}
