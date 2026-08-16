import type { SpotId, UserId } from '@yorimichi-sample/shared'
import type { DataStoreContext } from '../context.js'
import {
  USER_SPOT_STATE_MAIN_KEY,
  USER_SPOT_STATE_SUB_KEY,
  spotStateKey,
  userKey,
} from '../keys.js'
import { runGet, runOp } from '../run.js'

/**
 * 再チェックイン制限（FR-03-3）の判定に使う。
 *
 * 履歴テーブルを走査せず 1 回の getItem で判定できるようにするための専用テーブル。
 * データストアのアクセス回数に月次上限があるため、判定はできるだけ 1 アクセスで済ませる。
 */
export interface UserSpotState {
  lastCheckinAt: number
  visitCount: number
}

export async function getUserSpotState(
  ctx: DataStoreContext,
  userId: UserId,
  spotId: SpotId,
): Promise<UserSpotState | undefined> {
  const tableId = ctx.tableId('userSpotState')
  const result = await runGet(() =>
    ctx.client.getItem({
      tableId,
      key: {
        [USER_SPOT_STATE_MAIN_KEY]: userKey(userId),
        [USER_SPOT_STATE_SUB_KEY]: spotStateKey(spotId),
      },
    }),
  )
  if (!result) return undefined

  const item = result.params?.Item
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>
  if (typeof raw['lastCheckinAt'] !== 'number') return undefined

  return {
    lastCheckinAt: raw['lastCheckinAt'],
    visitCount: typeof raw['visitCount'] === 'number' ? raw['visitCount'] : 1,
  }
}

export async function putUserSpotState(
  ctx: DataStoreContext,
  userId: UserId,
  spotId: SpotId,
  state: UserSpotState,
): Promise<void> {
  const tableId = ctx.tableId('userSpotState')
  await runOp('putItem', () =>
    ctx.client.putItem({
      tableId,
      item: {
        [USER_SPOT_STATE_MAIN_KEY]: userKey(userId),
        [USER_SPOT_STATE_SUB_KEY]: spotStateKey(spotId),
        lastCheckinAt: state.lastCheckinAt,
        visitCount: state.visitCount,
      },
    }),
  )
}
