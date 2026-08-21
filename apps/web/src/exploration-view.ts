import {
  areaKeyOf,
  effectiveTileCount,
  summarizeExploration,
  unlockedAreas,
  type AreaUnlockConfig,
} from '@imanouchi/core'
import type {
  ExplorationConfig,
  ExplorationResponse,
  ExplorationSummary,
  ExploredTile,
  UnlockedAreaBounds,
} from '@imanouchi/shared'

/**
 * 画面に出す探索状態の組み立て。
 *
 * ★ **サーバーの応答で状態を置き換えてはいけない。**
 * 送信は 30 秒ごとにまとめているため、手元では応答を待たずに霧を晴らしている。
 * 応答には「送っている最中に歩いた分」が入っていないので、丸ごと置き換えると
 * **晴れたところが霧に戻る**（通信が成功していても起きる）。
 * ここでサーバーの確定分と未確定分を合わせてから画面へ渡す。
 */

/** 開放判定に使う設定。判定式は FE と BE で同じ（core の関数）を使う */
export function unlockConfigOf(config: ExplorationConfig): AreaUnlockConfig {
  return {
    tileSizeM: config.tileSizeM,
    unlockRatio: config.unlockRatio,
    unlockMaxTiles: config.unlockMaxTiles,
  }
}

export interface ExplorationViewInput {
  config: ExplorationConfig
  /** 最後に受け取ったサーバーの応答（確定分）。未取得なら undefined */
  server: ExplorationResponse | undefined
  /** サーバーがまだ知らない分（未送信・送信中）。手元で先に霧を晴らしたタイル */
  unconfirmed: ExploredTile[]
}

export interface ExplorationView {
  tiles: ExploredTile[]
  unlockedAreas: UnlockedAreaBounds[]
  summary: ExplorationSummary | undefined
}

export function buildExplorationView(input: ExplorationViewInput): ExplorationView {
  const serverTiles = input.server?.tiles ?? []
  const serverKeys = new Set(serverTiles.map((tile) => tile.tileKey))
  const extras = input.unconfirmed.filter((tile) => !serverKeys.has(tile.tileKey))

  // 未確定分が無いときはサーバーの集計をそのまま使う。打ち切り（truncated）を
  // 知っているのはサーバーだけなので、数え直して上書きしない
  if (extras.length === 0) {
    return {
      tiles: serverTiles,
      unlockedAreas: input.server?.unlockedAreas ?? [],
      summary: input.server?.summary,
    }
  }

  const tiles = [...serverTiles, ...extras]
  const keys = tiles.map((tile) => tile.tileKey)
  const unlockConfig = unlockConfigOf(input.config)

  return {
    tiles,
    // ★ 未確定分も入れて判定する。1 枚欠けるだけで閾値を割り、
    // 開放済みの町丁目がまるごと霧に戻ってしまう
    unlockedAreas: unlockedAreas(keys, unlockConfig),
    summary: summarizeExploration({
      tileCount: effectiveTileCount(keys, unlockConfig),
      tileSizeM: input.config.tileSizeM,
      latitude: input.config.latitude,
      areaRadiusM: input.config.areaRadiusM,
      truncated: input.server?.summary.truncated ?? false,
    }),
  }
}

/**
 * そのタイルが開放済みの町丁目の中にあるか。
 *
 * ★ 中にあるなら記録しない。全面が霧から抜けており、探索率も町丁目の全タイル数で
 * 数えているので、1 枚増やしても**表示も数値も変わらない**。書き込み回数と保存件数だけが増える。
 * 最大の町丁目は 1433 タイルあり、既に開いている区画で保存上限を食い潰しうる。
 *
 * ★ 引き換えに、開放後の細かい軌跡は残らない。`EXPLORE_UNLOCK_RATIO` などを
 * **後から厳しくすると**、開放済みだった町丁目が閾値を割って閉じうる。
 */
export function isInsideUnlockedArea(
  tileKey: string,
  tileSizeM: number,
  unlockedAreaKeys: ReadonlySet<string>,
): boolean {
  if (unlockedAreaKeys.size === 0) return false
  const areaKey = areaKeyOf(tileKey, tileSizeM)
  return areaKey !== undefined && unlockedAreaKeys.has(areaKey)
}
