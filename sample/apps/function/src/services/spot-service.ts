import { classifyExploration, distanceMeters, type LatLng } from '@yorimichi-sample/core'
import { getSpot, listSpotsByArea, type DataStoreContext } from '@yorimichi-sample/datastore'
import type { AreaId, Spot, SpotId, SpotWithDistance } from '@yorimichi-sample/shared'

/** 未開拓判定・ポイント倍率・距離を付けて返す（FR-02-3, FR-02-4） */
export function decorateSpot(spot: Spot, position: LatLng | undefined): SpotWithDistance {
  const { unexplored, multiplier } = classifyExploration(spot.checkinCount)
  return {
    ...spot,
    distanceM: position ? distanceMeters(position, spot) : null,
    unexplored,
    pointMultiplier: multiplier,
  }
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
  const decorated = spots.map((spot) => decorateSpot(spot, input.position))

  if (input.position) {
    decorated.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
  } else {
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
  return decorateSpot(spot, position)
}
