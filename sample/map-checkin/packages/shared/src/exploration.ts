/**
 * 探索済みエリア（歩いたところ）の型。
 *
 * 判定に使うグリッドの寸法はサーバー側の設定で決まる（クライアントからは変更できない）。
 * クライアントは client-config で受け取った値をそのまま使う。
 */

/** 1 リクエストで送れる座標の上限。FE の送信間隔もこの値を基準に決める */
export const MAX_EXPLORATION_POINTS = 200

export interface ExploredTile {
  /** グリッド上の位置（"row:col"）。同じ場所は必ず同じキーになる */
  tileKey: string
  /** タイル中心の座標 */
  lat: number
  lng: number
  /** 最初に通過した時刻（ISO8601） */
  firstSeenAt: string
}

export interface ExplorationSummary {
  tileCount: number
  /** 探索済みタイルの面積合計（m²） */
  exploredAreaM2: number
  /** 対象エリアに対する割合（%）。小数第 2 位まで */
  coveragePercent: number
  /** 取得上限で打ち切られたか。true のとき数値は「以上」として扱う */
  truncated: boolean
}

/** グリッドの寸法。FE は送信前の重複判定にこの値を使う */
export interface ExplorationConfig {
  /** 記録の粒度（m 四方） */
  tileSizeM: number
  /** 地図上で霧を晴らす半径（m）。タイルより大きくして軌跡を繋げる */
  revealRadiusM: number
  /** 探索率の分母になる対象エリアの半径（m） */
  areaRadiusM: number
  /** 1 リクエストで送れる座標の上限 */
  maxPointsPerRequest: number
}
