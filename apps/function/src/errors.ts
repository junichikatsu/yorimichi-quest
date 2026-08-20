import {
  DataStoreConfigError,
  DataStoreConnectionError,
  DataStoreError,
} from '@imanouchi/datastore'
import type { ErrorCode, ErrorResponse } from '@imanouchi/shared'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: ContentfulStatusCode
  readonly details: Record<string, string | number | boolean> | undefined

  constructor(
    code: ErrorCode,
    status: ContentfulStatusCode,
    message: string,
    details?: Record<string, string | number | boolean>,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export const badRequest = (message: string, details?: Record<string, string | number | boolean>) =>
  new AppError('BAD_REQUEST', 400, message, details)

export const unauthorized = (message: string) => new AppError('UNAUTHORIZED', 401, message)

export const forbidden = (message: string) => new AppError('FORBIDDEN', 403, message)

export const notFound = (message: string) => new AppError('NOT_FOUND', 404, message)

/**
 * 例外をレスポンスへ変換する唯一の場所。
 *
 * 外部 SDK の生メッセージ・シークレットをレスポンスに出さないことをここで保証する。
 */
export function toErrorResponse(err: unknown, c: Context): Response {
  if (err instanceof AppError) {
    // 同一オリジン配信なので FE から素直に読める（別ホストなら Access-Control-Expose-Headers が要る）
    const retryAfterSec = err.details?.['retryAfterSec']
    if (typeof retryAfterSec === 'number') c.header('Retry-After', String(retryAfterSec))
    return c.json(body(err.code, err.message, err.details), err.status)
  }

  if (err instanceof DataStoreError) {
    // 分類（operation / kind / errorName）は出してよい。生メッセージは出さない。
    return c.json(
      body('DATASTORE_UNAVAILABLE', 'データストアにアクセスできませんでした', err.toDetails()),
      503,
    )
  }

  if (err instanceof DataStoreConnectionError) {
    // 実行環境の外で動かした / connectDataStore が無効、のいずれか
    return c.json(
      body('DATASTORE_UNAVAILABLE', 'データストアに接続できませんでした', err.toDetails()),
      503,
    )
  }

  if (err instanceof DataStoreConfigError) {
    // どのキーが不足しているかはレスポンスに出さない（ログ側で確認する）
    return c.json(body('CONFIG_ERROR', 'サーバー設定が不足しています', { scope: 'datastore' }), 500)
  }

  if (err instanceof ZodError) {
    return c.json(
      body('BAD_REQUEST', '入力値が不正です', {
        // パスのみ。入力値そのものは出さない。
        fields: err.issues.map((issue) => issue.path.join('.')).join(','),
      }),
      400,
    )
  }

  console.error('[unhandled]', err instanceof Error ? err.name : typeof err)
  return c.json(body('INTERNAL', '予期しないエラーが発生しました'), 500)
}

function body(
  code: ErrorCode,
  message: string,
  details?: Record<string, string | number | boolean>,
): ErrorResponse {
  return details ? { error: { code, message, details } } : { error: { code, message } }
}
