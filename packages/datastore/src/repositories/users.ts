import {
  DEFAULT_AVATAR,
  asUserId,
  normalizeAvatar,
  type UserId,
  type UserProfile,
} from '@imanouchi/shared'
import type { DataStoreContext } from '../context.js'
import { USER_PROFILE_RECORD_KEY, USERS_MAIN_KEY, USERS_SUB_KEY, userKey } from '../keys.js'
import { runGet, runOp } from '../run.js'

/**
 * ユーザー（FR-01）。
 *
 * データストアは入れ子のオブジェクトも配列も素直に扱えないため、称号は
 * JSON 文字列で持つ。読み出し側では必ず検証し、壊れていたら空配列へ落とす。
 * **読めない値でアプリを落とさない**ほうを選んでいる。
 */

function parseTitles(value: unknown): string[] {
  if (typeof value !== 'string' || value === '') return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

/**
 * キャラクターの見た目。
 *
 * ★ データストアは入れ子のオブジェクトを素直に扱えないため JSON 文字列で持つ。
 * 読み出しでは必ず検証し、壊れていたら既定値へ落とす。**読めない値でアプリを
 * 落とさない**ほうを選んでいる（描画側で存在しない髪型を引くと落ちる）。
 */
function parseAvatar(value: unknown): ReturnType<typeof normalizeAvatar> {
  if (typeof value !== 'string' || value === '') return DEFAULT_AVATAR
  try {
    return normalizeAvatar(JSON.parse(value))
  } catch {
    return DEFAULT_AVATAR
  }
}

function toProfile(item: unknown): UserProfile | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>
  if (typeof raw['userId'] !== 'string') return undefined

  const consent = raw['locationConsentAt']

  return {
    userId: asUserId(raw['userId']),
    displayName: typeof raw['displayName'] === 'string' ? raw['displayName'] : '',
    pictureUrl: typeof raw['pictureUrl'] === 'string' ? raw['pictureUrl'] : '',
    avatar: parseAvatar(raw['avatar']),
    totalPoints: typeof raw['totalPoints'] === 'number' ? raw['totalPoints'] : 0,
    titles: parseTitles(raw['titles']),
    // 空文字は「未同意」と同じ扱いにする（データストアは undefined を保持できない）
    locationConsentAt: typeof consent === 'string' && consent !== '' ? consent : undefined,
    createdAt: typeof raw['createdAt'] === 'string' ? raw['createdAt'] : '',
    lastActiveAt: typeof raw['lastActiveAt'] === 'string' ? raw['lastActiveAt'] : '',
  }
}

/**
 * ★ 未登録ユーザーは undefined を返す（エラーにしない）。
 *
 * getItem の "Not found" を 503 にすると、初回ログインが原理的に成立しない。
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
        pictureUrl: profile.pictureUrl,
        avatar: JSON.stringify(profile.avatar),
        totalPoints: profile.totalPoints,
        titles: JSON.stringify(profile.titles),
        // undefined は保持できないので空文字に落とす
        locationConsentAt: profile.locationConsentAt ?? '',
        createdAt: profile.createdAt,
        lastActiveAt: profile.lastActiveAt,
      },
    }),
  )
}
