import { evaluateCheckin } from '@imanouchi/core'
import {
  appendCheckin,
  getSpot,
  getUser,
  getUserSpotState,
  incrementSpotCheckinCount,
  listUserSpotStates,
  putUser,
  putUserSpotState,
  type DataStoreContext,
} from '@imanouchi/datastore'
import { checkinItemFor, ITEM_DEFS, SPOT_CATEGORY_LABELS } from '@imanouchi/shared'
import type {
  AreaId,
  CardView,
  CheckinResponse,
  ProgressResponse,
  SpotId,
  SpotProgressEntry,
  UserId,
} from '@imanouchi/shared'
import { AppError, notFound, unauthorized } from '../errors.js'
import { grantCards, grantMissions, placeCardDef, type CardDefinition } from './card-service.js'
import { autoEquip } from './user-service.js'
import { withDistance } from './spot-service.js'
import type { Actor } from './actor.js'

/**
 * チェックイン（FR-03）。
 *
 * ★ 距離もクールダウンもポイントも**サーバーで決める**（NFR-04）。
 * クライアントから受け取るのは申告位置だけである。
 *
 * データストアのアクセス回数（制約 E4）: getItem × 3 + putItem × 4 = 7 回／回。
 * 判定に必要な読み取りを `user_spot_state` の 1 件に寄せ、履歴の走査を避けている。
 */

export interface PerformCheckinInput {
  actor: Actor
  areaId: AreaId
  spotId: SpotId
  position: { lat: number; lng: number }
  now: number
  radiusM: number
  cooldownHours: number
}

/**
 * チェックインで手に入る道具カード（FR-14-6・FR-07-8）。
 *
 * ★ スポットのカテゴリに紐づいた道具だけを渡す。カテゴリに対応する道具が無ければ
 * 何も渡さない（クイズ正解でしか手に入らない道具がある）。
 */
function toolCardForCategory(category: Parameters<typeof checkinItemFor>[0]): CardDefinition | undefined {
  const itemKey = checkinItemFor(category)
  if (itemKey === undefined) return undefined

  const def = ITEM_DEFS[itemKey]
  return {
    cardId: `tool:${itemKey}`,
    kind: 'tool',
    title: def.name,
    condition:
      def.fromCategory === null
        ? '現地のクイズに正解して手に入れる'
        : `${SPOT_CATEGORY_LABELS[def.fromCategory]}でチェックインして手に入れる`,
    body: def.use,
  }
}

