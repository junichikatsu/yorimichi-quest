import {
  achieveCard,
  getSpot,
  getUser,
  getUserSpotState,
  listAchievedCards,
  putUser,
  putUserSpotState,
  type DataStoreContext,
  type UserProfile,
} from '@map-checkin/datastore'
import {
  DEFAULT_AVATAR,
  EMPTY_EQUIPMENT,
  ITEM_DEFS,
  ITEM_ORDER,
  checkinItemFor,
  parseCardId,
  sanitizeEquipment,
  toCardId,
  type AreaId,
  type Avatar,
  type Equipment,
  type ItemKey,
  type ItemsResponse,
  type QuizAnswerResponse,
  type QuizResponse,
  type SpotId,
  type UserId,
} from '@map-checkin/shared'
import { badRequest, notFound } from '../errors.js'
import { findQuizEntry, pickQuizForSpot } from '../data/quiz-bank.js'

/**
 * キャラメイク・アイテム・クイズ（FR-04 / FR-07-8）。
 *
 * チェックインと同じく、判定に必要な読み取りをできるだけ少ない getItem に寄せている。
 */

function emptyProfile(userId: UserId, nowIso: string): UserProfile {
  return {
    userId,
    displayName: 'サンプルプレイヤー',
    totalPoints: 0,
    checkinCount: 0,
    createdAt: nowIso,
    lastActiveAt: nowIso,
    avatar: DEFAULT_AVATAR,
    equipment: EMPTY_EQUIPMENT,
  }
}

export async function loadProfile(
  ctx: DataStoreContext,
  userId: UserId,
  now: number,
): Promise<UserProfile> {
  const nowIso = new Date(now).toISOString()
  return (await getUser(ctx, userId)) ?? emptyProfile(userId, nowIso)
}

/**
 * アイテムを渡し、空きスロットなら自動で装備する。
 *
 * 手に入れても見た目が変わらないと「集めた実感」が出ないため、
 * 初回獲得かつスロットが空いているときだけ自動装備する。
 * 既に装備しているものを勝手に置き換えはしない。
 */
export async function grantItem(
  ctx: DataStoreContext,
  profile: UserProfile,
  itemKey: ItemKey,
  nowIso: string,
): Promise<{ profile: UserProfile; acquired: ItemKey | undefined }> {
  const result = await achieveCard(ctx, profile.userId, toCardId('tool', itemKey), nowIso)
  if (!result.isNew) return { profile, acquired: undefined }

  const slot = ITEM_DEFS[itemKey].slot
  if (profile.equipment[slot] !== null) return { profile, acquired: itemKey }

  return {
    profile: { ...profile, equipment: { ...profile.equipment, [slot]: itemKey } },
    acquired: itemKey,
  }
}

/** チェックインで手に入るアイテム。カテゴリに紐づくものが無ければ何も渡さない */
export function itemForCheckin(category: Parameters<typeof checkinItemFor>[0]): ItemKey | undefined {
  return checkinItemFor(category)
}

/* ------------------------------------------------------------------ *
 * クイズ
 * ------------------------------------------------------------------ */

export interface GetQuizInput {
  userId: UserId
  areaId: AreaId
  spotId: SpotId
}

export async function getQuiz(ctx: DataStoreContext, input: GetQuizInput): Promise<QuizResponse> {
  const spot = await getSpot(ctx, input.areaId, input.spotId)
  if (!spot) throw notFound('スポットが見つかりません')

  const quiz = pickQuizForSpot(spot.spotId, spot.category)
  if (!quiz) throw notFound('このスポットに対応するクイズがありません')

  const state = await getUserSpotState(ctx, input.userId, input.spotId)

  return { quiz, alreadyCleared: state?.quizClearedAt !== undefined }
}

export interface AnswerQuizInput {
  userId: UserId
  areaId: AreaId
  spotId: SpotId
  quizId: string
  choiceIndex: number
  now: number
  correctPoints: number
}

/**
 * 採点（FR-04-3 / FR-04-6）。
 *
 * 不正解でもポイントを減らさず、必ず解説を返し、再挑戦できる状態にする。
 * 報酬（ポイントとアイテム）はスポットごとに一度だけ。二度目以降の正解でも
 * 解説は返すが、加点はしない。
 */
