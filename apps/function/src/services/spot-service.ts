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

export interface ListSpotsResult {
  spots: SpotWithDistance[]
  truncated: boolean
}

export async function listSpots(
  ctx: DataStoreContext,
  input: ListSpotsInput,
): Promise<ListSpotsResult> {
  /*
   * ★ 上限より1件多く引く。
   *
   * ちょうど上限件数が返ったとき、「たまたま上限と同数だった」のか
   * 「切り詰められた」のかを区別できない。1件多く要求して超えたかどうかで判定する。
   *
   * 切り詰めを黙って通すと、カテゴリが丸ごと消えていても気づけない
   * （query はサブキーの昇順なので、辞書順で先のカテゴリだけが残る）。
   */
  const fetched = await listSpotsByArea(ctx, input.areaId, input.limit + 1)
  const truncated = fetched.length > input.limit
  const spots = truncated ? fetched.slice(0, input.limit) : fetched

  const decorated = spots.map((spot) => withDistance(spot, input.position))

  if (input.position) {
    decorated.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
  } else {
    // 現在地が無いときは名前順。読み込むたびに並びが変わると探しづらい
    decorated.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }

  return { spots: decorated, truncated }
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
