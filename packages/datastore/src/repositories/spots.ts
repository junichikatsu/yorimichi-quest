import type { AreaId, Spot, SpotCategory, SpotId } from '@imanouchi/shared'
import { asAreaId, asSpotId } from '@imanouchi/shared'
import type { DataStoreContext } from '../context.js'
import { areaKey, SPOTS_MAIN_KEY, SPOTS_SUB_KEY } from '../keys.js'
import { runGet, runOp } from '../run.js'

interface SpotItem extends Record<string, unknown> {
  areaKey: string
  spotId: string
  areaId: string
  name: string
  category: string
  lat: number
  lng: number
  address: string
  attributes: string[]
  source: string
  fetchedAt: string
  checkinCount: number
  updatedAt: string
}

function toSpot(item: unknown): Spot | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Partial<SpotItem>
  if (
    typeof raw.spotId !== 'string' ||
    typeof raw.areaId !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.category !== 'string' ||
    typeof raw.lat !== 'number' ||
    typeof raw.lng !== 'number'
  ) {
    return undefined
  }

  return {
    spotId: asSpotId(raw.spotId),
    areaId: asAreaId(raw.areaId),
    name: raw.name,
    category: raw.category as SpotCategory,
    lat: raw.lat,
    lng: raw.lng,
    address: raw.address ?? '',
    attributes: Array.isArray(raw.attributes) ? raw.attributes : [],
    source: raw.source ?? 'unknown',
    fetchedAt: raw.fetchedAt ?? '',
    checkinCount: raw.checkinCount ?? 0,
    updatedAt: raw.updatedAt ?? '',
  }
}

function toItem(spot: Spot): SpotItem {
  return {
    [SPOTS_MAIN_KEY]: areaKey(spot.areaId),
    [SPOTS_SUB_KEY]: spot.spotId,
    areaId: spot.areaId,
    name: spot.name,
    category: spot.category,
    lat: spot.lat,
    lng: spot.lng,
    address: spot.address,
    attributes: spot.attributes,
    source: spot.source,
    fetchedAt: spot.fetchedAt,
    checkinCount: spot.checkinCount,
    updatedAt: spot.updatedAt,
  } as SpotItem
}

/**
 * エリア内のスポットを取得する。
 *
 * データストアに地理検索が無いため、エリアでパーティションを切って全件取得し、
 * 距離計算はアプリ層で行う（デモエリア限定なので件数が制御できている前提）。
 */
export async function listSpotsByArea(
  ctx: DataStoreContext,
  areaId: AreaId,
  limit: number,
): Promise<Spot[]> {
  const tableId = ctx.tableId('spots')
  const result = await runOp('query', () =>
    ctx.client.query({
      tableId,
      expression: `#${SPOTS_MAIN_KEY} = :${SPOTS_MAIN_KEY}`,
      values: { [SPOTS_MAIN_KEY]: areaKey(areaId) },
      limit,
      order: false,
    }),
  )

  const items = result.params?.Items ?? []
  return items.map(toSpot).filter((spot): spot is Spot => spot !== undefined)
}

export async function getSpot(
  ctx: DataStoreContext,
  areaId: AreaId,
  spotId: SpotId,
): Promise<Spot | undefined> {
  const tableId = ctx.tableId('spots')
  const result = await runGet(() =>
    ctx.client.getItem({
      tableId,
      key: { [SPOTS_MAIN_KEY]: areaKey(areaId), [SPOTS_SUB_KEY]: spotId },
    }),
  )
  if (!result) return undefined
  return toSpot(result.params?.Item)
}

export async function putSpot(ctx: DataStoreContext, spot: Spot): Promise<void> {
  const tableId = ctx.tableId('spots')
  await runOp('putItem', () => ctx.client.putItem({ tableId, item: toItem(spot) }))
}

/**
 * スポットを1件消す（管理用）。
 *
 * ★ 一括削除は無いので1件ずつになる。**削除もアクセス数を消費する**（制約 E4）ため、
 * 入れ直しのたびに全消しするより、`areaId` を変えてパーティションを分ける方が安い。
 * それでも「消す」経路が無いと後戻りできないので用意しておく。
 */
export async function deleteSpot(
  ctx: DataStoreContext,
  areaId: AreaId,
  spotId: SpotId,
): Promise<void> {
  const tableId = ctx.tableId('spots')
  await runOp('deleteItem', () =>
    ctx.client.deleteItem({
      tableId,
      key: { [SPOTS_MAIN_KEY]: areaKey(areaId), [SPOTS_SUB_KEY]: spotId },
    }),
  )
}
