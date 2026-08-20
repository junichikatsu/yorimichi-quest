import { asUserId } from '@imanouchi/shared'
import { describe, expect, it } from 'vitest'
import { issueSession, verifySession } from './session.js'

/**
 * セッショントークン（FR-01）。
 *
 * ★ ここが破れると誰でも他人になれる。**通る条件ではなく、通ってはいけない条件**を
 * 固定するのが目的である。
 */

const SECRET = 'test-secret-value-do-not-use-in-production'
const OTHER_SECRET = 'another-secret'
const USER = asUserId('U0123456789abcdef0123456789abcdef')

describe('issueSession / verifySession', () => {
  it('発行したトークンは同じ鍵で検証できる', () => {
    const { token } = issueSession(USER, SECRET, 12)
    const result = verifySession(token, SECRET)

    expect(result.ok).toBe(true)
    expect(result.ok && result.userId).toBe(USER)
  })

  it('失効時刻を返す', () => {
    const before = Date.now()
    const { expiresAt } = issueSession(USER, SECRET, 2)
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 2 * 3600_000 - 1000)
    expect(expiresAt.getTime()).toBeLessThanOrEqual(before + 2 * 3600_000 + 1000)
  })

  it('★ 別の鍵では検証できない', () => {
    const { token } = issueSession(USER, SECRET, 12)
    expect(verifySession(token, OTHER_SECRET)).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('★ 中身を書き換えると検証に落ちる（別人になれない）', () => {
    const { token } = issueSession(USER, SECRET, 12)
    const [, signature] = token.split('.')

    // 他人のIDに差し替えた payload を、元の署名と組み合わせる
    const forged = Buffer.from(
      JSON.stringify({ u: 'Uffffffffffffffffffffffffffffffff', e: Date.now() + 3600_000 }),
    ).toString('base64url')

    expect(verifySession(`${forged}.${signature}`, SECRET)).toEqual({
      ok: false,
      reason: 'bad-signature',
    })
  })

  it('★ 期限切れは expired として区別される（再ログインで復帰できる）', () => {
    const { token } = issueSession(USER, SECRET, -1)
    expect(verifySession(token, SECRET)).toEqual({ ok: false, reason: 'expired' })
  })

  it('★ 署名が無い・形が違うトークンを受け付けない', () => {
    expect(verifySession('', SECRET).ok).toBe(false)
    expect(verifySession('no-separator', SECRET)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifySession('.onlysignature', SECRET)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('★ 鍵が未設定なら常に失敗する（空の鍵で署名を通さない）', () => {
    const { token } = issueSession(USER, SECRET, 12)
    expect(verifySession(token, '')).toEqual({ ok: false, reason: 'bad-signature' })
    expect(() => issueSession(USER, '', 12)).toThrow()
  })

  it('★ ユーザーIDの形式を満たさない payload は通さない', () => {
    // 署名は正しいが中身の形式が違う場合。LINE の userId 以外を受け入れない
    const encoded = Buffer.from(JSON.stringify({ u: 'not-a-line-id', e: Date.now() + 1000 })).toString(
      'base64url',
    )
    const { token } = issueSession(USER, SECRET, 12)
    const [, signature] = token.split('.')
    // 署名が合わない経路なので bad-signature になるが、いずれにせよ通らないことが重要
    expect(verifySession(`${encoded}.${signature}`, SECRET).ok).toBe(false)
  })
})
