import { describe, expect, it } from 'vitest'
import { SPOT_CATEGORIES } from './spot.js'
import {
  applyAnswers,
  consensusOf,
  DEFAULT_SURVEY_CONSENSUS,
  fillFieldCount,
  intentOf,
  isCoveredByOpenData,
  SURVEY_FORMS,
  SURVEY_NOTE_MAX_LENGTH,
  surveyFormFor,
  type SurveyStats,
} from './survey.js'

/**
 * データ辞書と合意の判定（FR-12・FR-06-2）。
 *
 * ★ ここで固定しているのは**公開データの正しさに直結する境界**である。
 * どれも1行で壊れ、壊れても画面は普通に動く。だから型では守れない。
 */

describe('データ辞書（FR-12-1）', () => {
  it('4カテゴリすべてに設問がある（1つ欠けるとそのカテゴリは何も集まらない）', () => {
    for (const category of SPOT_CATEGORIES) {
      const form = surveyFormFor(category)
      expect(form.fields.length, category).toBeGreaterThan(0)
      expect(form.notePlaceholder, category).not.toBe('')
    }
  })

  it('★ 項目キーは列名に使える形（データストアの列名に混ぜるため）', () => {
    for (const category of SPOT_CATEGORIES) {
      for (const field of SURVEY_FORMS[category].fields) {
        expect(field.fieldKey, field.fieldKey).toMatch(/^[a-z][a-z0-9_]{0,31}$/)
      }
    }
  })

  it('★ 同じカテゴリ内で項目キーが重複しない（回答が上書きされる）', () => {
    for (const category of SPOT_CATEGORIES) {
      const keys = SURVEY_FORMS[category].fields.map((field) => field.fieldKey)
      expect(new Set(keys).size, category).toBe(keys.length)
    }
  })

  it('選択肢の文言は現物の言葉で置く（「はい／いいえ」だけでは後から読めない）', () => {
    for (const category of SPOT_CATEGORIES) {
      for (const field of SURVEY_FORMS[category].fields) {
        expect(field.yesLabel, field.fieldKey).not.toBe('')
        expect(field.noLabel, field.fieldKey).not.toBe('')
        // なぜ聞くのかを必ず添える（答えさせられている感を減らす）
        expect(field.why, field.fieldKey).not.toBe('')
      }
    }
  })

  it('★ 自由記述の上限は短く保つ（そのまま公開できない文を長く受けない）', () => {
    // 個人名・私見・苦情が混ざりやすい。ここで受けるのは「改札を出て右」程度である
    expect(SURVEY_NOTE_MAX_LENGTH).toBeLessThanOrEqual(200)
  })

  it('★ AED は全問が「行政データに記載なし」（属性が1件も無いカテゴリ）', () => {
    /*
     * 取込済み 224 件の AED は属性が空である。ここに `attributeHints` を足すと
     * 「記載あり」と判定されうるが、**行政データにその項目自体が無い。**
     */
    const spot = { attributes: [] as string[], category: 'aed' as const }
    expect(fillFieldCount(spot)).toBe(SURVEY_FORMS.aed.fields.length)
  })
})

describe('充填状況の判定（FR-12-2）', () => {
  const shelter = {
    // 実データに存在する表記（tools/ingest 由来）
    attributes: ['スロープ等', '車椅子使用者対応トイレ'],
    category: 'shelter' as const,
  }

  it('行政データに記載があれば「確かめる」設問になる', () => {
    const field = SURVEY_FORMS.shelter.fields.find((f) => f.fieldKey === 'step_free')!
    expect(isCoveredByOpenData(field, shelter)).toBe(true)
    expect(intentOf(field, shelter)).toBe('verify')
  })

  it('★ 記載が無ければ「埋める」設問になる（空欄を「無い」と読まない）', () => {
    /*
     * ★ オストメイト設備の記載は避難所 72 件中 10 件しかない。残り 62 件は
     * 「無い」ではなく**不明**である。ここが verify になると、
     * **不明を既知として扱う**ことになる。
     */
    const field = SURVEY_FORMS.shelter.fields.find((f) => f.fieldKey === 'ostomate')!
    expect(isCoveredByOpenData(field, shelter)).toBe(false)
    expect(intentOf(field, shelter)).toBe('fill')
  })

  it('★ 手がかりを持たない項目は、どんな属性があっても常に「埋める」', () => {
    // 行政データにその項目自体が無いので、他の属性で埋まったことにはならない
    const field = SURVEY_FORMS.shelter.fields.find((f) => f.fieldKey === 'pet_ok')!
    expect(intentOf(field, { attributes: ['スロープ等', 'オストメイト設備'] })).toBe('fill')
  })

  it('欠損が多いスポットのほうが埋める項目が多い（点数の根拠・FR-12-4）', () => {
    const empty = { attributes: [] as string[], category: 'shelter' as const }
    expect(fillFieldCount(empty)).toBeGreaterThan(fillFieldCount(shelter))
  })
})

