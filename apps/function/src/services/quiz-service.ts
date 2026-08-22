import {
  getSpot,
  getUser,
  getUserSpotState,
  putUser,
  putUserSpotState,
  type DataStoreContext,
} from '@imanouchi/datastore'
import type { AreaId, QuizAnswerResponse, QuizResponse, SpotId } from '@imanouchi/shared'
import { quizSource, toPrompt } from '../data/quiz-bank.js'
import { badRequest, notFound, unauthorized } from '../errors.js'
import type { Actor } from './actor.js'

/**
 * クイズ（FR-04）。
 *
 * ★ 採点はサーバーで行う。正解をクライアントへ渡す設計にすると、
 * 配信された JavaScript を読むだけで答えが分かる。
 *
 * ★ 不正解にペナルティを与えない（FR-04-6 / G-7）。解説は正解・不正解の
 * どちらでも返し、再挑戦はいつでもできる。**間違えた人を弾くのではなく、
 * 間違えた人に学んでもらう**ための機能である。
 */

export interface GetQuizInput {
  actor: Actor
  areaId: AreaId
  spotId: SpotId
}

export async function getQuiz(ctx: DataStoreContext, input: GetQuizInput): Promise<QuizResponse> {
  const spot = await getSpot(ctx, input.areaId, input.spotId)
  if (!spot) throw notFound('スポットが見つかりません')

  /*
   * ★ おためしは正解状態を持たない（サーバーへ書かないため）。
   * 常に未正解として扱うので、行動を問う設問が出る。
   */
  const state =
    input.actor.kind === 'line'
      ? await getUserSpotState(ctx, input.actor.userId, input.spotId)
      : undefined
  const alreadyCleared = state?.quizClearedAt !== undefined

  const entry = await quizSource().pick({
    spotId: spot.spotId,
    category: spot.category,
    alreadyCleared,
  })
  if (!entry) throw notFound('このスポットに対応するクイズがありません')

  return { quiz: toPrompt(entry, 'fixture'), alreadyCleared }
}

export interface AnswerQuizInput {
  actor: Actor
  areaId: AreaId
  spotId: SpotId
  quizId: string
  choiceIndex: number
  now: number
  correctPoints: number
}

/**
 * 採点（FR-04-3・FR-04-6）。
 *
 * 報酬はスポットごとに一度だけ。二度目以降の正解でも解説は返すが、加点はしない。
 * **点数のために同じ設問を繰り返す動機を作らない**ためである。
 */
export async function answerQuiz(
  ctx: DataStoreContext,
  input: AnswerQuizInput,
): Promise<QuizAnswerResponse> {
  const entry = await quizSource().find(input.quizId)
  if (!entry) throw notFound('クイズが見つかりません')
  // 選択肢の数は出題ごとに違う。スキーマの上限（0〜9）だけでは足りない
  if (input.choiceIndex >= entry.options.length) throw badRequest('選択肢の範囲外です')

  const spot = await getSpot(ctx, input.areaId, input.spotId)
  if (!spot) throw notFound('スポットが見つかりません')
  /*
   * ★ 別のスポットのクイズIDを送って報酬だけ得る、という抜け道を塞ぐ。
   *
   * 出題はカテゴリで選んでいるので、カテゴリが違えばこのスポットの設問ではない。
   */
  if (entry.category !== spot.category) throw badRequest('このスポットのクイズではありません')

  const correct = input.choiceIndex === entry.answerIndex

  /*
   * ★ おためしは採点だけ返す。加点も正解状態もサーバーへ書かない。
   * 累計は画面が端末の記録へ加算する（`saved: false` がその合図）。
   */
  if (input.actor.kind === 'guest') {
    return {
      correct,
      answerIndex: entry.answerIndex,
      explanation: entry.explanation,
      pointsEarned: correct ? input.correctPoints : 0,
      totalPoints: 0,
      canRetry: !correct,
      saved: false,
    }
  }

  const userId = input.actor.userId
  const state = await getUserSpotState(ctx, userId, input.spotId)
  const alreadyCleared = state?.quizClearedAt !== undefined

  const profile = await getUser(ctx, userId)
  if (!profile) throw unauthorized('ユーザー情報が見つかりません。開き直してください')

  // 不正解、または報酬を受け取り済み。**書き込みは起こさない**
  if (!correct || alreadyCleared) {
    return {
      correct,
      answerIndex: entry.answerIndex,
      explanation: entry.explanation,
      pointsEarned: 0,
      totalPoints: profile.totalPoints,
      // ペナルティを課さないので、不正解ならいつでも再挑戦できる（G-7）
      canRetry: !correct,
      saved: false,
    }
  }

  const nowIso = new Date(input.now).toISOString()
  const totalPoints = profile.totalPoints + input.correctPoints

  await putUser(ctx, { ...profile, totalPoints, lastActiveAt: nowIso })

  /*
   * ★ チェックイン前にクイズへ正解した場合、`lastCheckinAt` は**空のまま**にする。
   * ここで時刻を入れると、そのスポットへ実際に行ったときに初回ボーナスが消える。
   */
  await putUserSpotState(ctx, userId, input.spotId, {
    lastCheckinAt: state?.lastCheckinAt,
    visitCount: state?.visitCount ?? 0,
    quizClearedAt: input.now,
  })

  return {
    correct: true,
    answerIndex: entry.answerIndex,
    explanation: entry.explanation,
    pointsEarned: input.correctPoints,
    totalPoints,
    canRetry: false,
    saved: true,
  }
}
