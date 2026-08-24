import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * サービス名の表記。
 *
 * ★ 正式名称は**「イマノウチ・ヨリミチ」**である（提出フォーム 2-2・資料の表紙）。
 *
 * ★ 半分だけ直した状態になりやすい。名前が2語あり、画面の中に出る場所が
 * 7か所（表題・状態バー・開始画面・同意画面・カードの裏・noscript・ダッシュボード）に
 * 散っている。**1か所だけ古いままでも誰も気づかない**ので、ここで固定する。
 */

const here = dirname(fileURLToPath(import.meta.url))
const FULL = 'イマノウチ・ヨリミチ'
const SHORT = 'イマノウチ'

/** 検査対象の実ファイルを集める（このテスト自身は除く） */
function targets(): string[] {
  const found: string[] = []

  for (const name of readdirSync(join(here, '..', 'public'))) {
    if (name.endsWith('.html') || name.endsWith('.css')) found.push(join(here, '..', 'public', name))
  }

  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      // テストは名前を文字列で持つので対象外
      if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue
      if (name.endsWith('.ts') || name.endsWith('.tsx')) found.push(path)
    }
  }
  walk(here)

  return found
}

describe('サービス名', () => {
  it('★ 短い名前だけで書かれた箇所が残っていない', () => {
    const offenders: string[] = []

    for (const path of targets()) {
      const text = readFileSync(path, 'utf-8')
      // 正式名称を伏せてから短い名前を探す。残っていれば古い表記である
      if (text.split(FULL).join('').includes(SHORT)) {
        offenders.push(path.slice(path.indexOf('apps')))
      }
    }

    expect(offenders, `古い表記が残っている: ${offenders.join(', ')}`).toEqual([])
  })

  it('画面に出る場所では正式名称を使っている', () => {
    const html = (name: string): string =>
      readFileSync(join(here, '..', 'public', name), 'utf-8')

    expect(html('index.html'), 'タブの表題').toContain(`<title>${FULL}</title>`)
    expect(html('index.html'), 'JavaScript 無効時の案内').toContain(`${FULL}は JavaScript`)
    expect(html('dashboard.html'), 'ダッシュボードの表題').toContain(FULL)

    for (const file of ['StatusBar.tsx', 'StartGate.tsx', 'ConsentGate.tsx', 'CardReveal.tsx']) {
      const source = readFileSync(join(here, 'components', file), 'utf-8')
      expect(source, `${file} に正式名称が無い`).toContain(FULL)
    }
  })
})
