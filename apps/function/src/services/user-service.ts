import { getUser, putUser, type DataStoreContext } from '@imanouchi/datastore'
import { DEFAULT_AVATAR, type Avatar, type UserId, type UserProfile } from '@imanouchi/shared'
import type { LineIdentity } from './line.js'

/**
 * ユーザーの登録と更新（FR-01）。
 */

export interface EnsureUserResult {
  profile: UserProfile
  /** 今回のログインで新規登録したか（FR-01-1） */
  registered: boolean
}

/**
 * ログインしたユーザーを用意する。
 *
 * ★ 初回ログインで自動登録する（FR-01-1）。登録画面は作らない。
 *
 * ★ LINE の表示名とアイコンは**毎回上書きする**（FR-01-2）。LINE 側で改名・
 * アイコン変更があったとき、こちらが古い値を持ち続けると別人のように見える。
 *
 * ★ 一方で **totalPoints・titles・locationConsentAt は触らない。**
 * ログインのたびに初期化されたら、貯めたものが消える。
 */
export async function ensureUser(
  ctx: DataStoreContext,
  identity: LineIdentity,
  now: Date,
): Promise<EnsureUserResult> {
  const nowIso = now.toISOString()
  const existing = await getUser(ctx, identity.userId)

  if (!existing) {
    const profile: UserProfile = {
      userId: identity.userId,
      displayName: identity.displayName,
      pictureUrl: identity.pictureUrl,
      // 未設定は既定の見た目。作成画面を通らなくても地図に出せる（FR-01-5）
      avatar: DEFAULT_AVATAR,
      totalPoints: 0,
      titles: [],
      locationConsentAt: undefined,
      createdAt: nowIso,
      lastActiveAt: nowIso,
    }
    await putUser(ctx, profile)
    return { profile, registered: true }
  }

  const profile: UserProfile = {
    ...existing,
    displayName: identity.displayName,
    pictureUrl: identity.pictureUrl,
    lastActiveAt: nowIso,
  }
  await putUser(ctx, profile)
  return { profile, registered: false }
}

/**
 * 位置情報の同意を記録する（FR-01-4）。
 *
 * 撤回もありうるので、真偽値ではなく**日時の有無**で持つ。
 * 撤回したら日時を消す（履歴は残さない。持つ理由が無い個人データを増やさない）。
 */
export async function setLocationConsent(
  ctx: DataStoreContext,
  userId: UserId,
  granted: boolean,
  now: Date,
): Promise<UserProfile | undefined> {
  const existing = await getUser(ctx, userId)
  if (!existing) return undefined

  const profile: UserProfile = {
    ...existing,
    locationConsentAt: granted ? now.toISOString() : undefined,
    lastActiveAt: now.toISOString(),
  }
  await putUser(ctx, profile)
  return profile
}

/**
 * キャラクターの見た目を保存する（FR-01-6）。
 *
 * ★ やり直せることが要件。上書きするだけで、履歴は持たない。
 */
export async function setAvatar(
  ctx: DataStoreContext,
  userId: UserId,
  avatar: Avatar,
  now: Date,
): Promise<UserProfile | undefined> {
  const existing = await getUser(ctx, userId)
  if (!existing) return undefined

  const profile: UserProfile = { ...existing, avatar, lastActiveAt: now.toISOString() }
  await putUser(ctx, profile)
  return profile
}
