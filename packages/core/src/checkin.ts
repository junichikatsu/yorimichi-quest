import type { PointBreakdown } from '@imanouchi/shared'
import { distanceMeters, type LatLng } from './geo.js'

/**
 * チェックインの判定（FR-03）。
 *
 * ★ データストアにも時刻にも依存しない純関数として置く。
 * 「半径ちょうど100m」「クールダウンが切れた1ms後」のような境界は実機で
 * 確かめられない（歩いて再現できない）ため、**ここでテストできる形にしておく**。
 */

/**
 * ポイント付与ルール（FR-03-2）。
 *
 * ★ 値は暫定。確定は Issue #7「ゲームパラメータの確定」で行う。
 * ★ サーバー側で一元管理する。クライアントから倍率や点数を受け取ってはいけない。
 *
 * 初回ボーナスを基礎点より大きくしているのは、**同じ場所へ通うより新しい場所へ
 * 行くほうが得**にするため。データが埋まっていない場所を歩いてもらうのが
 * このサービスの目的である（要点 P-1）。
 */
export const POINT_RULES = {
  checkinBase: 10,
  firstVisitBonus: 20,
} as const

export interface CheckinInput {
  now: number
  userPosition: LatLng
  spot: LatLng
  /**
   * この利用者 × このスポットの前回チェックイン時刻（epoch ms）。
   * **初回は undefined**。初回ボーナスの判定にも使う。
   */
  lastCheckinAt: number | undefined
  radiusM: number
  cooldownMs: number
}

export type CheckinDecision =
  | {
      ok: true
      distanceM: number
      pointsEarned: number
      breakdown: PointBreakdown
      nextAvailableAt: number
    }
  | { ok: false; reason: 'too_far'; distanceM: number; radiusM: number }
  | { ok: false; reason: 'cooldown'; distanceM: number; nextAvailableAt: number }

/**
 * チェックインの可否とポイントを決める。
 *
 * ★ 距離を先に見る。クールダウン中でも「遠すぎる」を先に返すことで、
 * 圏外から叩いたときに**そのスポットへ過去に行ったかどうかが漏れない**。
 */
export function evaluateCheckin(input: CheckinInput): CheckinDecision {
  const distanceM = distanceMeters(input.userPosition, input.spot)

  // FR-03-1: スポットから半径 radiusM 以内にいる場合のみチェックインできる
  if (distanceM > input.radiusM) {
    return { ok: false, reason: 'too_far', distanceM, radiusM: input.radiusM }
  }

  // FR-03-3: 同一スポットへの再チェックインは一定時間制限する
  if (input.lastCheckinAt !== undefined) {
    const availableAt = input.lastCheckinAt + input.cooldownMs
    if (input.now < availableAt) {
      return { ok: false, reason: 'cooldown', distanceM, nextAvailableAt: availableAt }
    }
  }

  const firstVisitBonus = input.lastCheckinAt === undefined ? POINT_RULES.firstVisitBonus : 0
  const breakdown: PointBreakdown = {
    base: POINT_RULES.checkinBase,
    firstVisitBonus,
  }

  return {
    ok: true,
    distanceM,
    pointsEarned: breakdown.base + breakdown.firstVisitBonus,
    breakdown,
    nextAvailableAt: input.now + input.cooldownMs,
  }
}
