import { describe, expect, it } from 'vitest'
import {
  PIXEL_ART,
  PIXEL_ART_LABELS,
  PIXEL_CHARS,
  PIXEL_SIZE,
  pixelArtKeyOf,
} from './pixel-art.js'

/**
 * ドット絵の寸法。
 *
 * ★ **1行でも長さが違うと、描画時にその行だけずれて穴があく。** 手で 24 列を並べる
 * 作業は数え間違いが起きるので、ここで固定する（実際に何度も間違えた）。
 */

describe('ドット絵', () => {
  it('すべて 24×24 である', () => {
    for (const [name, rows] of Object.entries(PIXEL_ART)) {
      expect(rows.length, `${name} の行数`).toBe(PIXEL_SIZE)
      for (const [index, row] of rows.entries()) {
        expect(row.length, `${name} の ${index} 行目`).toBe(PIXEL_SIZE)
      }
    }
  })

  it('知らない文字が混ざっていない', () => {
    const allowed = new Set<string>(PIXEL_CHARS)
    for (const [name, rows] of Object.entries(PIXEL_ART)) {
      const unknown = [...new Set(rows.join('').split(''))].filter((ch) => !allowed.has(ch))
      expect(unknown, `${name} の未知の文字`).toEqual([])
    }
  })

  it('空の絵がない（点が最低30個ある）', () => {
    for (const [name, rows] of Object.entries(PIXEL_ART)) {
      const filled = rows.join('').split('').filter((ch) => ch !== '.').length
      expect(filled, `${name} の点の数`).toBeGreaterThan(30)
    }
  })

  it('★ 道具10種がすべて別の絵になっている（同じ絵を使い回していない）', () => {
    /*
     * 以前は道具すべてがヘルメットの絵だった。一覧に同じ絵が10枚並び、
     * 「実在の防災グッズをモチーフにする」（G-4）が絵として成立していなかった。
     */
    const tools = Object.entries(PIXEL_ART).filter(([name]) => name.startsWith('tool-'))
    const shapes = new Set(tools.map(([, rows]) => rows.join('')))
    expect(shapes.size).toBe(tools.length)
  })

  it('★ 行動カードは場所カードと違う絵を使う（種類が絵で分かる）', () => {
    const action = pixelArtKeyOf({ kind: 'action', key: 'shelter-action-1', category: 'shelter' })
    const place = pixelArtKeyOf({ kind: 'place', key: 'sample-1', category: 'shelter' })

    expect(action).not.toBe(place)
  })

  it('★ すべての絵に日本語の説明がある', () => {
    /*
     * 説明が無いと「この絵を直してほしい」と指示を出すときに、どれを指しているのか
     * 伝えられない。絵を足したら説明も足すこと。
     */
    for (const name of Object.keys(PIXEL_ART)) {
      expect(PIXEL_ART_LABELS[name], `${name} の説明が無い`).toBeTruthy()
    }
    // 逆向き：使われていない説明が残っていないか
    for (const name of Object.keys(PIXEL_ART_LABELS)) {
      expect(PIXEL_ART[name], `${name} の絵が無いのに説明がある`).toBeDefined()
    }
  })

  it('絵の無いカードでも名前が返る（穴をあけない）', () => {
    for (const input of [
      { kind: 'tool', key: 'unknown-item' },
      { kind: 'action', key: 'unknown-quiz' },
      { kind: 'place', key: 'x', category: 'unknown' },
      { kind: 'mission', key: 'x' },
    ]) {
      const key = pixelArtKeyOf(input)
      expect(PIXEL_ART[key], `${input.kind} の既定`).toBeDefined()
    }
  })
})
