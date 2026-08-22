import {
  addSurveyAnswers,
  getSpot,
  getUser,
  getUserSpotState,
  putUser,
  putUserSpotState,
  type DataStoreContext,
} from '@imanouchi/datastore'
import {
  applyAnswers,
  checkinItemFor,
  consensusOf,
  fillFieldCount,
  intentOf,
  isSurveyValue,
  ITEM_DEFS,
  SPOT_CATEGORY_LABELS,
  SURVEY_NOTE_MAX_LENGTH,
  surveyFormFor,
  toCardId,
  type AreaId,
  type CardView,
  type Spot,
  type SpotId,
  type SurveyAnswerResponse,
  type SurveyFieldView,
  type SurveyResponse,
  type SurveyStats,
  type SurveyValue,
} from '@imanouchi/shared'
import { badRequest, notFound, unauthorized } from '../errors.js'
import { grantCards, grantMissions, type CardDefinition } from './card-service.js'
import type { Actor } from './actor.js'

/**
 * スポットの現地確認アンケート（FR-12）。
 *
 * ★ **このサービスが集めているデータの実体はここだけである。** チェックイン
 * （FR-03）とクイズ（FR-04）は行政データを1件も増やさない。要点 P-1 と
 * 競争優位 UA-1 を名乗る根拠は、この経路が回ることに依存している。
 *
 * ★ 付与ポイントは**答えの中身では変わらない**（下の `pointsFor` を参照）。
 * ここが設計の要点である。
 *
 * ★ 1人1スポット1回に限る。同じ人が答え直せる形にすると、集計から差し引く処理が
 * 必要になり、そこが報酬と閾値（FR-06-2）の操作口になる。
 *
 * データストアのアクセス回数（制約 E4）:
 * - 取得: getItem × 2（スポット・自分の状態）
 * - 送信: getItem × 3 + putItem × 3 = 6 回（＋カードぶん）
 */

export interface SurveyPointRules {
  /** 回答1回あたりの基礎点 */
  base: number
  /** 「行政データが空の項目」1件あたりの上乗せ（FR-12-4） */
  fillBonus: number
  /** 検証済みにするのに必要な同じ答えの数（FR-06-2） */
  consensus: number
}

/**
 * 付与ポイント（FR-12-4・G-6）。
 *
 * ★ **答えた内容ではなく、スポットの欠損の数で決める。** 「はい／いいえ」に
 * 加点して「わからない」に加点しない形にすると、**分からないのに断定する動機**を
 * 作る。それは公開データの精度をそのまま落とす。倍率の根拠は「行政データが
 * どれだけ空か」であって、利用者がどう答えたかではない。
 *
 * ★ 労力に比例させる（G-6）。属性が1件も無い AED（224件）が最も高くなる。
 */
export function pointsFor(spot: Pick<Spot, 'attributes' | 'category'>, rules: SurveyPointRules): number {
  return rules.base + rules.fillBonus * fillFieldCount(spot)
}

/**
 * アンケートで手に入る道具カード（FR-14-6・FR-07-8）。
 *
 * ★ **チェックインから移してある。** 以前はチェックインで渡していたが、
 * 「立ち止まって現地を見る」ことに報いる先はアンケートである（G-6）。
 * チェックインには場所カードが残る。
 */
function toolCardForCategory(spot: Spot): CardDefinition | undefined {
  const itemKey = checkinItemFor(spot.category)
  if (itemKey === undefined) return undefined

  const def = ITEM_DEFS[itemKey]
  return {
    cardId: toCardId('tool', itemKey),
    kind: 'tool',
    title: def.name,
    condition:
      def.fromCategory === null
        ? '現地のクイズに正解して手に入れる'
        : `${SPOT_CATEGORY_LABELS[def.fromCategory]}で現地のアンケートに答えて手に入れる`,
    body: def.use,
  }
}

