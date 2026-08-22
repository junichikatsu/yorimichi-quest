import { useEffect, useState } from 'react'
import { WAITING_MESSAGES, type WaitingKind } from '../overlay.js'

interface WaitingOverlayProps {
  kind: WaitingKind
}

/**
 * 印と文字を出すまでの猶予（ミリ秒）。
 *
 * ★ **すぐに出してはいけない。** 速いときの応答は実測で 1〜16ms（ローカルの
 * インメモリ実装）である。そこで覆いを見せると、チェックインのたびに暗幕が
 * 一瞬ちらつくだけになり、**遅さを伝えるどころか画面が汚くなる。**
 *
 * ★ 猶予のあいだも**操作は止めている**（下記）。「見せない」と「止めない」を
 * 一緒にすると、押した直後の二度押しが通ってしまう。
 */
const APPEAR_AFTER_MS = 250

/**
 * サーバーを待っているあいだの覆い。
 *
 * ★ **押したのに何も起きない**時間を無くすためにある。チェックインの記録も
 * アンケートの読み込みも、通信が遅いときは待たされる。その間画面に何も出ていないと、
 * 押せていないのだと思ってもう一度押される（**二重に記録しようとして 409 になり、
 * エラーの知らせだけが出る**）。
 *
 * ★ 二段構えにしてある。
 *
 * 1. **出た瞬間から操作を止める**（透明なまま画面を覆う）。二度押しを防ぐのは
 *    こちらの役目で、速い応答でも効いている必要がある
 * 2. 猶予（250ms）を過ぎてから**印と文字を見せる**。速いときは何も見えない
 *
 * ★ 順番の判定（`overlayStep`）に組み込んであるので、待っているあいだは演出も面も
 * 出ない。重なることがない。
 *
 * ★ 閉じる操作は置かない。押しても取り消せない（サーバーへ既に送っている）ので、
 * 閉じられる形にすると**記録されたのに記録されていない画面**を作ることになる。
 */
export function WaitingOverlay({ kind }: WaitingOverlayProps): React.JSX.Element {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), APPEAR_AFTER_MS)
    return () => clearTimeout(timer)
  }, [kind])

  return (
    <div
      className={shown ? 'waiting waiting--shown' : 'waiting'}
      /*
       * ★ 読み上げの領域は**最初から置いておく**。中身が入ってから領域を作ると、
       * 読み上げが追いつかず何も読まれないことがある。空のまま置き、
       * 見せる段になって文を入れる（NFR-08）。
       */
      role="status"
      aria-live="polite"
      aria-busy={true}
    >
      {shown && (
        <div className="waiting__box">
          {/* 印は装飾。文言だけでも成立させる（読み上げでは二重に読まない） */}
          <span className="waiting__spinner" aria-hidden="true" />
          <p className="waiting__label">{WAITING_MESSAGES[kind]}…</p>
        </div>
      )}
    </div>
  )
}
