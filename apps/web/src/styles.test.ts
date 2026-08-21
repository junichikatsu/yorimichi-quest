import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * スタイルの検査。
 *
 * ★ 見た目そのものは自動では確かめられないが、**壊れ方が決まっている点**は
 * 検査できる。ここで見るのは、実際に何度も踏んだ3つだけである。
 *
 * 1. サンプルから持ち込んだ変数名が未定義のまま残る
 * 2. メディアクエリの中身だけを切り出して全画面幅に適用してしまう
 * 3. 画面に固定した要素がフッタ（出典表示）を覆う
 */

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'styles.css'),
  'utf-8',
)

/**
 * メディアクエリの本体を取り出す。
 *
 * ★ `indexOf('}
}')` のような切り出しをしてはいけない。整形の揺れと、
 * 後ろに CSS が増えたときに壊れる。**実際に壊れた。** 波括弧を数えて範囲を取る。
 */
function mediaBlock(source: string, header: string): string {
  const start = source.indexOf(header)
  expect(start, `${header} が見つからない`).toBeGreaterThanOrEqual(0)

  const open = source.indexOf('{', start)
  let depth = 0

  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }

  throw new Error(`${header} の波括弧が閉じていない`)
}

/** セレクタ1つの宣言ブロックを取り出す */
function ruleBlock(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  expect(start, `${selector} が見つからない`).toBeGreaterThanOrEqual(0)

  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  return source.slice(open + 1, close)
}

/** そのセレクタの z-index */
function zIndexOf(source: string, selector: string): number {
  const match = /z-index:\s*(\d+)/.exec(ruleBlock(source, selector))
  expect(match, `${selector} に z-index が無い`).not.toBeNull()
  return Number(match![1])
}

describe('styles.css', () => {
  it('★ 使っている CSS 変数がすべて定義されている', () => {
    const used = new Set([...css.matchAll(/var\((--[a-z0-9_-]+)/g)].map((m) => m[1]))
    const defined = new Set([...css.matchAll(/^\s*(--[a-z0-9_-]+)\s*:/gm)].map((m) => m[1]))

    // マーカーの色は実行時に element.style へ設定する（既定値付きで参照している）
    used.delete('--marker-color')

    const missing = [...used].filter((name) => !defined.has(name))
    expect(missing, `未定義の変数: ${missing.join(', ')}`).toEqual([])
  })

  it('波括弧が釣り合っている（メディアクエリの切り出し漏れ検出）', () => {
    expect((css.match(/\{/g) ?? []).length).toBe((css.match(/\}/g) ?? []).length)
  })

  it('★ ジョイスティックは PC ではフッタを覆わない', () => {
    /*
     * fixed のままだと画面の下端に居座り、出典表示（ライセンス上必要）を隠す。
     * 実測でジョイスティックは約145px、フッタは約80pxなので完全に隠れた。
     * 広い画面では地図の領域の内側に収める。
     */
    const block = mediaBlock(css, '@media (min-width: 901px)')

    expect(block).toContain('.joystick')
    expect(block, 'PC では absolute にする（fixed だとフッタを覆う）').toContain(
      'position: absolute',
    )
  })

  it('★ PC ではページを伸ばさない（絶対配置が画面外へ出ないため）', () => {
    const block = mediaBlock(css, '@media (min-width: 900px)')

    expect(block).toContain('overflow: hidden')
    // min-height: 0 が無いと子が縮まず overflow が効かない
    expect(block).toContain('min-height: 0')
  })

  it('霧のキャンバスは操作を通す', () => {
    expect(ruleBlock(css, '.map__fog')).toContain('pointer-events: none')
  })

  /*
   * 歩行中の覆い（FR-02-9）。
   *
   * ★ 「歩きながら見せない」ための機構なので、**見えてしまう／触れてしまう**形の
   * 崩れはすべて機能の否定になる。3 つとも CSS 1 行で壊れる。
   */
  it('★ 歩行中の覆いは他のどの要素より前に出る', () => {
    const guard = zIndexOf(css, '.walkguard')

    // ジョイスティックやトーストが上に残ると、覆っている最中に触れてしまう
    for (const selector of ['.joystick', '.joystick-reopen', '.toast']) {
      expect(guard, `${selector} より前に出ていない`).toBeGreaterThan(zIndexOf(css, selector))
    }
  })

  it('★ 歩行中の覆いは透けない（透けたら歩きながら読んでしまう）', () => {
    const block = ruleBlock(css, '.walkguard')
    const background = /background:\s*([^;]+);/.exec(block)

    expect(background, '背景色が無い').not.toBeNull()
    expect(background![1]).not.toMatch(/rgba|transparent|hsla/)
  })

  it('★ 歩行中の覆いは下の操作を通さない', () => {
    expect(ruleBlock(css, '.walkguard')).toContain('touch-action: none')
  })

  /*
   * 有事モード（FR-08-7）。
   *
   * ★ 「平時のプレイ経験だけで有事モードを操作できる」ことが要件である。
   * 配色以外を触ると、覚えた操作が通じなくなる。**変えていいのは色だけ**という
   * 制約を CSS の側で固定する。
   */
  it('★ 有事モードは配色だけを変える（レイアウトを変えない）', () => {
    const block = ruleBlock(css, '.app--emergency')

    for (const property of [
      'display',
      'grid-template',
      'flex-direction',
      'position',
      'order',
      'padding',
      'margin',
    ]) {
      expect(block, `${property} を変えている（配色以外は触らない）`).not.toContain(
        `${property}:`,
      )
    }
  })

  it('有事モードでも文字色と背景を明示する（親の配色が透ける事故を防ぐ）', () => {
    const block = ruleBlock(css, '.app--emergency')

    expect(block).toContain('background:')
    expect(block).toContain('color:')
  })
})
