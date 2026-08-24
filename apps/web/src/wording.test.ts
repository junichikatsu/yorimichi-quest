import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 用語の統一。
 *
 * ★ **画面と提出物で言葉が違うと、審査で読んだものと画面で見るものが繋がらない。**
 * 実際に3つずれていた（下の表）。要件定義と提出物の言い方に合わせる。
 *
 * ★ 直す先は「同じものを指す別の言い方」だけである。**言い換えを禁止したいのではない。**
 * たとえばアンケートの見出しは `現地チェック` のままにしている（要件定義では
 * 現地確認アンケートだが、画面では「アンケート」だけだと作業に見えるため意図して
 * 短くしてある。SurveyPanel のコメントに理由が書いてある）。
 */

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')
const componentsDir = join(here, 'components')

/** 同じものを指す別の言い方。左を使い、右は使わない */
const CANONICAL: ReadonlyArray<{ use: string; notUse: string; why: string }> = [
  {
    use: 'バリアフリートイレ',
    notUse: '多機能トイレ',
    why: 'カテゴリ名は SPOT_CATEGORY_LABELS と要件定義・提出物がバリアフリートイレで揃っている',
  },
  {
    use: '相互検証',
    notUse: '相互確認',
    why: '相互検証は競争優位（UA-2）の名前そのもので、提出物 2-3 もこの語で書いている',
  },
]

function readAll(dir: string, ext: readonly string[]): Array<[string, string]> {
  return readdirSync(dir)
    .filter((name) => ext.some((e) => name.endsWith(e)))
    .map((name) => [name, readFileSync(join(dir, name), 'utf-8')])
}

describe('用語の統一', () => {
  it('★ 配信するページに古い言い方が残っていない', () => {
    const offenders: string[] = []

    for (const [name, text] of readAll(publicDir, ['.html', '.css'])) {
      for (const { use, notUse } of CANONICAL) {
        if (text.includes(notUse)) offenders.push(`${name}: ${notUse} → ${use}`)
      }
    }

    expect(offenders, offenders.join(' / ')).toEqual([])
  })

  it('★ 画面の部品に古い言い方が残っていない', () => {
    const offenders: string[] = []

    for (const [name, text] of readAll(componentsDir, ['.tsx'])) {
      for (const { use, notUse } of CANONICAL) {
        if (text.includes(notUse)) offenders.push(`${name}: ${notUse} → ${use}`)
      }
    }

    expect(offenders, offenders.join(' / ')).toEqual([])
  })

  it('★ 検証が済んだ項目は「検証済み」と呼ぶ（画面とダッシュボードで揃える）', () => {
    /*
     * ★ アンケートの結果表示だけ「確認済み」になっていた。ダッシュボードは
     * 「検証済み」と書いており、**同じサービスの2つの画面で別の言い方**をしていた。
     *
     * ★ 鉤括弧つきで見るのは、実機確認のログなど無関係な「確認済み」を拾わないため。
     */
    const survey = readFileSync(join(componentsDir, 'SurveyPanel.tsx'), 'utf-8')

    expect(survey, '「検証済み」を使っていない').toContain('「検証済み」')
    expect(survey, '「確認済み」が残っている').not.toContain('「確認済み」')

    const dashboard = readFileSync(join(publicDir, 'dashboard.html'), 'utf-8')
    expect(dashboard, 'ダッシュボードの言い方が変わった').toContain('検証済み')
  })

  it('提出物で名前を出している機能は、その名前で画面にも出る', () => {
    const joined = readAll(componentsDir, ['.tsx'])
      .map(([, text]) => text)
      .join('\n')

    // 提出物 1-9・2-3・3-1 で名前を出しているもの
    for (const term of ['有事モード', '防災クイズ', 'みんなの記録', 'チェックイン']) {
      expect(joined, `${term} が画面に無い`).toContain(term)
    }
  })
})
