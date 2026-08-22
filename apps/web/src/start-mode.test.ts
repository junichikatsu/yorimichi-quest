import { describe, expect, it } from 'vitest'
import { shouldOfferStartChoice, type StartContext } from './start-mode.js'

/**
 * 開き方の選択。
 *
 * ★ 守りたいのは「ミニアプリの中では出ない」こと。実利用者が触れる経路に
 * 「ログインせずに試す」を出すと、記録が残らない側へ誘導してしまう。
 */

function context(overrides: Partial<StartContext> = {}): StartContext {
  return {
    inLineClient: false,
    liffLoggedIn: false,
    guestModeEnabled: true,
    devLoginEnabled: false,
    ...overrides,
  }
}

describe('shouldOfferStartChoice', () => {
  it('★ ミニアプリの中では出さない（他の条件がどうであれ）', () => {
    for (const liffLoggedIn of [true, false]) {
      expect(shouldOfferStartChoice(context({ inLineClient: true, liffLoggedIn }))).toBe(false)
    }
  })

  it('★ すでに LINE ログイン済みなら出さない（開くたびに聞かない）', () => {
    expect(shouldOfferStartChoice(context({ liffLoggedIn: true }))).toBe(false)
  })

  it('★ おためしが無効なら出さない（選べるものが1つの画面を挟まない）', () => {
    expect(shouldOfferStartChoice(context({ guestModeEnabled: false }))).toBe(false)
  })

  it('★ おためしが無効でも、開発用ログインが使えるなら出す', () => {
    // 出さないと、ローカルで確認する入口が無くなる（LIFF は完走しないため）
    expect(
      shouldOfferStartChoice(context({ guestModeEnabled: false, devLoginEnabled: true })),
    ).toBe(true)
  })

  it('LINE の外で未ログインなら出す（リダイレクトを踏ませないため）', () => {
    expect(shouldOfferStartChoice(context())).toBe(true)
  })
})
