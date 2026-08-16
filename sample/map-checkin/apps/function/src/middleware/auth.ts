import { asUserId, isUserId } from '@map-checkin/shared'
import type { MiddlewareHandler } from 'hono'
import { unauthorized } from '../errors.js'
import type { AppEnv } from '../types.js'

/**
 * ★ これは認証ではない。サンプル用の識別子でしかない。
 *
 * 本番は LINE の LIFF ID トークンをサーバー側で検証する（要件定義書 NFR-04）。
 * サンプルではブラウザが crypto.randomUUID() で生成した ID をヘッダで送るだけなので、
 * 他人の ID を騙ることができる。公開環境に置かないこと。
 */
export const USER_ID_HEADER = 'x-sample-user-id'
export const ADMIN_KEY_HEADER = 'x-admin-key'

/** 認証不要のパス。末尾一致で判定する（トリガーのパスが前置されるため） */
const PUBLIC_SUFFIXES = ['/v1/health', '/v1/client-config']

export function isPublicPath(path: string): boolean {
  return PUBLIC_SUFFIXES.some((suffix) => path === suffix || path.endsWith(suffix))
}

/**
 * ルートごとに書かず、1 箇所でまとめて適用する。
 * 各ルートで書く方式だと、ルート追加時に書き忘れる。忘れられる防御は防御ではない。
 */
export function userGate(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (isPublicPath(c.req.path)) return next()

    const raw = c.req.header(USER_ID_HEADER)?.trim() ?? ''
    if (!isUserId(raw)) {
      throw unauthorized(`${USER_ID_HEADER} ヘッダが必要です`)
    }

    c.set('userId', asUserId(raw))
    return next()
  }
}