export async function answerQuiz(
  ctx: DataStoreContext,
  input: AnswerQuizInput,
): Promise<QuizAnswerResponse> {
  const entry = findQuizEntry(input.quizId)
  if (!entry) throw notFound('クイズが見つかりません')
  if (input.choiceIndex >= entry.options.length) {
    throw badRequest('選択肢の範囲外です')
  }

  const spot = await getSpot(ctx, input.areaId, input.spotId)
  if (!spot) throw notFound('スポットが見つかりません')
  // 別スポットのクイズIDを送って報酬だけ得る、という抜け道を塞ぐ
  if (entry.category !== spot.category) {
    throw badRequest('このスポットのクイズではありません')
  }

  const correct = input.choiceIndex === entry.answerIndex
  const nowIso = new Date(input.now).toISOString()
  const state = await getUserSpotState(ctx, input.userId, input.spotId)
  const alreadyCleared = state?.quizClearedAt !== undefined

  if (!correct || alreadyCleared) {
    const profile = await loadProfile(ctx, input.userId, input.now)
    return {
      correct,
      answerIndex: entry.answerIndex,
      explanation: entry.explanation,
      pointsEarned: 0,
      totalPoints: profile.totalPoints,
      acquiredItem: undefined,
      // ペナルティを課さないため、不正解ならいつでも再挑戦できる（G-7）
      canRetry: !correct,
    }
  }

  let profile = await loadProfile(ctx, input.userId, input.now)
  profile = {
    ...profile,
    totalPoints: profile.totalPoints + input.correctPoints,
    lastActiveAt: nowIso,
  }

  // クイズ正解でしか手に入らないアイテムを渡す（チェックイン分とは別枠）
  const rewardKey = quizRewardFor(spot.category)
  let acquired: ItemKey | undefined
  if (rewardKey) {
    const granted = await grantItem(ctx, profile, rewardKey, nowIso)
    profile = granted.profile
    acquired = granted.acquired
  }

  // 行動カードを達成させる（FR-14-5）。クイズIDがそのままカードのキーになる
  await achieveCard(ctx, input.userId, toCardId('action', entry.quizId), nowIso)

  await putUser(ctx, profile)
  await putUserSpotState(ctx, input.userId, input.spotId, {
    lastCheckinAt: state?.lastCheckinAt ?? input.now,
    visitCount: state?.visitCount ?? 1,
    quizClearedAt: input.now,
  })

  return {
    correct: true,
    answerIndex: entry.answerIndex,
    explanation: entry.explanation,
    pointsEarned: input.correctPoints,
    totalPoints: profile.totalPoints,
    acquiredItem: acquired,
    canRetry: false,
  }
}

/**
 * クイズ正解の報酬アイテム。
 *
 * チェックインで配るもの（`checkinItemFor`）と重ならないよう、
 * カテゴリごとに別のアイテムを割り当てている。
 */
function quizRewardFor(category: Parameters<typeof checkinItemFor>[0]): ItemKey | undefined {
  switch (category) {
    case 'shelter':
      return 'zukin'
    case 'aed':
      return 'headlight'
    case 'accessible_toilet':
      return 'whistle'
    case 'water':
      return 'raincoat'
    default:
      return undefined
  }
}

/* ------------------------------------------------------------------ *
 * アイテム・アバター
 * ------------------------------------------------------------------ */

/** 道具カードだけを所持アイテムの形に戻す。装備画面が使う */
async function listOwnedTools(ctx: DataStoreContext, userId: UserId) {
  const cards = await listAchievedCards(ctx, userId)
  return cards
    .map((card) => ({ parsed: parseCardId(card.cardId), card }))
    .filter((entry) => entry.parsed?.kind === 'tool')
    .map((entry) => ({
      itemKey: entry.parsed!.key as ItemKey,
      count: entry.card.count,
      firstAcquiredAt: entry.card.achievedAt,
    }))
}

export async function listItems(ctx: DataStoreContext, userId: UserId): Promise<ItemsResponse> {
  const [owned, profile] = await Promise.all([
    listOwnedTools(ctx, userId),
    getUser(ctx, userId),
  ])

  const ownedKeys = new Set(owned.map((item) => item.itemKey))
  const equipment = sanitizeEquipment(profile?.equipment ?? EMPTY_EQUIPMENT, ownedKeys)

  return {
    owned,
    catalog: ITEM_ORDER.map((key) => ITEM_DEFS[key]),
    equipment,
  }
}

export async function updateAvatar(
  ctx: DataStoreContext,
  userId: UserId,
  avatar: Avatar,
  now: number,
): Promise<Avatar> {
  const nowIso = new Date(now).toISOString()
  const profile = await loadProfile(ctx, userId, now)
  await putUser(ctx, { ...profile, avatar, lastActiveAt: nowIso })
  return avatar
}

export async function updateEquipment(
  ctx: DataStoreContext,
  userId: UserId,
  equipment: Equipment,
  now: number,
): Promise<Equipment> {
  const nowIso = new Date(now).toISOString()
  const [profile, owned] = await Promise.all([
    loadProfile(ctx, userId, now),
    listOwnedTools(ctx, userId),
  ])

  // 持っていないアイテムを装備した状態で保存されないよう、ここで必ず整える
  const sanitized = sanitizeEquipment(equipment, new Set(owned.map((item) => item.itemKey)))
  await putUser(ctx, { ...profile, equipment: sanitized, lastActiveAt: nowIso })
  return sanitized
}
