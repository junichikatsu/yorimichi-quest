import type { ExploredTile } from '@imanouchi/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearGuestData,
  loadGuestConsent,
  loadGuestTiles,
  saveGuestConsent,
  saveGuestTiles,
} from './guest-store.js'

/**
 * おためしの記録（端末内）。
 *
 * ★ 守りたいのは「書けない・壊れている端末でもアプリが開ける」こと。
 * プライベートブラウズでは localStorage の参照そのものが例外になる端末があり、
 * ここで落とすと**地図まで出なくなる**。記録を失うより悪い。
 */

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage
}

function tile(key: string): ExploredTile {
  return { tileKey: key, lat: 35.6739, lng: 139.7568, firstSeenAt: '2026-08-22T00:00:00.000Z' }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('探索済みタイルの保存', () => {
  it('書いたものを読める', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() })

    saveGuestTiles([tile('1:1'), tile('1:2')])
    expect(loadGuestTiles().map((t) => t.tileKey)).toEqual(['1:1', '1:2'])
  })

  it('何も無ければ空', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() })
    expect(loadGuestTiles()).toEqual([])
  })

  it('★ 壊れた値でも落ちない（手で書き換えられる場所である）', () => {
    const store = fakeStorage()
    vi.stubGlobal('window', { localStorage: store })

    for (const broken of ['{', 'null', '"text"', '{"a":1}', '[1,2,3]', '[{"tileKey":1}]']) {
      store.setItem('imanouchi.guest.tiles.v1', broken)
      expect(loadGuestTiles(), broken).toEqual([])
    }
  })

  it('形の合う要素だけを残す', () => {
    const store = fakeStorage()
    vi.stubGlobal('window', { localStorage: store })

    store.setItem(
      'imanouchi.guest.tiles.v1',
      JSON.stringify([tile('1:1'), { tileKey: '1:2' }, tile('1:3')]),
    )
    expect(loadGuestTiles().map((t) => t.tileKey)).toEqual(['1:1', '1:3'])
  })

  it('★ localStorage が使えない端末でも落ちない（プライベートブラウズ）', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('access denied')
      },
    })

    expect(() => saveGuestTiles([tile('1:1')])).not.toThrow()
    expect(loadGuestTiles()).toEqual([])
  })

  it('★ 容量超過でも落ちない（記録は失うが遊べる状態は保つ）', () => {
    const store = fakeStorage()
    store.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    vi.stubGlobal('window', { localStorage: store })

    expect(() => saveGuestTiles([tile('1:1')])).not.toThrow()
  })

  it('上限を超える分は切り捨てる', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() })

    saveGuestTiles(Array.from({ length: 2100 }, (_, i) => tile(`1:${i}`)))
    expect(loadGuestTiles()).toHaveLength(2000)
  })
})

describe('同意の保存', () => {
  it('同意を覚え、取り消せる', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() })

    expect(loadGuestConsent()).toBe(false)
    saveGuestConsent(true)
    expect(loadGuestConsent()).toBe(true)
    saveGuestConsent(false)
    expect(loadGuestConsent()).toBe(false)
  })

  it('使えない端末では同意していない扱い（毎回聞く）', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('access denied')
      },
    })

    expect(() => saveGuestConsent(true)).not.toThrow()
    expect(loadGuestConsent()).toBe(false)
  })
})

describe('clearGuestData', () => {
  it('タイルと同意をまとめて消す', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() })

    saveGuestTiles([tile('1:1')])
    saveGuestConsent(true)
    clearGuestData()

    expect(loadGuestTiles()).toEqual([])
    expect(loadGuestConsent()).toBe(false)
  })
})
