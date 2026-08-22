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
   * 状態バーの折り返し。
   *
   * ★ 右側に置くものは増える（位置情報・ポイント・有事モードの切替…）。
   * 折り返せないと、狭い画面で**左のブランドが潰されて縦に伸びる**。
   * 日本語はどこでも改行できるため、幅が足りると 1 文字ずつ積まれる。
   * **実際にそうなった**（スマホで状態バーが画面の1/4を占めた）。
   */
  it('★ 状態バーは折り返す（右の要素が増えても左を潰さない）', () => {
    expect(ruleBlock(css, '.statusbar')).toContain('flex-wrap: wrap')
  })

  it('★ 状態バーの文字は折り返さずに切り詰める（1文字ずつ縦に積まれない）', () => {
    for (const selector of ['.statusbar__title', '.statusbar__sub']) {
      const block = ruleBlock(css, selector)
      expect(block, `${selector} が折り返す`).toContain('white-space: nowrap')
      expect(block, `${selector} に省略記号が無い`).toContain('text-overflow: ellipsis')
    }
  })

  it('★ 名前の入れ物は最小内容幅より縮められる（日本語の最小幅は1文字）', () => {
    // min-width: 0 が無いと、幅1文字まで縮んでから縦に伸び続ける
    expect(ruleBlock(css, '.statusbar__names')).toContain('min-width: 0')
  })

  it('状態バーのチップは折り返さない', () => {
    for (const selector of ['.statusbar__geo', '.statusbar__mode', '.statusbar__points']) {
      expect(ruleBlock(css, selector), selector).toContain('white-space: nowrap')
    }
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

  /*
   * チェックインの演出（FR-03-2）とクイズ（FR-04）。
   *
   * ★ どちらも「1行で機能を否定できる」形の崩れがある。
   */
  it('★ チェックインの演出は下の操作を通す（地図が触れなくなると歩けない）', () => {
    expect(ruleBlock(css, '.burst')).toContain('pointer-events: none')
  })

  it('★ 演出は歩行中の覆いより後ろに出る（覆っている最中に前へ出てはいけない）', () => {
    expect(zIndexOf(css, '.burst')).toBeLessThan(zIndexOf(css, '.walkguard'))
  })

  it('★ クイズの正解・誤答は色だけで区別しない（色覚に依存させない）', () => {
    // 枠の太さと記号を併せて出す。色だけだと同じに見える人がいる（NFR-08）
    for (const selector of ['.quiz__option--answer', '.quiz__option--wrong']) {
      expect(ruleBlock(css, selector), `${selector} に枠の差が無い`).toContain('border-left-width')
      expect(css, `${selector}::after が無い`).toContain(`${selector}::after`)
    }
  })

  /*
   * 到着の知らせと出来事の演出（FR-02-10・FR-03-2）。
   *
   * ★ 覆い（FR-02-9）との関係が要点である。**覆っている最中に前へ出る演出は、
   * それ自体が歩きスマホを作る。** 1行で壊れるので固定する。
   */
  it('★ 出来事の演出は下の操作を通す（地図が触れなくなると歩けない）', () => {
    expect(ruleBlock(css, '.flash')).toContain('pointer-events: none')
  })

  it('★ 演出とまとめは歩行中の覆いより後ろに出る', () => {
    const guard = zIndexOf(css, '.walkguard')

    for (const selector of ['.flash', '.walkdigest', '.reveal']) {
      expect(guard, `${selector} が覆いより前に出る`).toBeGreaterThan(zIndexOf(css, selector))
    }
  })

  /*
   * 重ねて出すクイズ（FR-04-1）。
   *
   * ★ サイドバーの中に置くと、スマホでは地図の下に積まれて画面の外にある。
   * 重ねる以上、**上に何が乗るか**を決めておかないと、演出に隠れる／
   * 逆に演出を隠すことになる。
   */
  it('★ クイズは演出より後ろ、トーストより前に出る', () => {
    const quiz = zIndexOf(css, '.quizmodal')

    // 点数とカードの演出はクイズの上に出る（出題の裏で祝われては伝わらない）
    expect(quiz).toBeLessThan(zIndexOf(css, '.burst'))
    expect(quiz).toBeLessThan(zIndexOf(css, '.reveal'))
    // 失敗の知らせが暗幕の裏に隠れてはいけない
    expect(quiz).toBeLessThan(zIndexOf(css, '.toast'))
  })

  it('★ 演出が重なったときは強いものが前に出る（点数 → 帯 → カード）', () => {
    /*
     * 同時に出さないのが原則（画面側で順に出している）。それでも重なったときに
     * **どちらも読めない**事故を避けるため、順番は CSS の側で決めておく。
     * カードの演出は触って閉じる面なので、いちばん前に置く。
     */
    expect(zIndexOf(css, '.burst')).toBeLessThan(zIndexOf(css, '.flash'))
    expect(zIndexOf(css, '.flash')).toBeLessThan(zIndexOf(css, '.reveal'))
  })

  it('★ 地図に重ねる要素は transform を使わない（位置は Mapbox が持っている）', () => {
    /*
     * マーカーの位置は Mapbox が transform で決めている。CSS 側で transform を
     * 宣言すると**地図から外れた場所に描かれる**（拡大縮小でずれていく）。
     * 演出は box-shadow と opacity で表す。
     */
    for (const selector of ['.marker--ready', '.mapcheckin']) {
      expect(ruleBlock(css, selector), `${selector} が transform を宣言している`).not.toContain(
        'transform:',
      )
    }
  })

  it('★ 動きを減らす設定で、すべての演出の動きが止まる（NFR-08）', () => {
    const block = mediaBlock(css, '@media (prefers-reduced-motion: reduce)')

    for (const selector of [
      '.burst',
      '.marker--ready',
      '.mapcheckin',
      '.flash',
      '.walkdigest',
      '.quizmodal__sheet',
      '.quiz__stamp',
      '.reveal__flip',
      '.statusbar__points--bumped',
      '.sidetabs__new',
      '.exploration__bar-fill',
    ]) {
      expect(block, `${selector} の動きが落ちない`).toContain(selector)
    }
  })

  it('★ 動きを落とす指定は1か所にまとめる（足したときの落とし忘れを防ぐ）', () => {
    const blocks = css.match(/@media \(prefers-reduced-motion/g) ?? []

    expect(blocks).toHaveLength(1)
  })

  it('★ 押せるマーカーは動きを止めても分かる（点滅が消えても輪が残る）', () => {
    const block = mediaBlock(css, '@media (prefers-reduced-motion: reduce)')
    const rule = ruleBlock(block, '.marker--ready')

    // 動きだけを落とす。出ること自体は変えない
    expect(rule).toContain('animation: none')
    expect(rule).toContain('box-shadow')
  })

  it('有事モードでも文字色と背景を明示する（親の配色が透ける事故を防ぐ）', () => {
    const block = ruleBlock(css, '.app--emergency')

    expect(block).toContain('background:')
    expect(block).toContain('color:')
  })
})
