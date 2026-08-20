import { findChomeAt, tilesInChome, type Chome, type ExplorationSummary } from '@map-checkin/shared'
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
 * タイルより大きい「区画」の単位でまとめて開放する仕組み。
 *
 * タイルを 1 枚ずつ塗るだけだと、区画全体を晴らすのに道という道を歩く必要があり、
 * 現実的な散歩では白い部分が延々と残る。**一定割合を歩いたらその区画は全部開放**する。
 *
 * ★ 区画は**町丁目**である（#27）。格子を捨てて行政の境界に合わせた。
 * 「300m四方の区画が3つ開いた」ではなく「麻布十番一丁目が開いた」と言えるようになり、
 * 集計もそのまま自治体の単位で返せる。境界データは shared（e-Stat 由来）にある。
 *
 * **境界データが無い場所では区画開放は起きない。** 千代田区・港区の外を歩いた場合は
 * タイル単位の霧だけが晴れる。無い境界を格子で代用すると、単位が場所によって変わって
 * しまうため、そうはしていない。
 */
export interface AreaUnlockConfig {
  tileSizeM: number
  /** 区画全体が開放される割合（0〜1） */
  unlockRatio: number
  /**
   * 開放に必要なタイル数の上限。
   *
   * ★ 町丁目の面積差が大きいため必須である。実測で最小 1 枚・中央 35 枚に対して
   * 最大 1433 枚（50m タイル換算）あり、割合だけで決めると広い町丁目が一生開かない。
   * 上限を置くと 256 区画のうち 95 区画がここに当たる。
   */
  unlockMaxTiles: number
}

/** 開放に必要なタイル数の下限。狭すぎる町丁目が 1 歩で開くのを防ぐ */
const MIN_TILES_TO_UNLOCK = 3

export interface UnlockedArea {
  /** 町丁目コード（11桁）。形と名前は境界データから引ける */
  areaKey: string
  /** 町丁目名。表示に使う */
  name: string
  ward: string
}

/**
 * タイルが属する区画（町丁目）。
 *
 * タイルの中心座標で判定する。区画の決め方を変えるならここだけを差し替える。
 */
export function areaKeyOf(tileKey: string, tileSizeM: number): string | undefined {
  return chomeOfTile(tileKey, tileSizeM)?.code
}

/** タイルが属する町丁目。undefined は境界データの外（両区の外） */
export function chomeOfTile(tileKey: string, tileSizeM: number): Chome | undefined {
  const center = tileCenterOf(tileKey, tileSizeM)
  if (!center) return undefined
  return findChomeAt(center.lat, center.lng)
}

function tileCenterOf(tileKey: string, tileSizeM: number): LatLng | undefined {
  const [rowRaw, colRaw] = tileKey.split(':')
  if (rowRaw === undefined || colRaw === undefined) return undefined

  const row = Number(rowRaw)
  const col = Number(colRaw)
  if (!Number.isFinite(row) || !Number.isFinite(col)) return undefined

  const step = stepOf(tileSizeM)
  return { lat: (row + 0.5) * step, lng: (col + 0.5) * step }
}

/** 町丁目に含まれるタイル数（面積から求めた目安） */
export function tilesPerArea(chome: Chome, tileSizeM: number): number {
  return tilesInChome(chome, tileSizeM)
}

/** その町丁目を開放するのに必要なタイル数 */
export function tilesNeededToUnlock(chome: Chome, config: AreaUnlockConfig): number {
  const total = tilesPerArea(chome, config.tileSizeM)
  const byRatio = Math.ceil(total * config.unlockRatio)
  const capped = Math.min(byRatio, config.unlockMaxTiles)
  // 区画のタイル数そのものを超えて要求してはいけない（1枚しかない町丁目がある）
  const floor = Math.min(MIN_TILES_TO_UNLOCK, total)
  return Math.max(floor, Math.min(capped, total))
}

/**
 * 歩いたタイルを町丁目ごとに数える。
 *
 * 判定にも表示にも使うので、数えるところを1箇所にまとめてある。
 */
export function walkedByChome(
  tileKeys: Iterable<string>,
  tileSizeM: number,
): Map<string, { chome: Chome; walked: number }> {
  const counts = new Map<string, { chome: Chome; walked: number }>()
  for (const tileKey of tileKeys) {
    const chome = chomeOfTile(tileKey, tileSizeM)
    if (!chome) continue
    const entry = counts.get(chome.code)
    if (entry) entry.walked += 1
    else counts.set(chome.code, { chome, walked: 1 })
  }
  return counts
}

/**
 * 歩いたタイルから、開放された町丁目の一覧を返す。
 *
 * 閾値に届いていない町丁目は従来どおりタイル単位で晴れる。
 */
export function unlockedAreas(
  tileKeys: Iterable<string>,
  config: AreaUnlockConfig,
): UnlockedArea[] {
  const areas: UnlockedArea[] = []
  for (const { chome, walked } of walkedByChome(tileKeys, config.tileSizeM).values()) {
    if (walked < tilesNeededToUnlock(chome, config)) continue
    areas.push({ areaKey: chome.code, name: chome.name, ward: chome.ward })
  }
  // 表示順を安定させる（コード順＝地番順に近い）
  return areas.sort((a, b) => a.areaKey.localeCompare(b.areaKey))
}

/**
 * 集計に使う実効タイル数。
 *
 * 開放済みの町丁目は、実際に歩いていないタイルも含めて全面を数える。
 * 見えている範囲と数値がずれると「晴れているのに探索率が上がらない」ことになるため、
 * 表示と同じ基準で数える。
 */
export function effectiveTileCount(
  tileKeys: Iterable<string>,
  config: AreaUnlockConfig,
): number {
  const counts = walkedByChome(tileKeys, config.tileSizeM)

  let total = 0
  let inChome = 0
  for (const { chome, walked } of counts.values()) {
    inChome += walked
    total +=
      walked >= tilesNeededToUnlock(chome, config)
        ? tilesPerArea(chome, config.tileSizeM)
        : walked
  }

  // 境界データの外のタイルは 1 枚ずつ数える
  const all = [...tileKeys].length
  return total + (all - inChome)
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
