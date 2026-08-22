import { describe, expect, it } from 'vitest'
import { CARD_KINDS, CARD_KIND_ORDER, MISSION_DEFS, parseCardId, toCardId } from './card.js'

/**
 * カードの識別子（FR-14）。
 *
 * ★ これはデータストアのサブキーにそのまま入る値である。**形が変わると、
 * すでに保存されている達成記録が読めなくなる。** 往復できることを固定しておく。
 */

describe('カードの識別子', () => {
  it('往復できる', () => {
    for (const kind of CARD_KINDS) {
      const cardId = toCardId(kind, 'sample-key')
      expect(parseCardId(cardId)).toEqual({ kind, key: 'sample-key' })
    }
  })

  it('★ スポットIDにコロンが無くても壊れない（区切りは最初のコロンだけ）', () => {
    // 取込スクリプトが作る spotId は `<出典>-<ハッシュ>`。将来コロンを含んでも壊さない
    expect(parseCardId('place:aed:277fdb2594')).toEqual({ kind: 'place', key: 'aed:277fdb2594' })
  })

  it('壊れた値は undefined にする（例外を投げない）', () => {
    for (const broken of ['', 'place', 'place:', ':key', 'unknown:key']) {
      expect(parseCardId(broken), broken).toBeUndefined()
    }
  })
})

describe('カードの並び', () => {
  it('★ 行動が先頭に並ぶ（G-8 の具体化）', () => {
    // 道具より先に行動が並ぶことで「モノをそろえれば備えたことになる」を分類で防ぐ
    expect(CARD_KIND_ORDER[0]).toBe('action')
    expect(CARD_KIND_ORDER.indexOf('action')).toBeLessThan(CARD_KIND_ORDER.indexOf('tool'))
  })
})

describe('ミッション', () => {
  it('★ 他のカードの枚数だけで判定できる条件になっている（FR-14-7）', () => {
    // 専用のカウンタを持たせない。持たせると表示と判定が食い違う余地ができる
    for (const mission of MISSION_DEFS) {
      expect(CARD_KINDS).toContain(mission.requirement.kind)
      expect(mission.requirement.count).toBeGreaterThan(0)
    }
  })

  it('達成条件の文が未達成でも読める（中身とは別に持つ）', () => {
    for (const mission of MISSION_DEFS) {
      expect(mission.condition).not.toBe('')
      expect(mission.body).not.toBe('')
    }
  })
})
