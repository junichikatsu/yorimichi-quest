import { z } from 'zod'
import type { AreaSummary, SpotWithDistance } from './spot.js'
import type { SpotId, UserId } from './ids.js'

/* ------------------------------------------------------------------ *
 * リクエストスキーマ（サーバ側の入力検証。FE とスキーマを共有する）
 * ------------------------------------------------------------------ */

export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const checkinRequestSchema = coordinateSchema

export type CheckinRequest = z.infer<typeof checkinRequestSchema>

export const spotsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export type SpotsQuery = z.infer<typeof spotsQuerySchema>

/* ------------------------------------------------------------------ *
 * レスポンス型（= API 契約）
 * ------------------------------------------------------------------ */

export interface HealthResponse {
  status: 'ok'
  version: string
  commit: string
  builtAt: string
  mockMode: boolean
  configOk: boolean
  /** 件数のみ。認証不要のエンドポイントなのでキー名は出さない */
  configMissing: number
  limits: {
    checkinRadiusM: number
    checkinCooldownHours: number
    maxSpotsPerRequest: number
    rateLimitPerMinute: number
  }
}

/** フロントエンドは環境変数を持たないため、必要な設定はここから受け取る */
export interface ClientConfigResponse {
  mapboxToken: string
  area: AreaSummary
  checkinRadiusM: number
  checkinCooldownHours: number
  assetVersion: string
  mockMode: boolean
}

export interface SpotsResponse {
  area: AreaSummary
  spots: SpotWithDistance[]
}

export interface SpotResponse {
  spot: SpotWithDistance
}

export interface PointBreakdown {
  base: number
  multiplier: number
  firstVisitBonus: number
}

export interface CheckinResponse {
  spot: SpotWithDistance
  distanceM: number
  pointsEarned: number
  breakdown: PointBreakdown
  totalPoints: number
  /** 再チェックイン可能になる時刻（ISO8601, FR-03-3） */
  nextAvailableAt: string
}

export interface CheckinLog {
  checkinAt: string
  spotId: SpotId
  spotName: string
  pointsEarned: number
}

export interface MeResponse {
  user: {
    userId: UserId
    displayName: string
    totalPoints: number
    checkinCount: number
    createdAt: string
  }
  recentCheckins: CheckinLog[]
}

export interface SeedResponse {
  area: AreaSummary
  inserted: number
  skipped: number
}

/* ------------------------------------------------------------------ *
 * エラー
 * ------------------------------------------------------------------ */

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'TOO_FAR',
  'COOLDOWN',
  'RATE_LIMITED',
  'CONFIG_ERROR',
  'DATASTORE_UNAVAILABLE',
  'INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    /** 診断用の付帯情報。シークレットや外部 SDK の生メッセージは絶対に入れない */
    details?: Record<string, string | number | boolean>
  }
}
