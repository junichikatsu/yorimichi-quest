import { describe, expect, it } from 'vitest'
import {
  EMPTY_EQUIPMENT,
  ITEM_DEFS,
  ITEM_KEYS,
  equippedKeys,
  sanitizeEquipment,
} from './item.js'

/**
 * 装備の整え方（FR-07-8）。
 *
 * ★ ここが緩いと、**手に入れていない道具を着た姿**が保存できてしまう。
 * 読み出しでも通すので、過去に入った不正な値で表示が壊れないことも見ている。
 */

describe('sanitizeEquipment', () => {
  it('持っている道具はそのまま残る', () => {
    const result = sanitizeEquipment({ ...EMPTY_EQUIPMENT, head: 'helmet' }, new Set(['helmet']))
    expect(result.head).toBe('helmet')
  })

  it('★ 持っていない道具は外す', () => {
    const result = sanitizeEquipment({ ...EMPTY_EQUIPMENT, head: 'helmet' }, new Set())
    expect(result.head).toBeNull()
  })

  it('★ スロット違いは外す（頭の道具を手に持たせない）', () => {
    const result = sanitizeEquipment({ ...EMPTY_EQUIPMENT, hand: 'helmet' }, new Set(['helmet']))
    expect(result.hand).toBeNull()
  })

  it('すべての道具が、自分のスロットなら通る', () => {
    for (const key of ITEM_KEYS) {
      const slot = ITEM_DEFS[key].slot
      const result = sanitizeEquipment({ ...EMPTY_EQUIPMENT, [slot]: key }, new Set([key]))
      expect(result[slot], key).toBe(key)
    }
  })
})

describe('equippedKeys', () => {
  it('装備している道具だけを並べる', () => {
    expect(equippedKeys({ ...EMPTY_EQUIPMENT, head: 'helmet', hand: 'tank' })).toEqual([
      'helmet',
      'tank',
    ])
  })

  it('何も装備していなければ空', () => {
    expect(equippedKeys(EMPTY_EQUIPMENT)).toEqual([])
  })
})
