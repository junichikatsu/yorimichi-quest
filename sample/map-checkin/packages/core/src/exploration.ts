import type { ExplorationSummary } from '@map-checkin/shared'
import { distanceMeters, toRadians, type LatLng } from './geo.js'

/**
 * 探索済みエリア（歩いたところ）の計算。
 *
 * 生の GPS 軌跡をそのまま貯めると件数が青天井になるため、**固定グリッドのタイルへ量子化して
 * 重複を落とす**。同じ道を 100 回歩いてもタイルは 1 件で、書き込み回数が利用量に比例しない。
 *
 * グリッドは緯度経度の原点（0, 0）に固定されており、端末にも表示倍率にも依存しない。
 * 同じ場所は必ず同じタイルキーになるので、FE と BE の両方で同じ判定ができる。
 */

/** 緯度 1 度あたりの距離（m）。WGS84 の平均値。 */
const METERS_PER_DEGREE_LAT = 111_320

/** 極付近で面積が 0 に潰れるのを防ぐ下限 */
const MIN_COS_LAT = 0.01

export interface ExplorationTile {
  /** グリッド上の位置を表すキー（"row:col"）。データストアのサブキーにそのまま使う */
  key: string
  /** タイル中心の座標。描画はこの点を中心に行う */
  center: LatLng
}

/**
 * グリッドの刻み幅（度）。緯度方向・経度方向とも同じ値を使う。
 *
 * ★ 経度の刻みを緯度ごとに変えてはいけない。
 * 経度 1 度の距離は緯度で変わるので「行ごとに幅を計算する」ほうが正確に見えるが、
 * わずかな幅の差に 25 万前後の列番号が掛かって列境界が大きくずれ、
 * **真北へ歩くと軌跡が斜めにずれていく**（実測で 100m 進むごとに約 40m 東へ流れた）。
 * 緯度経度を等間隔で切れば行同士が必ず揃い、ずれは原理的に起きない。
 */
function stepOf(tileSizeM: number): number {
  return tileSizeM / METERS_PER_DEGREE_LAT
}

/** 座標が属するタイル（キーと中心座標）を返す */
export function tileOf(position: LatLng, tileSizeM: number): ExplorationTile {
  const step = stepOf(tileSizeM)
  const row = Math.floor(position.lat / step)
  const col = Math.floor(position.lng / step)

  return {
    key: `${row}:${col}`,
    center: { lat: (row + 0.5) * step, lng: (col + 0.5) * step },
  }
}

/**
 * 1 タイルの面積（m²）。
 *
 * 等間隔グリッドなので縦は tileSizeM ちょうど、横は tileSizeM × cos(緯度) になる。
 * 日本付近（北緯 35 度）では 50m × 約 41m。
 */
export function tileAreaM2(tileSizeM: number, latitude: number): number {
  return tileSizeM * tileSizeM * Math.max(Math.cos(toRadians(latitude)), MIN_COS_LAT)
}

export interface SummarizeExplorationInput {
  tileCount: number
  tileSizeM: number
  /** 面積計算の基準にする緯度。対象エリアの中心を渡す */
  latitude: number
  /** 探索率の分母になる対象エリアの半径（m） */
  areaRadiusM: number
  /** 取得上限で打ち切られたか */
  truncated: boolean
}

/**
 * 探索状況の集計（FR-11 の素地）。
 *
 * 面積は**タイル面積の合計**で数える。地図上の霧はタイルより一回り大きい半径で晴らすため、
 * 見た目より数値のほうが控えめになる。数値を水増ししないほうを選んでいる。
 */
export function summarizeExploration(input: SummarizeExplorationInput): ExplorationSummary {
  const exploredAreaM2 = input.tileCount * tileAreaM2(input.tileSizeM, input.latitude)
  const areaM2 = Math.PI * input.areaRadiusM * input.areaRadiusM
  const ratio = areaM2 > 0 ? (exploredAreaM2 / areaM2) * 100 : 0

  return {
    tileCount: input.tileCount,
    exploredAreaM2: Math.round(exploredAreaM2),
    coveragePercent: Math.round(Math.min(ratio, 100) * 100) / 100,
    truncated: input.truncated,
  }
}

/* ------------------------------------------------------------------ *
 * エリア単位の開放
 * ------------------------------------------------------------------ */

/**
 * タイルより大きい「エリア」の単位でまとめて開放する仕組み。
 *
 * タイルを 1 枚ずつ塗るだけだと、区画全体を晴らすのに道という道を歩く必要があり、
 * 現実的な散歩では白い部分が延々と残る。**一定割合を歩いたらその区画は全部開放**する。
 *
 * ★ 区画の決め方はこの `areaKeyOf` に閉じ込めてある。
 * いまはタイルを格子状に束ねているが、本来は**町丁目の境界**を区画にしたい。
 * 町丁目のポリゴンを用意できたら、この関数を「座標 → 町丁目コード」に差し替えれば、
 * 開放の判定も面積の集計もそのまま動く（呼び出し側は区画キーの中身を見ていない）。
 */
