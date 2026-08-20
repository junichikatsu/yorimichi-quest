import { describe, expect, it } from 'vitest'
import { shouldOfferDebugMove, type DebugMoveContext } from './debug-move.js'

/**
 * デモ用の移動操作を出す条件。
 *
 * ★ 守りたいのは「LINE アプリ内では出ない」こと。実利用者が触れる経路に
 * 位置を偽装できる操作を置いてはいけない。条件が増えても崩れないよう固定する。
 */

function context(overrides: Partial<DebugMoveContext> = {}): DebugMoveContext {
  return {
    inLineClient: false,
    geoStatus: 'watching',
    hasFinePointer: false,
    enabledByServer: true,
    ...overrides,
  }
}

describe('shouldOfferDebugMove', () => {
  it('★ LINE アプリ内では出さない（他の条件がすべて揃っていても）', () => {
    expect(
      shouldOfferDebugMove(
        context({ inLineClient: true, geoStatus: 'denied', hasFinePointer: true }),
      ),
    ).toBe(false)
  })

  it('★ サーバーが無効にしていたら出さない（URL が漏れたときに止められる）', () => {
    expect(
      shouldOfferDebugMove(context({ enabledByServer: false, geoStatus: 'unavailable' })),
    ).toBe(false)
  })

  it('現在地が取れないときは出す', () => {
    expect(shouldOfferDebugMove(context({ geoStatus: 'denied' }))).toBe(true)
    expect(shouldOfferDebugMove(context({ geoStatus: 'unavailable' }))).toBe(true)
  })

  it('PC（精密なポインタあり）なら、測位できていても出す', () => {
    // 実際に歩けない環境で導線を確認するため
    expect(shouldOfferDebugMove(context({ hasFinePointer: true, geoStatus: 'watching' }))).toBe(true)
  })

  it('スマートフォンのブラウザで測位できているときは出さない', () => {
    expect(shouldOfferDebugMove(context({ geoStatus: 'watching', hasFinePointer: false }))).toBe(
      false,
    )
  })

  it('★ 模擬位置に切り替わったあとも出し続ける（PC）', () => {
    expect(shouldOfferDebugMove(context({ geoStatus: 'simulated', hasFinePointer: true }))).toBe(
      true,
    )
  })

  it('★ 模擬位置なら精密なポインタが無くても出し続ける', () => {
    /*
     * 動かすと状態が simulated へ変わる。ここを落とすと、
     * 「測位できないから出した」ジョイスティックが**操作した途端に消える**。
     * 出した理由が操作の結果で消えてしまう形の抜けで、実際にそうなった。
     */
    expect(shouldOfferDebugMove(context({ geoStatus: 'simulated', hasFinePointer: false }))).toBe(
      true,
    )
  })

  it('★ 模擬位置でも LINE アプリ内では出さない', () => {
    expect(
      shouldOfferDebugMove(context({ geoStatus: 'simulated', inLineClient: true })),
    ).toBe(false)
  })

  it('★ 模擬位置でもサーバーが無効にしていれば出さない', () => {
    expect(
      shouldOfferDebugMove(context({ geoStatus: 'simulated', enabledByServer: false })),
    ).toBe(false)
  })

  it('測位前（idle）にスマートフォンで開いた場合は出さない', () => {
    // 許可を待っている間に出すと、位置情報を使わない導線だと誤解させる
    expect(shouldOfferDebugMove(context({ geoStatus: 'idle', hasFinePointer: false }))).toBe(false)
  })
})
