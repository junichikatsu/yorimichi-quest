import type { UserId } from '@map-checkin/shared'
import { asUserId } from '@map-checkin/shared'
import type { DataStoreContext } from '../context.js'
import { USER_PROFILE_RECORD_KEY, USERS_MAIN_KEY, USERS_SUB_KEY, userKey } from '../keys.js'
import { runGet, runOp } from '../run.js'

export interface UserProfile {
  userId: UserId
  displayName: string
  totalPoints: number
  checkinCount: number
  createdAt: string
  lastActiveAt: string
}

function toProfile(item: unknown): UserProfile | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>
  if (typeof raw['userId'] !== 'string') return undefined

  return {
    userId: asUserId(raw['userId']),
    displayName: typeof raw['displayName'] === 'string' ? raw['displayName'] : 'ゲスト',
    totalPoints: typeof raw['totalPoints'] === 'number' ? raw['totalPoints'] : 0,
    checkinCount: typeof raw['checkinCount'] === 'number' ? raw['checkinCount'] : 0,
    createdAt: typeof raw['createdAt'] === 'string' ? raw['createdAt'] : '',
    lastActiveAt: typeof raw['lastActiveAt'] === 'string' ? raw['lastActiveAt'] : '',
  }
}

/**
 * ★ 未登録ユーザーは undefined を返す（エラーにしない）。
 * getItem の "Not found" を 503 にすると初回アクセスが原理的に成立しない。
 */
export async function getUser(
  ctx: DataStoreContext,
  userId: UserId,
): Promise<UserProfile | undefined> {
  const tableId = ctx.tableId('users')
  const result = await runGet(() =>
    ctx.client.getItem({
      tableId,
      key: { [USERS_MAIN_KEY]: userKey(userId), [USERS_SUB_KEY]: USER_PROFILE_RECORD_KEY },
    }),
  )
  if (!result) return undefined
  return toProfile(result.params?.Item)
}

export async function putUser(ctx: DataStoreContext, profile: UserProfile): Promise<void> {
  const tableId = ctx.tableId('users')
  await runOp('putItem', () =>
    ctx.client.putItem({
      tableId,
      item: {
        [USERS_MAIN_KEY]: userKey(profile.userId),
        [USERS_SUB_KEY]: USER_PROFILE_RECORD_KEY,
        userId: profile.userId,
        displayName: profile.displayName,
        totalPoints: profile.totalPoints,
        checkinCount: profile.checkinCount,
        createdAt: profile.createdAt,
        lastActiveAt: profile.lastActiveAt,
      },
    }),
  )
}
