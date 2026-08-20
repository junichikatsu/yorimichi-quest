import { z } from 'zod'
import { avatarSchema } from './avatar.js'
import { MAX_EXPLORATION_POINTS, type ExplorationConfig, type ExplorationSummary, type ExploredTile, type UnlockedAreaBounds } from './exploration.js'
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

/**
 * キャラクターの見た目の更新（FR-01-6）。
 *
 * ★ 検証は `avatarSchema` に任せる。範囲外の番号を弾かないと、
 * 描画側で存在しない髪型を引いて落ちる。
 */
export const avatarUpdateRequestSchema = avatarSchema

export type AvatarUpdateRequest = z.infer<typeof avatarUpdateRequestSchema>

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
  /** 探索の寸法。FE は環境変数を持たないのでここから配る（FR-02-7） */
  exploration: ExplorationConfig
  /**
   * デモ用の移動操作を許すか。
   *
   * ★ これが true でも、LINE アプリ内では画面側が出さない。
   * URL が漏れたときにサーバー側から止められるようにするためのスイッチ。
   */
  debugMoveEnabled: boolean
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
  /**
   * 上限で打ち切られたか。
   *
   * ★ 黙って切らないために持たせている。データストアの query はサブキーの昇順で
   * 返すため、`spotId` の接頭辞（カテゴリ名）が辞書順で先のものだけが残り、
   * **カテゴリごと消える**。実際に aed だけが表示される事故が起きた。
   */
  truncated: boolean
}

export interface SpotResponse {
  spot: SpotWithDistance
}

/* ------------------------------------------------------------------ *
 * 探索（FR-02-7）
 * ------------------------------------------------------------------ */

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * 歩いた座標の記録。
 *
 * ★ 1リクエストの点数に上限を置く。書き込みはタイル単位に量子化されるので
 * 点をいくら送っても件数は増えないが、**リクエストの大きさは制限しないと
 * 無制限になる**。
 */
export const explorationRequestSchema = z.object({
  points: z.array(coordinateSchema).min(1).max(MAX_EXPLORATION_POINTS),
})

export type ExplorationRequest = z.infer<typeof explorationRequestSchema>

export interface ExplorationResponse {
  tiles: ExploredTile[]
  /** 全面が開放された町丁目（FR-02-7） */
  unlockedAreas: UnlockedAreaBounds[]
  summary: ExplorationSummary
}

export interface ExplorationUpdateResponse extends ExplorationResponse {
  /** 今回の記録で新しく増えたタイル数。0 なら書き込みは発生していない */
  newTileCount: number
}

/* ------------------------------------------------------------------ *
 * 管理（FR-10-2）
 * ------------------------------------------------------------------ */

/**
 * スポット投入の範囲。
 *
 * ★ 一息に全件入れない。データストアに一括投入が無く、**アクセス数に月次上限がある**ため、
 * 少しずつ入れて途中で止まっても再開できる形にしている。
 */
export const seedQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).optional(),
  /**
   * 1回で入れる件数。
   *
   * ★ 上限は控えめにしてある。既定の間隔（100ms）だと 200 件で 20 秒かかり、
   * それ以上は実行環境のタイムアウトに当たる。**大きな値を許すと必ず踏む。**
   */
  count: z.coerce.number().int().min(1).max(200).optional(),
  /**
   * 1件ごとの間隔（ミリ秒）。
   *
   * ★ 省略時は 0 ではない。**連続して速く書くとスロットリングされる**ため
   * （実測：間隔なしで約280件目で失敗）、既定で間隔を入れている。
   */
  delayMs: z.coerce.number().int().min(0).max(1000).optional(),
})

export type SeedQuery = z.infer<typeof seedQuerySchema>

export interface SeedResponse {
  area: AreaSummary
  total: number
  from: number
  to: number
  inserted: number
  /** 途中で止まった位置。undefined なら指定範囲を完走した */
  stoppedAt: number | undefined
  /** 次に指定する offset。null なら全件終わっている */
  nextOffset: number | null
  /** スロットリングで再試行した回数。0 でなければ間隔が足りていない */
  retries: number
  /** 最終的に使っていた間隔（ミリ秒）。詰まると自動で広がる */
  delayMs: number
}

/**
 * スポットの削除（やり直しのため）。
 *
 * ★ 総数は数えられない（データストアに集計が無い）ので、`hasMore` が false に
 * なるまで繰り返す形にしている。
 */
export const purgeQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(200).optional(),
  delayMs: z.coerce.number().int().min(0).max(1000).optional(),
})

export type PurgeQuery = z.infer<typeof purgeQuerySchema>

/**
 * 設定の確認（運用用）。
 *
 * ★ `/v1/health` は認証不要なのでキー名を出せない。件数だけでは
 * 「1件足りない」と分かっても何が足りないか分からず、実行環境のログを
 * 見に行くしかない。**管理キーで守った上で名前を返す。**
 */
export interface AdminConfigResponse {
  configOk: boolean
  /** 不足または不整合の識別子。値は返さない */
  missing: string[]
  /** 使っているエリア。取り違えの確認に使う */
  area: AreaSummary
  /** 投入するデータの出どころ */
  seedDataset: string
}

export interface PurgeResponse {
  area: AreaSummary
  deleted: number
  /** まだ残っている可能性があるか。true の間は繰り返す */
  hasMore: boolean
  retries: number
  delayMs: number
  /** 途中で止まったか */
  stopped: boolean
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
