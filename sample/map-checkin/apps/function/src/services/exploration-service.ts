import { summarizeExploration, tileOf, type LatLng } from '@map-checkin/core'
import {
  listExploredTiles,
  putExploredTile,
  type DataStoreContext,
  type ExploredTileRecord,
} from '@map-checkin/datastore'
import type {
  ExplorationResponse,
  ExplorationUpdateResponse,
  ExploredTile,
  UserId,
} from '@map-checkin/shared'

export interface ExplorationParams {
  userId: UserId
  tileSizeM: number
  /** 面積計算の基準にする緯度（対象エリアの中心） */
  latitude: number
  areaRadiusM: number
  maxTiles: number
}

function toApiTile(record: ExploredTileRecord): ExploredTile {
  return {
    tileKey: record.tileKey,
    lat: record.lat,
    lng: record.lng,
    firstSeenAt: new Date(record.firstSeenAt).toISOString(),
  }
}

function toResponse(records: ExploredTileRecord[], params: ExplorationParams): ExplorationResponse {
  return {
    tiles: records.map(toApiTile),
    summary: summarizeExploration({
      tileCount: records.length,
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
 */
export async function recordExploration(
  ctx: DataStoreContext,
  input: RecordExplorationInput,
): Promise<ExplorationUpdateResponse> {
  const records = await listExploredTiles(ctx, input.userId, input.maxTiles)
  const known = new Map(records.map((record) => [record.tileKey, record]))

  const fresh: ExploredTileRecord[] = []
  for (const point of input.points) {
    if (known.size >= input.maxTiles) break

    const tile = tileOf(point, input.tileSizeM)
    if (known.has(tile.key)) continue

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
