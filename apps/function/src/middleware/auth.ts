import { timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import { AppError, unauthorized } from '../errors.js'
import { loadConfig } from '../config.js'
import { verifySession } from '../services/session.js'
import type { AppEnv } from '../types.js'

/**
 * 認証（FR-01・NFR-04）。
 *
 * ★ ルートごとに書かず、1 箇所でまとめて適用する。
 * 各ルートで書く方式は、ルートを足したときに書き忘れる。**忘れられる防御は防御ではない。**
 */

/**
 * 認証を通さないパス。**末尾一致で判定する。**
 *
 * enebular の HTTP トリガーはトリガーのパスを前置してハンドラを呼ぶため、
 * 完全一致にすると本番だけ通らなくなる。
 */
const PUBLIC_SUFFIXES = ['/v1/health', '/v1/client-config', '/v1/auth/login']

export function isPublicPath(path: string): boolean {
  return PUBLIC_SUFFIXES.some((suffix) => path === suffix || path.endsWith(suffix))
}

export const ADMIN_KEY_HEADER = 'x-admin-key'

/**
 * 管理キーの照合。
 *
 * ★ `===` を使わない。文字列比較は先頭から突き合わせて一致した長さで所要時間が
 * 変わるため、繰り返せば1文字ずつ当てられる（タイミング攻撃）。
 * セッショントークンの検証と同じ扱いにしておく。
 *
 * 長さが違う場合に timingSafeEqual は例外を投げるので、先に弾く。
 * ここで長さが漏れるが、鍵の長さは秘密ではない。
 */
export function matchesAdminKey(provided: string | undefined, expected: string): boolean {
  if (expected === '' || provided === undefined) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function userGate(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (isPublicPath(c.req.path)) return next()

    const header = c.req.header('authorization') ?? ''
    // Bearer 以外は受け取らない。クエリ文字列でのトークン受け渡しも許さない
    // （URL はログや Referer に残る）
    const match = /^Bearer (.+)$/.exec(header.trim())
    if (!match?.[1]) throw unauthorized('Authorization ヘッダが必要です')

    const result = verifySession(match[1], loadConfig().sessionSecret)
    if (!result.ok) {
      // ★ 期限切れだけ別のコードにする。クライアントは再ログインで復帰できる
      if (result.reason === 'expired') {
        throw new AppError('TOKEN_EXPIRED', 401, 'ログインの有効期限が切れました')
      }
      throw unauthorized('トークンが不正です')
    }

    c.set('userId', result.userId)
    return next()
  }
}
