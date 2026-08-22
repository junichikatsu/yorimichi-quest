/**
 * 開き方を選ばせるかどうか（FR-01-7）。
 *
 * ★ 判定を純粋な関数に切り出してある。**「ミニアプリの中では選択肢を出さない」
 * ことをテストで固定したい**ため。画面の中に条件を書くと、条件が増えたときに
 * 検査できなくなる（`debug-move.ts` と同じ理由）。
 */

export interface StartContext {
  /** LINE アプリ（ミニアプリ）の中で開かれているか */
  inLineClient: boolean
  /** すでに LINE ログイン済みか（LIFF のセッションが生きているか） */
  liffLoggedIn: boolean
  /** サーバーがおためしを許しているか */
  guestModeEnabled: boolean
}

/**
 * 選択画面を出すか。
 *
 * ★ ミニアプリの中では出さない。中で開いているならログインは済んでおり、
 * 「ログインせずに試す」を選ばせる意味がない。**実利用者に迷いを増やすだけである。**
 *
 * ★ すでにログイン済みなら出さない。開くたびに聞かれるのは煩わしく、
 * 記録が残る側で続けられるならそのまま続けるのが正しい。
 *
 * ★ おためしが無効なら出さない。選べるものが 1 つしかない画面を挟む意味がない。
 * そのまま従来どおり LINE ログインへ進む。
 */
export function shouldOfferStartChoice(context: StartContext): boolean {
  if (context.inLineClient) return false
  if (context.liffLoggedIn) return false
  if (!context.guestModeEnabled) return false
  return true
}
