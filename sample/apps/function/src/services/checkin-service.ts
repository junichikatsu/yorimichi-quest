import { evaluateCheckin } from '@yorimichi-sample/core'
import {
  appendCheckin,
  getSpot,
  getUser,
  getUserSpotState,
  incrementSpotCheckinCount,
  putUser,
  putUserSpotState,
  type DataStoreContext,
  type UserProfile,
} from '@yorimichi-sample/datastore'
import type { AreaId, CheckinResponse, SpotId, UserId } from '@yorimichi-sample/shared'
import { AppError, notFound } from '../errors.js'
import { decorateSpot } from './spot-service.js'

export interface PerformCheckinInput {
  userId: UserId
  areaId: AreaId
  spotId: SpotId
  position: { lat: number; lng: number }
  now: number
  radiusM: number
  cooldownHours: number
}

/**
 * チェックインの一連の流れ（FR-03）。
 *
 * データストアのアクセス回数（E4）: getItem × 3 + putItem × 4 = 7 回／チェックイン。
 * 判定に必要な読み取りを user_spot_state の 1 件に寄せることで、履歴の走査を避けている。
 */
export async function performCheckin(
  ctx: DataStoreContext,
  input: PerformCheckinInput,
): Promise<CheckinResponse> {
  const spot = await getSpot(ctx, input.areaId, input.spotId)
  if (!spot) throw notFound('スポットが見つかりません')

  const state = await getUserSpotState(ctx, input.userId, input.spotId)
  const cooldownMs = input.cooldownHours * 60 * 60 * 1000

  const decision = evaluateCheckin({
    now: input.now,
    userPosition: input.position,
    spot: { lat: spot.lat, lng: spot.lng, checkinCount: spot.checkinCount },
    lastCheckinAt: state?.lastCheckinAt,
    radiusM: input.radiusM,
    cooldownMs,
  })

  if (!decision.ok) {
    if (decision.reason === 'too_far') {
      throw new AppError('TOO_FAR', 409, 'スポットから離れすぎています', {
        distanceM: Math.round(decision.distanceM),
        radiusM: decision.radiusM,
      })
    }
    throw new AppError('COOLDOWN', 409, 'このスポットは時間をおいて再チェックインできます', {
      nextAvailableAt: new Date(decision.nextAvailableAt).toISOString(),
    })
  }

  const nowIso = new Date(input.now).toISOString()

  const profile: UserProfile = (await getUser(ctx, input.userId)) ?? {
    userId: input.userId,
    displayName: 'サンプルプレイヤー',
    totalPoints: 0,
    checkinCount: 0,
    createdAt: nowIso,
    lastActiveAt: nowIso,
  }

  const updatedProfile: UserProfile = {
    ...profile,
    totalPoints: profile.totalPoints + decision.pointsEarned,
    checkinCount: profile.checkinCount + 1,
    lastActiveAt: nowIso,
  }

  await appendCheckin(ctx, input.userId, {
    checkinAt: input.now,
    spotId: spot.spotId,
    spotName: spot.name,
    pointsEarned: decision.pointsEarned,
    lat: input.position.lat,
    lng: input.position.lng,
  })

  await putUserSpotState(ctx, input.userId, input.spotId, {
    lastCheckinAt: input.now,
    visitCount: (state?.visitCount ?? 0) + 1,
  })

  await putUser(ctx, updatedProfile)

  const updatedSpot = await incrementSpotCheckinCount(ctx, spot, nowIso)

  return {
    spot: decorateSpot(updatedSpot, input.position),
    distanceM: Math.round(decision.distanceM),
    pointsEarned: decision.pointsEarned,
    breakdown: decision.breakdown,
    totalPoints: updatedProfile.totalPoints,
    nextAvailableAt: new Date(decision.nextAvailableAt).toISOString(),
  }
}
