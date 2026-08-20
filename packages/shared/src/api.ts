import { z } from 'zod'
import type { AreaSummary, SpotWithDistance } from './spot.js'
import type { UserView } from './user.js'

/**
 * HTTP の入出力。
 *
 * 入力は zod で検証し、出力は型だけを共有する。
 * ★ サーバーとクライアントで同じ定義を使うので、片方だけ直して壊れることがない。
 */

/* ------------------------------------------------------------------ *
 * エラー
 * ------------------------------------------------------------------ */

/**
 * エラーコード。
 *
 * ★ 文字列そのままにせず列挙する。クライアントは code で分岐するので、
 * 綴りを間違えると「分岐しているつもりで常に else」になり、静かに壊れる。
 *
 * TOKEN_EXPIRED を UNAUTHORIZED と分けているのは、**再ログインで直るのか
 * 権限が無いのか**をクライアントが判断する必要があるため（FR-01）。
 */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'CONFIG_ERROR',
  'DATASTORE_UNAVAILABLE',
  'UPSTREAM_ERROR',
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

/* ------------------------------------------------------------------ *
 * 認証（FR-01）
 * ------------------------------------------------------------------ */

/**
 * ログイン要求。
 *
 * ★ 送るのは LIFF が発行した **IDトークン**だけである。
 * userId や表示名をクライアントから受け取ってはいけない。受け取ると
 * 他人を名乗れてしまう。名前も含めてすべてトークンから取り出す。
 */
export const loginRequestSchema = z.object({
  idToken: z.string().min(1).max(4096),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

export interface LoginResponse {
  /** 以降のリクエストに Bearer で付ける、このアプリ用のトークン */
  token: string
  /** トークンの失効時刻（ISO8601）。切れたら再ログインする */
  expiresAt: string
  user: UserView
  /** 初回ログインで登録されたか（FR-01-1）。同意画面の出し分けに使う */
  registered: boolean
}

export interface MeResponse {
  user: UserView
}

/** 位置情報の同意（FR-01-4） */
export const consentRequestSchema = z.object({
  /** 同意したかどうか。false は撤回 */
  granted: z.boolean(),
})

export type ConsentRequest = z.infer<typeof consentRequestSchema>

/* ------------------------------------------------------------------ *
 * 設定
 * ------------------------------------------------------------------ */

/** スポットの出典（FR-10-2）。ライセンスが出典明記を求めるため表示は必須 */
export interface DataSourceCredit {
  title: string
  /** 空文字はリンク無し */
  url: string
  /** 空文字は取得日なし */
  fetchedAt: string
}

/**
 * クライアントが起動時に必要な値。
 *
 * ★ フロントエンドは環境変数を持たない。LIFF ID も Mapbox のトークンもここから配る。
 * ビルド時に埋め込むと、値を変えるたびに再ビルドが必要になる。
 */
export interface ClientConfigResponse {
  liffId: string
  mapboxToken: string
  area: AreaSummary
  dataSources: DataSourceCredit[]
  /** 架空のサンプルデータで動いているか。画面の断り書きを切り替える */
  usesSampleData: boolean
  /** 静的ファイルのキャッシュ破棄に使う */
  assetVersion: string
}

/* ------------------------------------------------------------------ *
 * スポット（FR-02）
 * ------------------------------------------------------------------ */

/**
 * 現在地は任意。渡されたときだけ距離を計算して近い順に並べる。
 *
 * ★ 位置で絞り込みはしない。エリア内の全件を返す。データストアに地理検索が
 * 無いので絞り込めないという事情もあるが、**全件返すほうが移動中の再取得を
 * 減らせる**（距離はクライアントで計算し直せる）。
 */
export const spotsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
})

export type SpotsQuery = z.infer<typeof spotsQuerySchema>

export interface SpotsResponse {
  area: AreaSummary
  spots: SpotWithDistance[]
}

export interface SpotResponse {
  spot: SpotWithDistance
}

/* ------------------------------------------------------------------ *
 * 死活確認
 * ------------------------------------------------------------------ */

export interface HealthResponse {
  status: 'ok'
  version: string
  commit: string
  builtAt: string
  /** 設定が揃っているか。**不足しているキー名は出さない** */
  configOk: boolean
  configMissing: number
}