export async function performCheckin(
  ctx: DataStoreContext,
  input: PerformCheckinInput,
): Promise<CheckinResponse> {
  const spot = await getSpot(ctx, input.areaId, input.spotId)
  if (!spot) throw notFound('スポットが見つかりません')

  /*
   * ★ おためし（ゲスト）は前回時刻を持たない。
   *
   * 記録をサーバーへ書かない設計なので、再チェックイン制限は**サーバーでは
   * 効かない**（画面側が端末の記録で抑える）。ここで嘘の状態を作らず、
   * 「前回が無い＝初回」としてそのまま扱う。
   */
  const state =
    input.actor.kind === 'line'
      ? await getUserSpotState(ctx, input.actor.userId, input.spotId)
      : undefined

  const decision = evaluateCheckin({
    now: input.now,
    userPosition: input.position,
    spot: { lat: spot.lat, lng: spot.lng },
    lastCheckinAt: state?.lastCheckinAt,
    radiusM: input.radiusM,
    cooldownMs: input.cooldownHours * 60 * 60 * 1000,
  })

  if (!decision.ok) {
    if (decision.reason === 'too_far') {
      // 距離は返す。画面が「あと何m」を出せないと、近づけばよいことが伝わらない
      throw new AppError('TOO_FAR', 409, 'スポットから離れすぎています', {
        distanceM: Math.round(decision.distanceM),
        radiusM: decision.radiusM,
      })
    }
    throw new AppError('COOLDOWN', 409, 'このスポットは時間をおいて再チェックインできます', {
      nextAvailableAt: new Date(decision.nextAvailableAt).toISOString(),
    })
  }

  const nextAvailableAt = new Date(decision.nextAvailableAt).toISOString()

  // ★ おためしはここで終わり。判定だけ返し、データストアへは一切書かない
  if (input.actor.kind === 'guest') {
    return {
      spot: withDistance(spot, input.position),
      distanceM: Math.round(decision.distanceM),
      pointsEarned: decision.pointsEarned,
      breakdown: decision.breakdown,
      // サーバーは累計を持たない。画面が端末の記録へ加算する
      totalPoints: 0,
      nextAvailableAt,
      visitCount: 1,
      /*
       * ★ おためしではカードを扱わない。
       *
       * 達成状態をサーバーが持たないと、**未達成カードの中身を隠す仕組み
       * （レスポンスから落とす・FR-14-3）が成立しない。** クライアントへ中身を
       * 渡してから隠す形にすると、配信されたデータを読めば分かってしまう。
       */
      acquiredCards: [],
      saved: false,
    }
  }

  const userId = input.actor.userId
  const profile = await getUser(ctx, userId)
  /*
   * ★ セッションは正しいのにユーザーが居ない場合。
   *
   * ここで空のプロフィールを作ってはいけない。LINE の表示名を持たない行が
   * できてしまい、以後のログインでも直らない。取り直せば `ensureUser` が通る。
   */
  if (!profile) throw unauthorized('ユーザー情報が見つかりません。開き直してください')

  const nowIso = new Date(input.now).toISOString()
  const visitCount = (state?.visitCount ?? 0) + 1

  // 履歴（FR-03）。スポット名と点数を非正規化して持つ（JOIN が無いため）
  await appendCheckin(ctx, userId, {
    checkinAt: input.now,
    spotId: spot.spotId,
    spotName: spot.name,
    pointsEarned: decision.pointsEarned,
    lat: input.position.lat,
    lng: input.position.lng,
  })

  // 再チェックイン制限と貢献度（FR-03-3・FR-03-4）
  await putUserSpotState(ctx, userId, input.spotId, {
    lastCheckinAt: input.now,
    visitCount,
    // ★ クイズの正解状態は引き継ぐ。ここで落とすと報酬を二重取りできる
    quizClearedAt: state?.quizClearedAt,
  })

  await putUser(ctx, {
    ...profile,
    totalPoints: profile.totalPoints + decision.pointsEarned,
    lastActiveAt: nowIso,
  })

  /*
   * カード（FR-14）。場所カードと、カテゴリに紐づく道具カードを達成させる。
   *
   * ★ ミッションの判定は**新しく達成したものがあるときだけ**行う。枚数が変わって
   * いないのに毎回数え直すと、チェックインごとに query が1回増える（制約 E4）。
   */
  const targets: CardDefinition[] = [placeCardDef(spot)]
  const toolCard = toolCardForCategory(spot.category)
  if (toolCard) targets.push(toolCard)

  const acquiredCards: CardView[] = await grantCards(ctx, userId, targets, nowIso)
  if (acquiredCards.length > 0) {
    acquiredCards.push(...(await grantMissions(ctx, userId, input.areaId, nowIso)))
  }

  /*
   * ★ 手に入れた道具は**空いているスロットにだけ**自動で装備する。
   * 見た目が変わらないと集めた実感が出ない。一方で、すでに身につけているものを
   * 置き換えると「選んだ装備が戻る」ことになるので、空きだけを埋める。
   */
  const equipped = autoEquip(
    {
      ...profile,
      totalPoints: profile.totalPoints + decision.pointsEarned,
      lastActiveAt: nowIso,
    },
    acquiredCards.map((card) => card.cardId.replace('tool:', '')),
  )
  await putUser(ctx, equipped)

  const updatedSpot = await incrementSpotCheckinCount(ctx, spot, nowIso)

  return {
    spot: withDistance(updatedSpot, input.position),
    distanceM: Math.round(decision.distanceM),
    pointsEarned: decision.pointsEarned,
    breakdown: decision.breakdown,
    totalPoints: profile.totalPoints + decision.pointsEarned,
    nextAvailableAt,
    visitCount,
    acquiredCards,
    saved: true,
  }
}

/**
 * 進み具合をまとめて返す（FR-03・FR-04）。
 *
 * ★ データストアのアクセスは **query 1 回**。スポットごとに引くと、訪れた数だけ
 * アクセスが増える（制約 E4）。
 *
 * ★ 次にチェックインできる時刻はここで計算する。クライアントに待ち時間を
 * 計算させると、設定を変えたときに古いバンドルだけ挙動が違う状態になる。
 */
export async function getProgress(
  ctx: DataStoreContext,
  input: { userId: UserId; cooldownHours: number; limit: number },
): Promise<ProgressResponse> {
  const cooldownMs = input.cooldownHours * 60 * 60 * 1000
  // 打ち切りを見分けるために1件多く引く（黙って切ると、切れた分のボタンが押せてしまう）
  const rows = await listUserSpotStates(ctx, input.userId, input.limit + 1)
  const truncated = rows.length > input.limit

  const spots: SpotProgressEntry[] = (truncated ? rows.slice(0, input.limit) : rows).map((row) => ({
    spotId: row.spotId,
    visitCount: row.visitCount,
    nextAvailableAt:
      row.lastCheckinAt === undefined
        ? undefined
        : new Date(row.lastCheckinAt + cooldownMs).toISOString(),
    quizCleared: row.quizClearedAt !== undefined,
  }))

  return { spots, truncated }
}
