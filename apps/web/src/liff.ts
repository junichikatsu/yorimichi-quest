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
export async function loginAndGetIdToken(liffId: string): Promise<string> {
  const liff = window.liff
  if (!liff) throw new LiffError('sdk-missing')
  if (liffId === '') throw new LiffError('no-liff-id')

  if (!initialized) {
    try {
      await liff.init({ liffId })
      initialized = true
    } catch {
      throw new LiffError('init-failed')
    }
  }

  if (!liff.isLoggedIn()) {
    liff.login()
    // リダイレクトが走るので、ここから先は実行されない。
    // 呼び出し側で「戻ってこない」ことを型で表せないため、待たせて終わらせる。
    await new Promise(() => {})
  }

  const idToken = liff.getIDToken()
  // ★ LIFF の設定で「メールアドレス」等のスコープを付けていないと null になる。
  // 権限不足を「原因不明のログイン失敗」にしないため、区別して投げる。
  if (idToken === null || idToken === '') throw new LiffError('no-id-token')

  return idToken
}

/** LINE アプリ内で開かれているか。外部ブラウザでの動作確認と区別する */
export function isInLineClient(): boolean {
  return window.liff?.isInClient() ?? false
}
