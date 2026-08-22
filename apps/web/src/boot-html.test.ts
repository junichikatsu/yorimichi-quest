import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 起動時の読み込み表示。
 *
 * ★ **HTML に直接置く必要がある。** `app.js` は 2.4MB あり、取り終えて解釈する
 * までは React が動いていない。画面側（`App.tsx`）にどれだけ読み込み表示を書いても
 * この区間には出ず、**真っ白な画面**になる。起動が遅いときに一番不安になるのが
 * ここで、実際に「起動時にローディング表示がない」と指摘された。
 *
 * ★ 1行消せば元に戻る類の不具合なので、HTML の中身をそのまま検査する。
 */

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', 'public', 'index.html'), 'utf-8')
const css = readFileSync(join(here, '..', 'public', 'styles.css'), 'utf-8')

/** `#root` の中身を取り出す */
function rootContent(): string {
  const start = html.indexOf('<div id="root">')
  expect(start, '#root が見つからない').toBeGreaterThanOrEqual(0)

  const open = html.indexOf('>', start) + 1
  let depth = 1
  let i = open

  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)
    if (nextClose < 0) break

    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 4
    } else {
      depth -= 1
      if (depth === 0) return html.slice(open, nextClose)
      i = nextClose + 6
    }
  }

  return html.slice(open)
}

describe('index.html の起動表示', () => {
  it('★ #root は空でない（空だと bundle を待つ間が真っ白になる）', () => {
    expect(rootContent().trim(), '#root が空である').not.toBe('')
  })

  it('★ 回るものと文字の両方を置く', () => {
    const content = rootContent()

    // 印だけでは読み上げで何も読まれない（NFR-08）
    expect(content, '回るものが無い').toContain('spinner')
    expect(content, '文字が無い').toMatch(/読み込/)
  })

  it('★ 読み上げにも待ちを伝える', () => {
    const content = rootContent()

    expect(content).toContain('role="status"')
    expect(content).toContain('aria-busy="true"')
  })

  it('★ 使っているクラスが styles.css に定義されている', () => {
    /*
     * ★ ここは React を通らないので、綴りを間違えても**素のまま表示される**
     * （型でも検査でも捕まらない）。定義があることだけは確かめる。
     */
    for (const name of ['.boot', '.spinner']) {
      expect(css, `${name} が styles.css に無い`).toContain(`${name} {`)
    }
  })

  it('★ 起動表示のための style を HTML に書かない（見た目を1か所に保つ）', () => {
    // 同じ「待ち」が場面ごとに違う見た目になると、壊れているのか判断できない
    expect(html, '<style> を書いている').not.toContain('<style')
    expect(rootContent(), 'style 属性で見た目を作っている').not.toContain('style=')
  })

  it('CSS は script より前に読み込む（読み込み表示に間に合わせる）', () => {
    /*
     * ★ `styles.css` が script のあとだと、真っ白な画面のあとに**素のままの
     * 読み込み表示**が一瞬出る。head で読み込んでいることを固定する。
     */
    expect(html.indexOf('styles.css')).toBeLessThan(html.indexOf('app.js'))
  })
})
