import { timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { AppError, unauthorized } from '../errors.js'
import { loadConfig } from '../config.js'
import type { Actor } from '../services/actor.js'
import { verifySession } from '../services/session.js'
import type { AppEnv } from '../types.js'

/**
 * 認証（FR-01・NFR-04）。
 *
 * ★ ルートごとに書かず、1 箇所でまとめて適用する。
 * 各ルートで書く方式は、ルートを足したときに書き忘れる。**忘れられる防御は防御ではない。**
 */

/**
 * LINE のセッショントークンを要求しないパス。**末尾一致で判定する。**
 *
 * enebular の HTTP トリガーはトリガーのパスを前置してハンドラを呼ぶため、
 * 完全一致にすると本番だけ通らなくなる。
 *
 * ★ `/v1/admin/seed` は「認証不要」ではない。**LINE ログインの代わりに管理キーで
 * 認証する。** 運用者が端末や CI から叩くものなので、LINE のセッションを要求すると
 * 呼べない（トークンを取るために LINE アプリを開く必要が出てしまう）。
 * 鍵は 32 バイトのランダム値で、照合はタイミング差の出ない比較で行う。
 */
const NO_SESSION_SUFFIXES = [
  '/v1/health',
  '/v1/client-config',
  '/v1/auth/login',
  // おためしの発行そのものはセッションを要求しない（発行するための入口）
  '/v1/auth/guest',
  // 開発用ログイン。ローカル（インメモリ実装）でしか経路が生えない
  '/v1/auth/dev',
  // カードの定義の一覧（開発用）。同じくローカルでしか通らない
  '/v1/dev/card-catalog',
  '/v1/admin/seed',
  '/v1/admin/purge',
  '/v1/admin/config',
  /*
   * ★ ダッシュボード（FR-09-5）。**認証なしの閲覧専用デモである。**
   *
   * 要件どおり行政の認証は将来拡張とし、いまは誰でも開ける。書き込む経路が無く、
   * 返すのは公開オープンデータと、検証済みになった集計だけである。
   * **個人を特定できるものは1つも通らない**（誰が答えたかはスポット側に無い）。
   */
  '/v1/dashboard/summary',
  '/v1/dashboard/export/verified.csv',
  '/v1/dashboard/export/gaps.csv',
  '/v1/dashboard/export/chome.csv',
]

export function skipsSessionGate(path: string): boolean {
  return NO_SESSION_SUFFIXES.some((suffix) => path === suffix || path.endsWith(suffix))
}

/**
 * おためし（ゲスト）でも通すパス。**許可制である。**
 *
 * ★ 禁止する側を並べてはいけない。ルートを足したときに書き忘れると、
 * **おためしの利用者がデータストアへ書けてしまう**。ここに書いたものだけを通す。
 *
 * 通すのは公開オープンデータの読み取りだけ。ユーザーごとの記録（探索・同意・
 * キャラクター）はすべて弾く。おためしの記録は端末の中だけに置く設計である。
 */
const GUEST_ALLOWED = [
  /\/v1\/spots$/,
  /\/v1\/spots\/[^/]+$/,
  /*
   * ★ チェックインとクイズは通すが、**サーバーへは何も書かない。**
   *
   * 判定と採点だけをサーバーで行う（クイズの正解をフロントへ渡せないため）。
   * 記録は端末の中だけに置く。書かないことは各サービスが `Actor` の種類を見て
   * 保証しており、ここは「呼べる／呼べない」だけを決める。
   *
   * ★ 通す代わりに、おためしでは**再チェックイン制限がサーバーで効かない。**
   * サーバーに前回時刻が無いためである。守る記録が無いので害はない。
   */
  /\/v1\/spots\/[^/]+\/checkin$/,
  /\/v1\/spots\/[^/]+\/quiz$/,
  /\/v1\/spots\/[^/]+\/quiz\/answer$/,
  /*
   * ★ 現地確認アンケート（FR-12）も通すが、**集計には一切足さない。**
   *
   * おためしは身元を持たないので、同じ端末から何度でも送れる。それを公開データに
   * 載る集計へ混ぜると、**検証済み（FR-06-2）という表示が意味を失う。**
   * 設問を見て答えて点数が出るところまでは体験させ、記録は端末の中だけに置く。
   * 書かないことは survey-service が `Actor` の種類を見て保証している。
   */
  /\/v1\/spots\/[^/]+\/survey$/,
]

export function allowsGuest(path: string): boolean {
  return GUEST_ALLOWED.some((pattern) => pattern.test(path))
}

/**
 * 誰の操作かを取り出す。
 *
 * ★ ルートで `c.get('userId')` を直接読まない。ゲストでは入っていないため、
 * 読んだ側が undefined を扱い忘れると**空のユーザーIDで書き込む**経路ができる。
 * 取り出し口を1つにして、型で分岐を強制する。
 */
export function actorOf(c: Context<AppEnv>): Actor {
  const userId = c.get('userId')
  return userId === undefined ? { kind: 'guest' } : { kind: 'line', userId }
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
    if (skipsSessionGate(c.req.path)) return next()

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

    if (result.subject.kind === 'guest') {
      /*
       * ★ ゲストは「読めるものだけ」を通す。
       *
       * 403 を返す理由まで書く。おためしで触れない機能があることは仕様なので、
       * 画面側が「ログインすれば使える」と案内できる必要がある。
       */
      if (!allowsGuest(c.req.path)) {
        throw new AppError(
          'FORBIDDEN',
          403,
          'おためし利用では使えません（LINEでログインすると使えます）',
        )
      }
      c.set('guestId', result.subject.guestId)
      return next()
    }

    c.set('userId', result.subject.userId)
    return next()
  }
}