describe('合意の判定（FR-06-2）', () => {
  it('誰も答えていなければ empty', () => {
    expect(consensusOf({}, 'ostomate').status).toBe('empty')
  })

  it('★ 1件では確定しない（1人の回答を公開データにしない）', () => {
    /*
     * ★ 報酬つきのアンケートは必ず「適当に答えて報酬」を生む。独立した2人が
     * 同じ答えを出したときに初めて確定させる（競争優位 UA-2 の実体）。
     */
    const stats: SurveyStats = { ostomate: { yes: 1, no: 0, unknown: 0 } }
    expect(consensusOf(stats, 'ostomate').status).toBe('reported')
    expect(consensusOf(stats, 'ostomate').value).toBe(undefined)
  })

  it('閾値に達した答えで確定する', () => {
    const stats: SurveyStats = { ostomate: { yes: 2, no: 0, unknown: 0 } }
    const result = consensusOf(stats, 'ostomate')

    expect(result.status).toBe('verified')
    expect(result.value).toBe('yes')
  })

  it('★ 「わからない」では確定しない（多数が分からないことは確定ではない）', () => {
    const stats: SurveyStats = { ostomate: { yes: 0, no: 0, unknown: 5 } }
    expect(consensusOf(stats, 'ostomate').status).toBe('reported')
  })

  it('★ 賛否が同数なら確定しない（分かれたまま次の人に答えてもらう）', () => {
    const stats: SurveyStats = { ostomate: { yes: 2, no: 2, unknown: 0 } }
    expect(consensusOf(stats, 'ostomate').status).toBe('reported')
  })

  it('多い側が閾値を超えていれば確定する（少数の反対では覆らない）', () => {
    const stats: SurveyStats = { ostomate: { yes: 3, no: 1, unknown: 0 } }
    expect(consensusOf(stats, 'ostomate').value).toBe('yes')
  })

  it('★ 既定の閾値は 1 ではない（1 だと1人で確定できる）', () => {
    expect(DEFAULT_SURVEY_CONSENSUS).toBeGreaterThanOrEqual(2)
  })

  it('閾値は差し替えられる（デモ時に変更できる設定値・FR-06-2）', () => {
    const stats: SurveyStats = { ostomate: { yes: 1, no: 0, unknown: 0 } }
    expect(consensusOf(stats, 'ostomate', 1).status).toBe('verified')
  })
})

describe('集計への加算', () => {
  it('★ 「わからない」も数える（不明であること自体が情報である）', () => {
    const next = applyAnswers({}, { ostomate: 'unknown' })
    expect(next['ostomate']).toEqual({ yes: 0, no: 0, unknown: 1 })
  })

  it('元の集計を書き換えない（読んで足して書き戻す形のため）', () => {
    const before: SurveyStats = { ostomate: { yes: 1, no: 0, unknown: 0 } }
    applyAnswers(before, { ostomate: 'yes' })

    expect(before['ostomate']).toEqual({ yes: 1, no: 0, unknown: 0 })
  })

  it('既にある件数へ足す（他の値は保つ）', () => {
    const before: SurveyStats = { ostomate: { yes: 1, no: 2, unknown: 3 } }
    const next = applyAnswers(before, { ostomate: 'no' })

    expect(next['ostomate']).toEqual({ yes: 1, no: 3, unknown: 3 })
  })

  it('触っていない項目はそのまま残る', () => {
    const before: SurveyStats = { ostomate: { yes: 1, no: 0, unknown: 0 } }
    const next = applyAnswers(before, { handrail: 'yes' })

    expect(next['ostomate']).toEqual({ yes: 1, no: 0, unknown: 0 })
    expect(next['handrail']).toEqual({ yes: 1, no: 0, unknown: 0 })
  })
})
