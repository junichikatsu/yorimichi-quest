import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * ファビコン。
 *
 * ★ ここは React を通らないので、壊しても型でも検査でも捕まらない。**配信された
 * HTML を直接見る。**
 *
 * ★ 壊れ方が静かである。data URI の中の `#` を素で書くと、そこから先が URI の
 * フラグメントとして切り捨てられ、**色が消えて何も描かれない**（エラーは出ない）。
 */

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')

const PAGES = ['index.html', 'dashboard.html'] as const

function iconHref(page: string): string {
  const html = readFileSync(join(publicDir, page), 'utf-8')
  const match = html.match(/<link rel="icon" href="([^"]+)"/)
  expect(match, `${page} に rel="icon" が無い`).not.toBeNull()
  return match![1]!
}

/**
 * 色の指定（fill）を取り出す。
 *
 * ★ `none`（塗らない）は色ではないので外す。線だけの図形に必要な指定である。
 */
function fills(href: string): string[] {
  return [...href.matchAll(/fill='([^']+)'/g)]
    .map((m) => m[1]!)
    .filter((value) => value !== 'none')
}

describe('ファビコン', () => {
  it('配信するページはどちらも持っている', () => {
    for (const page of PAGES) {
      expect(iconHref(page)).toContain('data:image/svg+xml,')
    }
  })

  it('★ 色の # は %23 でエンコードする（素で書くと以降が切り捨てられて描かれない）', () => {
    for (const page of PAGES) {
      const href = iconHref(page)
      expect(href, `${page} の data URI に素の # がある`).not.toContain('#')
      expect(fills(href).length, `${page} に色の指定が無い`).toBeGreaterThan(0)
      for (const fill of fills(href)) {
        expect(fill, `${page} の fill が %23 で始まっていない`).toMatch(/^%23/)
      }
    }
  })

  it('★ 絵文字を使わない（端末ごとに別の絵になり、16px では潰れる）', () => {
    for (const page of PAGES) {
      const href = iconHref(page)
      expect(href, `${page} が文字を描いている`).not.toContain('%3Ctext')
      // 絵文字は %E2%9B%A9 のような多バイトの並びになる
      expect(href, `${page} に絵文字が残っている`).not.toMatch(/%[EF][0-9A-F](%[89AB][0-9A-F]){2}/i)
    }
  })

  it('★ 2ページは同じ図案で色だけ違う（別の図案にすると別サービスに見える）', () => {
    const [app, dashboard] = PAGES.map(iconHref)

    // 色を伏せれば同じ文字列になる＝形は一致している
    const shape = (href: string): string => href.replace(/fill='[^']+'/g, "fill='X'")
    expect(shape(app!)).toBe(shape(dashboard!))

    // 板の色（1つめの fill）は違う。デモで両方開いたときにタブを見分けるため
    expect(fills(app!)[0]).not.toBe(fills(dashboard!)[0])
  })

  it('★ 16px で消えない太さを保つ（線幅と丸の半径の下限）', () => {
    /*
     * viewBox は 32 なので、16px 表示では半分の太さになる。
     * 線 4.6 → 約2.3px、丸の半径 4.2 → 直径約4.2px。ここを下回ると 16px で読めない。
     */
    for (const page of PAGES) {
      const href = iconHref(page)
      const stroke = Number(href.match(/stroke-width='([\d.]+)'/)?.[1])
      const radius = Number(href.match(/r='([\d.]+)'/)?.[1])

      expect(stroke, `${page} の線が細すぎる`).toBeGreaterThanOrEqual(4)
      expect(radius, `${page} の丸が小さすぎる`).toBeGreaterThanOrEqual(3.5)
    }
  })
})
