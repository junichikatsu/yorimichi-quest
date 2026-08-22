import { asSpotId, type SpotId, type UserId } from '@imanouchi/shared'
import type { DataStoreContext } from '../context.js'
import { CHECKINS_MAIN_KEY, CHECKINS_SUB_KEY, userKey } from '../keys.js'
import { runOp } from '../run.js'

/**
 * チェックイン履歴（FR-03）。
 *
 * ★ スポット名とポイントを**非正規化して持つ**。データストアに JOIN が無いため、
 * 履歴を表示するたびにスポットを引き直すと件数ぶんのアクセスが必要になる
 * （制約 E4：アクセス数に月次上限がある）。
 *
 * ★ サブキー（`checkinAt`）は**数値型**である。文字列だと辞書順になり、
 * 桁が上がった時点で「新しい順」が壊れる。
 */
export interface CheckinRecord {
  /** epoch ms。サブキー（数値型） */
  checkinAt: number
  spotId: SpotId
  /** 記録した時点のスポット名。後から改名されても履歴は当時の名前で残る */
  spotName: string
  pointsEarned: number
  /** チェックインした位置。スポットの位置ではなく**申告された現在地** */
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

/**
 * 新しい順に取得する。
 *
 * ★ SDK の `order` は **true が降順**である。取り違えると「新しい順」が
 * 逆になり、古い記録だけが並ぶ。
 */
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
