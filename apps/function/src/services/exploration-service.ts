import {
  areaKeyOf,
  effectiveTileCount,
  summarizeExploration,
  tileOf,
  unlockedAreas,
  type AreaUnlockConfig,
  type LatLng,
} from '@imanouchi/core'
import {
  listExploredTiles,
  putExploredTile,
  type DataStoreContext,
  type ExploredTileRecord,
} from '@imanouchi/datastore'
import type {
  ExplorationResponse,
  ExplorationUpdateResponse,
  ExploredTile,
  UserId,
} from '@imanouchi/shared'

export interface ExplorationParams {
  userId: UserId
  tileSizeM: number
  /** 面積計算の基準にする緯度（対象エリアの中心） */
  latitude: number
  areaRadiusM: number
  maxTiles: number
  /** 区画（町丁目）全体が開放される割合（0〜1） */
  unlockRatio: number
  /** 開放に必要なタイル数の上限（#27） */
  unlockMaxTiles: number
}

function toApiTile(record: ExploredTileRecord): ExploredTile {
  return {
    tileKey: record.tileKey,
    lat: record.lat,
    lng: record.lng,
    firstSeenAt: new Date(record.firstSeenAt).toISOString(),
  }
}

function unlockConfigOf(params: ExplorationParams): AreaUnlockConfig {
  return {
    tileSizeM: params.tileSizeM,
    unlockRatio: params.unlockRatio,
    unlockMaxTiles: params.unlockMaxTiles,
  }
}

function toResponse(records: ExploredTileRecord[], params: ExplorationParams): ExplorationResponse {
  const unlockConfig = unlockConfigOf(params)
  const tileKeys = records.map((record) => record.tileKey)

  return {
    tiles: records.map(toApiTile),
    unlockedAreas: unlockedAreas(tileKeys, unlockConfig),
    summary: summarizeExploration({
      // 開放済みの区画は歩いていないタイルも含めて数える。
      // 見えている範囲と数値がずれると「晴れているのに探索率が上がらない」ことになる
      tileCount: effectiveTileCount(tileKeys, unlockConfig),
      tileSizeM: params.tileSizeM,
      latitude: params.latitude,
      areaRadiusM: params.areaRadiusM,
      truncated: records.length >= params.maxTiles,
    }),
  }
}

/**
 * 探索済みエリアの取得。
 *
 * データストアのアクセス回数（E4）: query × 1。
 */
export async function getExploration(
  ctx: DataStoreContext,
  params: ExplorationParams,
): Promise<ExplorationResponse> {
  const records = await listExploredTiles(ctx, params.userId, params.maxTiles)
  return toResponse(records, params)
}

export interface RecordExplorationInput extends ExplorationParams {
  points: LatLng[]
  now: number
}

/**
 * 歩いた座標を探索済みタイルとして記録する。
 *
 * データストアのアクセス回数（E4）: query × 1 ＋ putItem × **新規タイル数**。
 * 既知のタイルは書かないので、同じ場所に留まり続けても書き込みは増えない。
 * 上限に達している場合は新規タイルを書かない（無制限に増え続けるのを防ぐ）。
 *
 * ★ **開放済みの町丁目の中は書かない。**
 * 全面が霧から抜けており、探索率も町丁目の全タイル数（`effectiveTileCount`）で数えるので、
 * 1 枚増やしても**応答は 1 ビットも変わらない**。putItem と保存件数だけが増える。
 * 最大の町丁目は 1433 タイル（50m 換算）あり、既に開いている区画で上限を食い潰しうる。
 *
 * 引き換えに、開放後の細かい軌跡は残らない。`EXPLORE_UNLOCK_RATIO` /
 * `EXPLORE_UNLOCK_MAX_TILES` を**後から厳しくすると**、開放済みだった町丁目が
 * 閾値を割って閉じうる（緩める方向は安全）。
 */
export async function recordExploration(
  ctx: DataStoreContext,
  input: RecordExplorationInput,
): Promise<ExplorationUpdateResponse> {
  const records = await listExploredTiles(ctx, input.userId, input.maxTiles)
  const known = new Map(records.map((record) => [record.tileKey, record]))

  const unlockConfig = unlockConfigOf(input)
  const openedAreas = new Set(
    unlockedAreas(known.keys(), unlockConfig).map((area) => area.areaKey),
  )

  const fresh: ExploredTileRecord[] = []
  for (const point of input.points) {
    if (known.size >= input.maxTiles) break

    const tile = tileOf(point, input.tileSizeM)
    if (known.has(tile.key)) continue

    if (openedAreas.size > 0) {
      const areaKey = areaKeyOf(tile.key, input.tileSizeM)
      if (areaKey !== undefined && openedAreas.has(areaKey)) continue
    }

    const record: ExploredTileRecord = {
      tileKey: tile.key,
      lat: tile.center.lat,
      lng: tile.center.lng,
      firstSeenAt: input.now,
    }
    known.set(tile.key, record)
    fresh.push(record)
  }

  for (const record of fresh) {
    await putExploredTile(ctx, input.userId, record)
  }

  const merged = [...records, ...fresh]
  return { ...toResponse(merged, input), newTileCount: fresh.length }
}
