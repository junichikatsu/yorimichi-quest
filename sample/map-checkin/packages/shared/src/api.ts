import { z } from 'zod'
import type { AreaSummary, SpotWithDistance } from './spot.js'
import {
  MAX_EXPLORATION_POINTS,
  type ExplorationConfig,
  type ExplorationSummary,
  type ExploredTile,
} from './exploration.js'
import type { SpotId, UserId } from './ids.js'
import { avatarSchema, type Avatar } from './avatar.js'
import { equipmentSchema, type Equipment, type ItemDef, type ItemKey, type OwnedItem } from './item.js'
import type { QuizPrompt } from './quiz.js'

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

/**
 * 歩いた座標のまとめ送り。
 *
 * タイルへの量子化はサーバー側で行う（クライアントが送るのは生の座標だけ）。
 * 上限を超える分は 400 で弾く。黙って切り捨てると軌跡が欠けた理由が追えなくなる。
 */
export const explorationRequestSchema = z.object({
  points: z.array(coordinateSchema).min(1).max(MAX_EXPLORATION_POINTS),
})

export type ExplorationRequest = z.infer<typeof explorationRequestSchema>

export const avatarUpdateRequestSchema = avatarSchema

export type AvatarUpdateRequest = z.infer<typeof avatarUpdateRequestSchema>

export const equipmentUpdateRequestSchema = equipmentSchema

export type EquipmentUpdateRequest = z.infer<typeof equipmentUpdateRequestSchema>

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
    exploreTileSizeM: number
  }
}

/** フロントエンドは環境変数を持たないため、必要な設定はここから受け取る */
export interface ClientConfigResponse {
  mapboxToken: string
  area: AreaSummary
  checkinRadiusM: number
  checkinCooldownHours: number
  exploration: ExplorationConfig
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
  /** 今回はじめて手に入れたアイテム（FR-07-8）。既に持っていたら undefined */
  acquiredItem: ItemKey | undefined
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
    avatar: Avatar
    equipment: Equipment
  }
  recentCheckins: CheckinLog[]
}

export interface AvatarUpdateResponse {
  avatar: Avatar
}

export interface EquipmentUpdateResponse {
  equipment: Equipment
}

/** 所持一覧と全定義を一度に返す。定義は静的だがクライアントに持たせない（表示のブレを防ぐ） */
export interface ItemsResponse {
  owned: OwnedItem[]
  catalog: ItemDef[]
  equipment: Equipment
}

export interface QuizResponse {
  quiz: QuizPrompt
  /** このスポットのクイズで既にアイテムを獲得済みか（再挑戦は可能だが報酬は出ない） */
  alreadyCleared: boolean
}

export interface ExplorationResponse {
  tiles: ExploredTile[]
  summary: ExplorationSummary
}

export interface ExplorationUpdateResponse extends ExplorationResponse {
  /** 今回はじめて塗られたタイル数。0 なら既に歩いた範囲だった */
  newTileCount: number
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
