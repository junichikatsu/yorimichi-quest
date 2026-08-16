import type { PointBreakdown } from '@yorimichi-sample/shared'
import { distanceMeters, type LatLng } from './geo.js'

/**
 * ポイント付与ルール（FR-07-1）。
 *
 * 値は暫定。確定は Issue #7「ゲームパラメータの確定」で行う。
 * サーバ側で一元管理し、クライアントからは変更できない。
 */
export const POINT_RULES = {
  checkinBase: 10,
  firstVisitBonus: 20,
} as const

/** 未開拓ゾーンの判定（FR-02-3）とポイント倍率（FR-02-4） */
export const EXPLORATION_TIERS = [
  { maxCheckinCount: 0, multiplier: 3 },
  { maxCheckinCount: 4, multiplier: 2 },
] as const

export interface ExplorationState {
  unexplored: boolean
  multiplier: number
}

export function classifyExploration(checkinCount: number): ExplorationState {
  for (const tier of EXPLORATION_TIERS) {
    if (checkinCount <= tier.maxCheckinCount) {
      return { unexplored: true, multiplier: tier.multiplier }
    }
  }
  return { unexplored: false, multiplier: 1 }
}

export interface CheckinInput {
  now: number
  userPosition: LatLng
  spot: LatLng & { checkinCount: number }
  /** この user × spot の前回チェックイン時刻（epoch ms）。初回は undefined */
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
 * チェックインの可否とポイントを決める純関数。
 *
 * データストアにも時刻にも依存しないので、境界値をそのままテストできる。
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

  const { multiplier } = classifyExploration(input.spot.checkinCount)
  const firstVisitBonus = input.lastCheckinAt === undefined ? POINT_RULES.firstVisitBonus : 0
  const breakdown: PointBreakdown = {
    base: POINT_RULES.checkinBase,
    multiplier,
    firstVisitBonus,
  }

  return {
    ok: true,
    distanceM,
    pointsEarned: POINT_RULES.checkinBase * multiplier + firstVisitBonus,
    breakdown,
    nextAvailableAt: input.now + input.cooldownMs,
  }
}