/** 保存の形（`<項目キー>:<値>`）から回答へ戻す */
function parseAnswers(entries: readonly string[]): Record<string, SurveyValue> {
  const answers: Record<string, SurveyValue> = {}

  for (const entry of entries) {
    const index = entry.lastIndexOf(':')
    if (index <= 0) continue
    const fieldKey = entry.slice(0, index)
    const value = entry.slice(index + 1)
    if (isSurveyValue(value)) answers[fieldKey] = value
  }

  return answers
}

function formatAnswers(answers: Readonly<Record<string, SurveyValue>>): string[] {
  return Object.entries(answers).map(([fieldKey, value]) => `${fieldKey}:${value}`)
}

/* ------------------------------------------------------------------ *
 * 設問を出す
 * ------------------------------------------------------------------ */

export interface GetSurveyInput {
  actor: Actor
  areaId: AreaId
  spotId: SpotId
  rules: SurveyPointRules
}

export async function getSurvey(
  ctx: DataStoreContext,
  input: GetSurveyInput,
): Promise<SurveyResponse> {
  const spot = await getSpot(ctx, input.areaId, input.spotId)
  if (!spot) throw notFound('スポットが見つかりません')

  /*
   * ★ おためし（ゲスト）は回答状態を持たない（サーバーへ書かないため）。
   * 常に未回答として扱う。
   */
  const state =
    input.actor.kind === 'line'
      ? await getUserSpotState(ctx, input.actor.userId, input.spotId)
      : undefined

  const form = surveyFormFor(spot.category)

  const fields: SurveyFieldView[] = form.fields.map((field) => ({
    fieldKey: field.fieldKey,
    question: field.question,
    yesLabel: field.yesLabel,
    noLabel: field.noLabel,
    why: field.why,
    // FR-12-2：行政データが空なら「埋める」、記載があるなら「確かめる」
    intent: intentOf(field, spot),
    /*
     * ★ 件数だけを返す。誰がどう答えたかは返さない（他人の回答は本人以外に
     * 見せる必要がなく、見せれば同調して答える動機になる）。
     */
    consensus: consensusOf(spot.surveyStats, field.fieldKey, input.rules.consensus),
  }))

  return {
    spotId: spot.spotId,
    spotName: spot.name,
    title: form.title,
    fields,
    notePlaceholder: form.notePlaceholder,
    noteMaxLength: SURVEY_NOTE_MAX_LENGTH,
    alreadyAnswered: state?.surveyAnsweredAt !== undefined,
    myAnswers: parseAnswers(state?.surveyAnswers ?? []),
    pointsIfAnswered: pointsFor(spot, input.rules),
  }
}

/* ------------------------------------------------------------------ *
 * 回答を受ける
 * ------------------------------------------------------------------ */

export interface SubmitSurveyInput {
  actor: Actor
  areaId: AreaId
  spotId: SpotId
  answers: Readonly<Record<string, SurveyValue>>
  note: string
  now: number
  rules: SurveyPointRules
}

