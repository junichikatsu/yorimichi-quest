import { describe, expect, it } from 'vitest'
import { isAreaId, isSpotId, isUserId } from './ids.js'

/**
 * 識別子の検証。
 *
 * ★ ユーザーIDは LINE の userId をそのまま主キーにしている。ここが緩いと、
 * 別の形の文字列をユーザーIDとして通してしまう。**通ってはいけないもの**を固定する。
 */

describe('isUserId', () => {
  it('LINE の userId（U + 32桁の16進数）を受け入れる', () => {
    expect(isUserId('U0123456789abcdef0123456789abcdef')).toBe(true)
  })

  it('★ 形が違うものを受け入れない', () => {
    expect(isUserId('')).toBe(false)
    // 先頭が U でない
    expect(isUserId('X0123456789abcdef0123456789abcdef')).toBe(false)
    // 桁が足りない / 多い
    expect(isUserId('U0123456789abcdef')).toBe(false)
    expect(isUserId('U0123456789abcdef0123456789abcdef0')).toBe(false)
    // 大文字の16進数は LINE の形式ではない
    expect(isUserId('U0123456789ABCDEF0123456789ABCDEF')).toBe(false)
    // UUID を渡しても通らない
    expect(isUserId('11111111-2222-4333-8444-555555555555')).toBe(false)
  })
})

describe('isSpotId', () => {
  it('取込スクリプトが作る形を受け入れる', () => {
    expect(isSpotId('shelter-8f3a1c2b91')).toBe(true)
    expect(isSpotId('aed-0011223344')).toBe(true)
  })

  it('★ 大文字・記号・パス区切りを受け入れない', () => {
    expect(isSpotId('Shelter-1')).toBe(false)
    expect(isSpotId('../etc/passwd')).toBe(false)
    expect(isSpotId('spot/1')).toBe(false)
    expect(isSpotId('a')).toBe(false)
    expect(isSpotId('-leading-hyphen')).toBe(false)
  })
})

describe('isAreaId', () => {
  it('決定したエリアIDを受け入れる', () => {
    expect(isAreaId('chiyoda-minato')).toBe(true)
  })

  it('★ 空文字や記号を受け入れない', () => {
    expect(isAreaId('')).toBe(false)
    expect(isAreaId('area#chiyoda')).toBe(false)
  })
})
