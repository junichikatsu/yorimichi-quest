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

/**
 * 同じ条件のメディアクエリを**すべて**取り出す。
 *
 * ★ `mediaBlock` は最初の1つしか見ない。同じ条件のブロックは複数あり
 * （それぞれの規則の近くに置くため。**基本の規則より後ろに置かないと詳細度で
 * 負ける**）、最初だけを見ると「別のブロックに書いてあるのに見つからない」と
 * いう誤った失敗になる。**実際にそれで詰まった。**
 */
function mediaBlocks(source: string, header: string): string[] {
  const blocks: string[] = []
  let from = 0

  for (;;) {
    const start = source.indexOf(header, from)
    if (start < 0) break

    const open = source.indexOf('{', start)
    let depth = 0
    let end = -1

    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1
      else if (source[i] === '}') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }

    if (end < 0) throw new Error(`${header} の波括弧が閉じていない`)
    blocks.push(source.slice(open + 1, end))
    from = end
  }

  expect(blocks.length, `${header} が見つからない`).toBeGreaterThan(0)
  return blocks
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
    for (const selector of ['.statusbar__geo', '.statusbar__mode']) {
      expect(ruleBlock(css, selector), selector).toContain('white-space: nowrap')
    }
  })

  /*
   * 地図の上に重ねるものの列。
   *
   * ★ ハザードの知らせを地図の左上に絶対配置していたため、スマホでは
   * **キャラクターや地図の文字と重なって読めなかった。** 位置を1つずつ決めるのを
   * やめ、上から積む1本の列にしてある。個別に `top` を振る形へ戻すと、
   * 足したときに必ずどこかで重なる。
   */
  it('★ 地図に重ねるものは1本の列に積む（位置を個別に決めない）', () => {
    const block = ruleBlock(css, '.mapoverlay')

    expect(block, '列になっていない').toContain('display: grid')
    expect(block, '間隔が無い（詰まって重なって見える）').toContain('gap:')
  })

  it('★ 地図に重ねる列は操作を通す（帯の裏の地図が触れなくなる）', () => {
    expect(ruleBlock(css, '.mapoverlay')).toContain('pointer-events: none')
  })

  it('★ 地図に重ねる列は地図の大きさを変えない', () => {
    /*
     * ★ 流れの中に置くと地図の高さが変わり、**Mapbox のキャンバスは自分では
     * 追随せず歪む**（`map.resize()` を呼んでいない）。絶対配置で重ねる。
     */
    expect(ruleBlock(css, '.mapoverlay')).toContain('position: absolute')
  })

  it('★ PC では地図に重ねる列をサイドバーの上に出さない', () => {
    const blocks = mediaBlocks(css, '@media (min-width: 900px)')

    expect(
      blocks.some((block) => block.includes('.mapoverlay')),
      '.mapoverlay の逃がしが無い',
    ).toBe(true)
  })

  /*
   * ハザードの知らせを状態バーへ重ねる（#72）。
   *
   * ★ 一番上に出す（下にあるものを覆う）。**覆う以上、押して消せる口が必ず要る。**
   * 消せない覆いは操作を奪うだけである。どちらも1行で壊れる。
   */
  it('★ 知らせは状態バーの中で一番上に出る', () => {
    const notice = zIndexOf(css, '.hazardnow')

    // ポイントの丸（地図の上）より前である必要はないが、状態バーの中では最前面
    expect(notice).toBeGreaterThan(0)
  })

  it('★ 消す口は帯いっぱいに広がる（× だけを的にしない）', () => {
    /*
     * ★ 知らせは下にある操作（キャラメイク・位置情報・有事モードの切替）を覆う。
     * 消せなければ操作を奪ったままになる。歩きながら片手で押せる大きさが要る。
     */
    const block = ruleBlock(css, '.hazardnow__dismiss')

    expect(block, '帯いっぱいに広がっていない').toContain('inset: 0')
    expect(block, '押せる形になっていない').toContain('cursor: pointer')
  })

  it('★ 知らせは状態バーの高さを変えない（地図が跳ねる）', () => {
    /*
     * ★ 内訳が折り返すと状態バーが伸び、地図の入れ物の高さが変わる。
     * 知らせのために画面が跳ねてはいけない。
     */
    expect(ruleBlock(css, '.hazardnow')).toContain('position: absolute')
    expect(ruleBlock(css, '.hazardnow__parts'), '内訳が折り返す').toContain(
      'text-overflow: ellipsis',
    )
  })

  it('★ ハザードの知らせは「想定」の印を持つ（実況として読ませない）', () => {
    /*
     * ★ 短い表示（区域の中に居るあいだ）でも落とさない。これが無いと、
     * いま水が来ていることを示す画面に読める（FR-08-9 と同じ作法）。
     */
    expect(css, '.hazardnow__badge が無い').toContain('.hazardnow__badge')
  })

  it('★ 地図の上のポイントは下地を敷く（地図の色に溶けると読めない）', () => {
    const block = ruleBlock(css, '.mappoints')

    expect(block, '下地が無い').toContain('background:')
    expect(block, '折り返して2行になる').toContain('white-space: nowrap')
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
   * 画面に重ねる板（FR-02-2・FR-04-1）。
   *
   * ★ サイドバーの中に置くと、スマホでは地図の下に積まれて画面の外にある。
   * 重ねる以上、**上に何が乗るか**を決めておかないと、演出に隠れる／
   * 逆に演出を隠すことになる。
   */
  it('★ 重ねる板は演出より後ろ、トーストより前に出る', () => {
    for (const selector of ['.sheet--spot', '.sheet--survey', '.sheet--quiz']) {
      const sheet = zIndexOf(css, selector)

      // 点数とカードの演出は板の上に出る（板の裏で祝われては伝わらない）
      expect(sheet, `${selector} が点数の演出を隠す`).toBeLessThan(zIndexOf(css, '.burst'))
      expect(sheet, `${selector} がカードの演出を隠す`).toBeLessThan(zIndexOf(css, '.reveal'))
      // 失敗の知らせが板の裏に隠れてはいけない
      expect(sheet, `${selector} が知らせを隠す`).toBeLessThan(zIndexOf(css, '.toast'))
    }

    /*
     * 流れの順に重なる（詳細 → チェックイン → アンケート → クイズ）。
     * ここが逆だと、アンケートを開いた瞬間にクイズが前に出て**アンケートが
     * 飛ばされる**（このサービスが集めているデータは、そこでしか増えない）。
     */
    expect(zIndexOf(css, '.sheet--spot')).toBeLessThan(zIndexOf(css, '.sheet--survey'))
    expect(zIndexOf(css, '.sheet--survey')).toBeLessThan(zIndexOf(css, '.sheet--quiz'))
  })

  /*
   * 待っているあいだの覆い。
   *
   * ★ 「操作を止める」ためのものなので、**触れてしまう／後ろに隠れる**形の崩れは
   * そのまま機能の否定になる。演出の覆い（`pointer-events: none`）と逆であり、
   * 取り違えやすいので固定する。
   */
  it('★ 待っているあいだの覆いは下の操作を通さない', () => {
    const block = ruleBlock(css, '.waiting')

    // ★ 演出と同じ「操作を通す」指定にしてはいけない（覆う意味が無くなる）
    expect(block, '操作を通してしまう').not.toContain('pointer-events: none')
    expect(block, 'スクロールとピンチが通る').toContain('touch-action: none')
  })

  it('★ 覆いの素の状態は透明（速いときにちらつかせない）', () => {
    /*
     * ★ 速いときの応答は 1〜16ms である。素で暗幕を敷くと、チェックインのたびに
     * 一瞬ちらつくだけになる。**止めるのは即座に、見せるのは遅いときだけ。**
     * 暗幕は猶予を過ぎてから付く `--shown` の側にある。
     */
    expect(ruleBlock(css, '.waiting'), '素で暗幕を敷いている').not.toContain('background:')
    expect(ruleBlock(css, '.waiting--shown'), '見せる側に暗幕が無い').toContain('background:')
  })

  it('★ 待っているあいだの覆いは、板と演出より前に出る', () => {
    const waiting = zIndexOf(css, '.waiting')

    // 後ろにあると板の上を押せてしまう
    for (const selector of ['.sheet--spot', '.sheet--survey', '.sheet--quiz', '.burst', '.reveal']) {
      expect(waiting, `${selector} より後ろにある`).toBeGreaterThan(zIndexOf(css, selector))
    }
  })

  it('★ 歩行中の覆いは、待ちの覆いより前に出る（歩きスマホを止めるほうが優先）', () => {
    expect(zIndexOf(css, '.walkguard')).toBeGreaterThan(zIndexOf(css, '.waiting'))
  })

  it('★ アンケートも暗幕で受け止める（外を触って消させない）', () => {
    // ここで消えると、チェックインしただけでデータが1件も増えないまま終わる
    expect(ruleBlock(css, '.sheet--survey')).toContain('background:')
  })

  it('★ アンケートの3つの選択肢は等幅（「わからない」を選びにくくしない）', () => {
    /*
     * ★ 「わからない」を小さくしたり下に置いたりすると、**分からないのに断定する**
     * ほうへ人を寄せる。それは公開データの誤りをこちらから作ることであり、
     * 車いす利用者がそれを見て出かける。1行で壊れるので固定する。
     */
    expect(ruleBlock(css, '.survey__choices')).toContain('grid-template-columns: repeat(3, 1fr)')
  })

  it('★ 選んだ選択肢は色だけで示さない（押し間違いに気づけるように）', () => {
    const block = ruleBlock(css, '.survey__choice--picked')

    expect(block, '枠の差が無い').toContain('border-width')
    expect(css, '.survey__choice--picked::after が無い').toContain('.survey__choice--picked::after')
  })

  it('★ スポット詳細は地図を隠さない（暗幕を敷かず、外側は地図に触れる）', () => {
    /*
     * 詳細を見るために地図を隠すのは、地図を見に来た人の目的を奪う。
     * 選んだ場所がどこなのかを見せたまま出す。
     */
    const block = ruleBlock(css, '.sheet--spot')

    expect(block, '外側が地図に触れない').toContain('pointer-events: none')
    expect(block, '暗幕を敷いている').not.toContain('background:')
  })

  it('★ クイズは暗幕で受け止める（解説を読む前に外を触って消させない）', () => {
    expect(ruleBlock(css, '.sheet--quiz')).toContain('background:')
  })

  /*
   * ハザード（#72）。
   *
   * ★ 知らせであって警報ではない。地図の操作を奪ってはいけないし、
   * 覆っている最中に前へ出てもいけない。
   */
  it('★ ハザードの知らせは地図の操作を通す', () => {
    /*
     * ★ 知らせ自体ではなく、それを載せている列（`.mapoverlay`）で担保している。
     * 地図に重ねるものが増えても1か所で効く。個々の要素に書く形へ戻すと、
     * 足したものだけ地図を触れなくする。
     */
    expect(ruleBlock(css, '.mapoverlay')).toContain('pointer-events: none')
  })

  it('★ ハザードの知らせは歩行中の覆いより後ろに出る', () => {
    // 重なりの順も列の側で持つ（知らせもポイントもこの列の中にある）
    expect(zIndexOf(css, '.mapoverlay')).toBeLessThan(zIndexOf(css, '.walkguard'))
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
      '.sheet__body',
      '.quiz__stamp',
      '.reveal__flip',
      '.mappoints--bumped',
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
