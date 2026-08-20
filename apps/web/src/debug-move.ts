import type { GeolocationStatus } from './hooks/useGeolocation.js'

/**
 * デモ用の移動操作（ジョイスティック）を出すかどうか。
 *
 * ★ 判定を純粋な関数に切り出してある。**「LINE アプリ内では出さない」を
 * テストで固定したい**ため。画面の中に条件を書くと、条件が増えたときに
 * 検査できなくなる。
 *
 * これは本番の機能ではない。位置情報が取れない環境（PC のブラウザ、権限を拒否した
 * 端末）で、チェックイン半径や探索の導線を実際に歩かずに確認するためのもの。
 */

export interface DebugMoveContext {
  /** LINE アプリ内で開かれているか */
  inLineClient: boolean
  /** 現在地の取得状況 */
  geoStatus: GeolocationStatus
  /** マウス等の精密なポインタを持つか（PC の判定に使う） */
  hasFinePointer: boolean
  /** サーバー側で無効化されていないか */
  enabledByServer: boolean
}

/**
 * ★ LINE アプリ内では絶対に出さない。
 *
 * 実利用者が触れる経路であり、そこに位置を偽装できる操作を置いてはいけない。
 * 位置偽装への完全な対策は MVP の範囲外だが（要件定義書 13章）、
 * **こちらから偽装の手段を提供しない**のは守る。
 *
 * そのうえで、次のいずれかを満たすときに出す。
 *
 * - **すでに模擬位置で動いている。** 操作を続けられなければならない
 * - 現在地が取れない（拒否・非対応）。歩いても確認できないため
 * - 精密なポインタがある（PC）。実際に歩けない環境で導線を確認するため
 *
 * ★ 1つ目を忘れてはいけない。動かした瞬間に状態が `simulated` へ変わるため、
 * これが無いと**操作した途端にジョイスティックが消える**（実際にそうなった）。
 * 「出した理由」が「操作の結果」で消えてしまう形の抜けである。
 */
export function shouldOfferDebugMove(context: DebugMoveContext): boolean {
  if (context.inLineClient) return false
  if (!context.enabledByServer) return false

  // 動かし始めたら出し続ける。ここが最初に来る
  if (context.geoStatus === 'simulated') return true

  const cannotLocate = context.geoStatus === 'denied' || context.geoStatus === 'unavailable'
  return cannotLocate || context.hasFinePointer
}

/**
 * PC かどうかの判定。
 *
 * ★ ユーザーエージェントを見ない。機種の増減で崩れるため、
 * **入力装置の性質**で判断する（ホバーでき、かつ精密に指せる）。
 */
export function hasFinePointer(): boolean {
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}
