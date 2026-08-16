import type { SpotId, UserId } from '@yorimichi-sample/shared'
import { asSpotId } from '@yorimichi-sample/shared'
import type { DataStoreContext } from '../context.js'
import { CHECKINS_MAIN_KEY, CHECKINS_SUB_KEY, userKey } from '../keys.js'
import { runOp } from '../run.js'

export interface CheckinRecord {
  /** epoch ms。サブキー（数値型） */
  checkinAt: number
  spotId: SpotId
  spotName: string
  pointsEarned: number
  lat: number
  lng: number
}

function toRecord(item: unknown): CheckinRecord | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>
  if (typeof raw[CHECKINS_SUB_KEY] !== 'number' || typeof raw['spotId'] !== 'string') {
    return undefined
  }

  return {
    checkinAt: raw[CHECKINS_SUB_KEY],
    spotId: asSpotId(raw['spotId']),
    spotName: typeof raw['spotName'] === 'string' ? raw['spotName'] : '',
    pointsEarned: typeof raw['pointsEarned'] === 'number' ? raw['pointsEarned'] : 0,
    lat: typeof raw['lat'] === 'number' ? raw['lat'] : 0,
    lng: typeof raw['lng'] === 'number' ? raw['lng'] : 0,
  }
}

export async function appendCheckin(
  ctx: DataStoreContext,
  userId: UserId,
  record: CheckinRecord,
): Promise<void> {
  const tableId = ctx.tableId('checkins')
  await runOp('putItem', () =>
    ctx.client.putItem({
      tableId,
      item: {
        [CHECKINS_MAIN_KEY]: userKey(userId),
        [CHECKINS_SUB_KEY]: record.checkinAt,
        spotId: record.spotId,
        spotName: record.spotName,
        pointsEarned: record.pointsEarned,
        lat: record.lat,
        lng: record.lng,
      },
    }),
  )
}

/** 新しい順に取得する。SDK の order は true が降順。 */
export async function listRecentCheckins(
  ctx: DataStoreContext,
  userId: UserId,
  limit: number,
): Promise<CheckinRecord[]> {
  const tableId = ctx.tableId('checkins')
  const result = await runOp('query', () =>
    ctx.client.query({
      tableId,
      expression: `#${CHECKINS_MAIN_KEY} = :${CHECKINS_MAIN_KEY}`,
      values: { [CHECKINS_MAIN_KEY]: userKey(userId) },
      limit,
      order: true,
    }),
  )

  const items = result.params?.Items ?? []
  return items.map(toRecord).filter((record): record is CheckinRecord => record !== undefined)
}