export async function submitSurvey(
  ctx: DataStoreContext,
  input: SubmitSurveyInput,
): Promise<SurveyAnswerResponse> {
  const spot = await getSpot(ctx, input.areaId, input.spotId)
  if (!spot) throw notFound('スポットが見つかりません')

  const form = surveyFormFor(spot.category)
  const known = new Set(form.fields.map((field) => field.fieldKey))

  /*
   * ★ このスポットの設問に無いキーは弾く（黙って捨てない）。
   *
   * 捨てる形にすると、綴りを間違えた回答が「送れたのに1件も記録されない」という
   * 分かりにくい失敗になる。**別カテゴリの項目キーで集計を膨らませる**経路も
   * ここで閉じる。
   */
  const answers: Record<string, SurveyValue> = {}
  for (const [fieldKey, value] of Object.entries(input.answers)) {
    if (!known.has(fieldKey)) throw badRequest('このスポットの設問ではありません')
    answers[fieldKey] = value
  }

  const recordedCount = Object.keys(answers).length
  const pointsEarned = pointsFor(spot, input.rules)

  /*
   * ★ おためしは点数だけ返す。集計にも本人の記録にも書かない。
   *
   * 累計は画面が端末の記録へ加算する（`saved: false` がその合図）。
   * **公開データに載る集計へ、身元のない回答を混ぜない**という意味でもある。
   */
  if (input.actor.kind === 'guest') {
    return {
      pointsEarned,
      totalPoints: 0,
      recordedCount,
      verifiedFieldKeys: [],
      // ★ おためしではカードを扱わない（未達成の中身を隠す仕組みが成立しないため）
      acquiredCards: [],
      saved: false,
    }
  }

  const userId = input.actor.userId
  const state = await getUserSpotState(ctx, userId, input.spotId)

  /*
   * ★ 二重計上を止める唯一の場所である。
   *
   * スポット側の集計には加算しか無いので、ここを通されると1人で閾値
   * （FR-06-2）を越えられ、**検証済みという表示が意味を失う。**
   */
  if (state?.surveyAnsweredAt !== undefined) {
    throw badRequest('このスポットのアンケートには回答済みです')
  }

  const profile = await getUser(ctx, userId)
  if (!profile) throw unauthorized('ユーザー情報が見つかりません。開き直してください')

  const nowIso = new Date(input.now).toISOString()

  /*
   * 集計を進める（FR-06-2）。
   *
   * ★ 「今回はじめて閾値へ達した項目」は**前後を比べて出す**。画面側で差分を
   * 取る作りにすると、読み込み直しで演出が消えたり二重に出たりする。
   */
  const nextStats: SurveyStats = applyAnswers(spot.surveyStats, answers)
  const verifiedFieldKeys = Object.keys(answers).filter((fieldKey) => {
    const before = consensusOf(spot.surveyStats, fieldKey, input.rules.consensus)
    const after = consensusOf(nextStats, fieldKey, input.rules.consensus)
    return before.status !== 'verified' && after.status === 'verified'
  })

  /*
   * ★ 本人の記録を**先に**書く。
   *
   * 集計を先に書いて本人の記録に失敗すると、「集計は増えたのに未回答扱い」に
   * なり、同じ人が何度でも増やせる状態が残る。逆（本人だけ書けて集計が漏れる）は
   * 1件数え落とすだけで、閾値へ届くのが遅れるだけである。**壊れ方の軽い順に書く。**
   */
  await putUserSpotState(ctx, userId, input.spotId, {
    // ★ チェックイン状態は引き継ぐ。落とすと初回ボーナスとクールダウンが壊れる
    lastCheckinAt: state?.lastCheckinAt,
    visitCount: state?.visitCount ?? 0,
    quizClearedAt: state?.quizClearedAt,
    surveyAnsweredAt: input.now,
    surveyAnswers: formatAnswers(answers),
    // 上限は zod で検査済み。ここでは切らない（切ると黙って中身が変わる）
    surveyNote: input.note,
  })

  await addSurveyAnswers(ctx, spot, nextStats, nowIso)

  const totalPoints = profile.totalPoints + pointsEarned
  await putUser(ctx, { ...profile, totalPoints, lastActiveAt: nowIso })

  /*
   * カード（FR-14）。カテゴリに紐づく道具カードをここで渡す。
   *
   * ★ ミッションの判定は新しく達成したものがあるときだけ行う（制約 E4）。
   */
  const toolCard = toolCardForCategory(spot)
  const acquiredCards: CardView[] = toolCard
    ? await grantCards(ctx, userId, [toolCard], nowIso)
    : []
  if (acquiredCards.length > 0) {
    acquiredCards.push(...(await grantMissions(ctx, userId, input.areaId, nowIso)))
  }

  return {
    pointsEarned,
    totalPoints,
    recordedCount,
    verifiedFieldKeys,
    acquiredCards,
    saved: true,
  }
}