export interface AreaUnlockConfig {
  tileSizeM: number
  /** 1 区画の一辺のタイル数。6 なら 50m タイルで 300m 四方 */
  blockTiles: number
  /** 区画全体が開放される割合（0〜1） */
  unlockRatio: number
}

export interface UnlockedArea {
  areaKey: string
  /** 区画の範囲。地図上でこの矩形ぶんの霧を晴らす */
  north: number
  south: number
  east: number
  west: number
}

function parseTileKey(tileKey: string): { row: number; col: number } | undefined {
  const [rowRaw, colRaw] = tileKey.split(':')
  if (rowRaw === undefined || colRaw === undefined) return undefined

  const row = Number(rowRaw)
  const col = Number(colRaw)
  if (!Number.isFinite(row) || !Number.isFinite(col)) return undefined

  return { row, col }
}

/** タイルが属する区画のキー。区画の決め方を変えるならここだけを差し替える */
export function areaKeyOf(tileKey: string, blockTiles: number): string | undefined {
  const parsed = parseTileKey(tileKey)
  if (!parsed || blockTiles < 1) return undefined

  return `${Math.floor(parsed.row / blockTiles)}:${Math.floor(parsed.col / blockTiles)}`
}

/** 1 区画に含まれるタイル数 */
export function tilesPerArea(blockTiles: number): number {
  return blockTiles * blockTiles
}

/**
 * 歩いたタイルから、開放された区画の一覧を返す。
 *
 * 判定は区画ごとの「歩いたタイル数 ÷ 区画のタイル数」。
 * 閾値に届いた区画だけを返すので、届いていない区画は従来どおりタイル単位で晴れる。
 */
export function unlockedAreas(
  tileKeys: Iterable<string>,
  config: AreaUnlockConfig,
): UnlockedArea[] {
  const counts = new Map<string, number>()
  for (const tileKey of tileKeys) {
    const areaKey = areaKeyOf(tileKey, config.blockTiles)
    if (areaKey === undefined) continue
    counts.set(areaKey, (counts.get(areaKey) ?? 0) + 1)
  }

  const needed = Math.max(1, Math.ceil(tilesPerArea(config.blockTiles) * config.unlockRatio))
  const step = stepOf(config.tileSizeM)
  const areas: UnlockedArea[] = []

  for (const [areaKey, count] of counts) {
    if (count < needed) continue

    const parsed = parseTileKey(areaKey)
    if (!parsed) continue

    const south = parsed.row * config.blockTiles * step
    const west = parsed.col * config.blockTiles * step
    areas.push({
      areaKey,
      south,
      west,
      north: south + config.blockTiles * step,
      east: west + config.blockTiles * step,
    })
  }

  return areas
}

/**
 * 集計に使う実効タイル数。
 *
 * 開放済みの区画は、実際に歩いていないタイルも含めて全面を数える。
 * 見えている範囲と数値がずれると「晴れているのに探索率が上がらない」ことになるため、
 * 表示と同じ基準で数える。
 */
export function effectiveTileCount(
  tileKeys: Iterable<string>,
  config: AreaUnlockConfig,
): number {
  const keys = [...tileKeys]
  const unlocked = new Set(unlockedAreas(keys, config).map((area) => area.areaKey))

  const outside = keys.filter((tileKey) => {
    const areaKey = areaKeyOf(tileKey, config.blockTiles)
    return areaKey === undefined || !unlocked.has(areaKey)
  }).length

  return unlocked.size * tilesPerArea(config.blockTiles) + outside
}

/**
 * 2 点間を stepM 間隔で補間した経路を返す（始点は含まず、終点を含む）。
 *
 * デモ用の「歩いたことにする」導線で使う。数 km 程度なら直線補間で十分な精度が出る。
 * maxPoints で打ち切るため、極端に遠い 2 点では間隔が広がって軌跡が飛び飛びになる。
 */
export function interpolatePath(
  from: LatLng,
  to: LatLng,
  stepM: number,
  maxPoints: number,
): LatLng[] {
  const total = distanceMeters(from, to)
  const steps = Math.max(1, Math.min(Math.ceil(total / Math.max(stepM, 1)), maxPoints))

  const points: LatLng[] = []
  for (let i = 1; i <= steps; i += 1) {
    const ratio = i / steps
    points.push({
      lat: from.lat + (to.lat - from.lat) * ratio,
      lng: from.lng + (to.lng - from.lng) * ratio,
    })
  }
  return points
}
