/**
 * LIFF（LINE Front-end Framework）の薄い包み（FR-01-1）。
 *
 * ★ SDK は LINE の CDN から読み込まれる（index.html）。npm 配布ではないため
 * バンドルできない。**読み込めていない場合を必ず扱う**。
 *
 * ★ ここは「IDトークンを取ってくる」だけに留める。ユーザーIDや表示名を
 * LIFF から取ってサーバーへ送ってはいけない。サーバーはトークンから
 * 自分で取り出す（クライアントの申告を信じない）。
 */

interface LiffSdk {
  init(config: { liffId: string }): Promise<void>
  isLoggedIn(): boolean
  login(config?: { redirectUri?: string }): void
  logout(): void
  getIDToken(): string | null
  isInClient(): boolean
}

declare global {
  interface Window {
    liff?: LiffSdk
  }
}

export type LiffFailure =
  | 'sdk-missing'
  | 'no-liff-id'
  | 'init-failed'
  | 'no-id-token'

export class LiffError extends Error {
  constructor(readonly reason: LiffFailure) {
    super(`liff: ${reason}`)
    this.name = 'LiffError'
  }
}

let initialized = false

/**
 * 初期化してIDトークンを返す。
 *
 * 未ログインなら LINE のログイン画面へ飛ばす。**この関数は戻ってこない**ことがある
 * （リダイレクトするため）。呼び出し側はそれを前提に書くこと。
 */
/**
 * 初期化だけを行う（ログインはしない）。
 *
 * ★ `isLoggedIn()` は初期化後でないと使えない。「すでにログイン済みか」を
 * 判断してから画面を出したい場合に、ここだけを先に呼ぶ。
 *
 * 二重に呼んでも 1 回しか初期化しない。
 */
export async function initLiff(liffId: string): Promise<void> {
  const liff = window.liff
  if (!liff) throw new LiffError('sdk-missing')
  if (liffId === '') throw new LiffError('no-liff-id')
  if (initialized) return

  try {
    await liff.init({ liffId })
    initialized = true
  } catch {
    throw new LiffError('init-failed')
  }
}

/**
 * すでに LINE ログイン済みか。
 *
 * ★ 判定できないときは false を返す（初期化に失敗した・SDK が無い等）。
 * ここで例外を投げると、**開き方を選ぶ画面すら出せずに行き止まりになる**。
 * false なら選択画面が出るだけで、そこから明示的にログインできる。
 */
export async function isLiffLoggedIn(liffId: string): Promise<boolean> {
  try {
    await initLiff(liffId)
    return window.liff?.isLoggedIn() ?? false
  } catch {
    return false
  }
}

export async function loginAndGetIdToken(liffId: string): Promise<string> {
  await initLiff(liffId)
  const liff = window.liff
  if (!liff) throw new LiffError('sdk-missing')

  if (!liff.isLoggedIn()) {
    liff.login()
    // リダイレクトが走るので、ここから先は実行されない。
    // 呼び出し側で「戻ってこない」ことを型で表せないため、待たせて終わらせる。
    await new Promise(() => {})
  }

  const idToken = liff.getIDToken()
  // ★ LIFF の設定で openid スコープが無いと null になる。
  // 権限不足を「原因不明のログイン失敗」にしないため、区別して投げる。
  if (idToken === null || idToken === '') throw new LiffError('no-id-token')

  return idToken
}

/**
 * ★ IDトークンは LIFF が保持したまま期限切れになる。
 *
 * `isLoggedIn()` は**セッションが残っていれば true を返す**ので、期限切れの
 * IDトークンをそのまま渡し続けることになる。サーバーが期限切れと言ってきたら、
 * ログアウトしてから入り直して**新しいIDトークンを発行させる**。
 *
 * ログアウトを挟むのは、`login()` だけでは保持している古い状態が使われうるため。
 *
 * この関数は**戻ってこない**（リダイレクトする）。
 */
const RELOGIN_MARK = 'imanouchi.relogin'

export function hasTriedRelogin(): boolean {
  try {
    return sessionStorage.getItem(RELOGIN_MARK) !== null
  } catch {
    // プライベートブラウズ等で sessionStorage が使えない場合は「試していない」とする
    return false
  }
}

export function clearReloginMark(): void {
  try {
    sessionStorage.removeItem(RELOGIN_MARK)
  } catch {
    // 消せなくても支障はない
  }
}

/**
 * 取り直す。
 *
 * ★ 一度だけ。印を付けてから飛ばす。付けずに繰り返すと、設定が壊れている場合に
 * **リダイレクトが無限に続く**（原因が分からないまま画面が点滅する）。
 */
export function forceRelogin(): void {
  const liff = window.liff
  if (!liff) throw new LiffError('sdk-missing')

  try {
    sessionStorage.setItem(RELOGIN_MARK, String(Date.now()))
  } catch {
    // 印を残せない環境では、繰り返しを防げないので取り直さない
    throw new LiffError('init-failed')
  }

  if (liff.isLoggedIn()) liff.logout()
  liff.login()
}

/** LINE アプリ内で開かれているか。外部ブラウザでの動作確認と区別する */
export function isInLineClient(): boolean {
  return window.liff?.isInClient() ?? false
}
