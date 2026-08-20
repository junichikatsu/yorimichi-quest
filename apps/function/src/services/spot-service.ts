import { distanceMeters, type LatLng } from '@imanouchi/core'
import { getSpot, listSpotsByArea, type DataStoreContext } from '@imanouchi/datastore'
import type { AreaId, Spot, SpotId, SpotWithDistance } from '@imanouchi/shared'

/**
 * スポットの取得（FR-02）。
 *
 * ★ 距離はサーバーで計算するが、**位置での絞り込みはしない。**
 * エリア内の全件を返すので、クライアントは移動しても再取得せずに距離を
 * 計算し直せる。データストアに地理検索が無いという制約が、結果的に
 * リクエスト数を抑える設計につながっている。
 */

export function withDistance(spot: Spot, position: LatLng | undefined): SpotWithDistance {
  return { ...spot, distanceM: position ? distanceMeters(position, spot) : null }
}

export interface ListSpotsInput {
  areaId: AreaId
  position: LatLng | undefined
  limit: number
}

export async function listSpots(
  ctx: DataStoreContext,
  input: ListSpotsInput,
): Promise<SpotWithDistance[]> {
  const spots = await listSpotsByArea(ctx, input.areaId, input.limit)
  const decorated = spots.map((spot) => withDistance(spot, input.position))

  if (input.position) {
    decorated.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
  } else {
    // 現在地が無いときは名前順。読み込むたびに並びが変わると探しづらい
    decorated.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }

  return decorated
}

export async function findSpot(
  ctx: DataStoreContext,
  areaId: AreaId,
  spotId: SpotId,
  position: LatLng | undefined,
): Promise<SpotWithDistance | undefined> {
  const spot = await getSpot(ctx, areaId, spotId)
  if (!spot) return undefined
  return withDistance(spot, position)
}
