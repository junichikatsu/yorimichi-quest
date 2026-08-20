import type { DataStoreOperation } from './types.js'

/**
 * SDK の失敗の伝え方は 2 通りある。両方をここ 1 箇所で分類する。
 *
 * | 投げられ方   | 意味                                                       | kind     |
 * | ------------ | ---------------------------------------------------------- | -------- |
 * | 文字列 throw | データストア操作がエラーを返した（テーブル不在・キー不正等） | 'failed' |
 * | Error throw  | プロキシ Lambda に到達できない（connectDataStore 無効等）    | 'threw'  |
 *
 * 各リポジトリで try/catch を書くと必ずどこかで抜けるため、runOp / runGet に集約する。
 */
export type DataStoreFailureKind = 'failed' | 'threw'

export class DataStoreError extends Error {
  readonly operation: DataStoreOperation
  readonly kind: DataStoreFailureKind
  readonly errorName: string

  constructor(operation: DataStoreOperation, kind: DataStoreFailureKind, errorName: string) {
    // ★ SDK の生メッセージはここに含めない。送信したアイテムの中身が含まれうる。
    super(`datastore ${operation} ${kind}`)
    this.name = 'DataStoreError'
    this.operation = operation
    this.kind = kind
    this.errorName = errorName
  }

  /** レスポンスに出してよい範囲の情報だけを返す */
  toDetails(): Record<string, string> {
    return { operation: this.operation, kind: this.kind, errorName: this.errorName }
  }
}

/**
 * データストアのクライアントを生成できない。
 *
 * CloudDataStoreClient のコンストラクタは ENEBULAR_DS_JWT / ENEBULAR_DS_PROXY_ARN が
 * 無いと throw する。実行環境の外で動かした場合や connectDataStore が無効な場合がこれにあたる。
 * 「予期しないエラー(500)」ではなく「データストアに繋がらない(503)」として扱えるよう型を分ける。
 */
export class DataStoreConnectionError extends Error {
  readonly errorName: string

  constructor(errorName: string) {
    super('datastore client is unavailable')
    this.name = 'DataStoreConnectionError'
    this.errorName = errorName
  }

  toDetails(): Record<string, string> {
    return { reason: 'client_init', errorName: this.errorName }
  }
}

/** テーブル ID が環境変数から解決できない。起動は止めず、リクエスト単位のエラーにする。 */
export class DataStoreConfigError extends Error {
  readonly envKey: string

  constructor(envKey: string) {
    super(`datastore table id is not configured`)
    this.name = 'DataStoreConfigError'
    this.envKey = envKey
  }
}

function rawMessageOf(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  return ''
}

/**
 * 「アイテムが無い」を表すエラーかどうか。
 *
 * getItem はアイテムが無いときエラーを返す。初回サインアップや未生成レコードでは
 * 「無い」が正常系なので、ここを 503 にすると初回アクセスが原理的に成立しない。
 */
export function isNotFoundError(err: unknown): boolean {
  return /not\s*found/i.test(rawMessageOf(err))
}

/**
 * 失敗理由の記述をログへ出す長さの上限。
 *
 * ★ SDK の生メッセージには送信したアイテムの記述が混ざりうるため、
 * レスポンスには出さず、ログにも頭だけを出す。
 */
const REASON_LOG_LIMIT = 300

/**
 * ★ 失敗理由の記述を捨てない。
 *
 * SDK は操作エラーを**文字列のまま** throw する。分類（`failed`）だけ取り出して
 * 文字列を捨てると、「テーブルが無い」「キー名が違う」「上限に達した」がすべて
 * 同じ `failed` に見え、**本番で切り分けられなくなる**。
 *
 * レスポンスには出さない（アイテムの記述が混ざりうる）。実行環境のログには
 * 頭 300 文字までに切って出す。
 */
function logReason(operation: DataStoreOperation, reason: string): void {
  const head = reason.slice(0, REASON_LOG_LIMIT)
  console.warn(`[datastore] ${operation} failed: ${head}`)
}

export function classifyDataStoreError(operation: DataStoreOperation, err: unknown): DataStoreError {
  if (typeof err === 'string') {
    // 文字列 throw = 操作自体は届いたが失敗した（テーブル不在・キー不正・上限など）
    logReason(operation, err)
    return new DataStoreError(operation, 'failed', 'DataStoreOperationError')
  }
  if (err instanceof Error) {
    // 到達できない側。message には接続情報が入りうるので name だけ出す
    console.warn(`[datastore] ${operation} unreachable: ${err.name || 'Error'}`)
    return new DataStoreError(operation, 'threw', err.name || 'Error')
  }
  return new DataStoreError(operation, 'threw', 'UnknownError')
}
