import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 時計を張っている画面の検査。
 *
 * ★ **実機だけで起きた不具合の再発を止めるための検査である。**
 *
 * 演出は `setTimeout` で自分を閉じるが、その効果の依存配列に `onDone` を入れると、
 * 親が渡す関数は毎回別物なので**親が描き直されるたびに数え直しになる**。
 * 手元では気づけない（測位が動かないので親が描き直されない）。実機では
 * `watchPosition` が1秒ほどごとに新しい座標を返し、描き直しの間隔が演出の表示時間
 * （1.8〜3.2秒）より短いため、**時計は永久に終わらない。**
 *
 * 実際の症状：チェックインのポイント表示が出たまま消えず、カードもアンケートも
 * 出てこない。端末をスリープさせると測位が止まって時計が満了し、戻すとアンケートが
 * 出る。iOS・Android の両方で起きた。
 *
 * ★ 検査するのは**依存配列に関数の引数が入っていないこと**である。
 * 「`setTimeout` を書くな」ではない（依存が数値や文字列だけなら安全で、
 * `MapPoints` の跳ねや `HazardNotice` の段の切り替えは実際にそう書いてある）。
 */

const srcDir = dirname(fileURLToPath(import.meta.url))
const componentsDir = join(srcDir, 'components')

/**
 * コメントを落とす。
 *
 * ★ 落とさないと、**説明文に書いた `setTimeout` や `onDone` を実装だと読んでしまう。**
 * 実際にこの検査自身が自分のコメントで落ちた（CSS の検査でも同じことが起きている）。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function componentFiles(): string[] {
  return readdirSync(componentsDir).filter((name) => name.endsWith('.tsx'))
}

function read(name: string): string {
  return stripComments(readFileSync(join(componentsDir, name), 'utf-8'))
}

/**
 * `setTimeout` を含む効果の依存配列を取り出す。
 *
 * `setTimeout` の位置から次の `])` までを見る（効果の閉じ）。
 */
function depsAfterTimeout(source: string): string[] {
  const found: string[] = []
  let from = 0

  for (;;) {
    const at = source.indexOf('setTimeout', from)
    if (at < 0) break

    const end = source.indexOf('])', at)
    if (end < 0) break

    const tail = source.slice(at, end + 2)
    const deps = /\},\s*\[([^\]]*)\]\)/.exec(tail)
    if (deps?.[1] !== undefined) found.push(deps[1])
    from = end + 2
  }

  return found
}

/** 自分から消える演出。時計は共通のものに寄せてある */
const AUTO_DISMISS_COMPONENTS = ['CheckinBurst.tsx', 'CardReveal.tsx', 'EventFlash.tsx']

describe('時計を張っている画面', () => {
  it('★ 時計の依存配列に関数の引数を入れない（親の描き直しで数え直しになる）', () => {
    const offenders: string[] = []

    for (const name of componentFiles()) {
      for (const deps of depsAfterTimeout(read(name))) {
        // `onDone` / `onDismiss` のような受け取った関数が入っていたら危険
        const callback = /\bon[A-Z]\w*/.exec(deps)
        if (callback) offenders.push(`${name}: [${deps.trim()}]`)
      }
    }

    expect(
      offenders,
      `時計が親の描き直しで数え直しになる: ${offenders.join(' / ')}`,
    ).toEqual([])
  })

  it('自分から消える演出は共通の時計（useAutoDismiss）を使う', () => {
    for (const name of AUTO_DISMISS_COMPONENTS) {
      expect(read(name), `${name} が useAutoDismiss を使っていない`).toContain('useAutoDismiss(')
      // 自前で張り直すと、上の検査を通り抜けたまま同じ不具合を作れる
      expect(read(name), `${name} が自前で時計を持っている`).not.toContain('setTimeout')
    }
  })

  it('★ 共通の時計は onDone を依存に入れない（入れたら修正が無効になる）', () => {
    const source = stripComments(readFileSync(join(srcDir, 'hooks', 'useAutoDismiss.ts'), 'utf-8'))

    // ref に持たせているのがこの修正の要点である
    expect(source).toContain('[delayMs, resetKey]')
    expect(source).toContain('latest.current()')
    expect(depsAfterTimeout(source)).toEqual(['delayMs, resetKey'])
  })
})
