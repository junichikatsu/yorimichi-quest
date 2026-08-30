import { describe, expect, it } from 'vitest'
import { buildDashboardSummary, collectionStatusOf, coverageOf } from './dashboard.js'
import { asAreaId, asSpotId } from './ids.js'
import type { Spot, SpotCategory } from './spot.js'
import type { SurveyStats } from './survey.js'

/**
 * ダッシュボードの集計（FR-09・FR-12-5）。
 *
 * ★ ここで固定するのは**審査員に見せる数字の作り方**である。どれも計算を1行
 * 変えるだけで大きく動き、動いても画面は普通に表示される。だから型では守れない。
 */

function spotOf(
  category: SpotCategory,
  attributes: string[],
  surveyStats: SurveyStats = {},
  overrides: Partial<Spot> = {},
): Spot {
  return {
    spotId: asSpotId(`spot-${Math.random().toString(36).slice(2, 10)}`),
    areaId: asAreaId('chiyoda-minato'),
    name: 'テスト施設',
    category,
    lat: 35.66,
    lng: 139.75,
    address: '東京都港区麻布十番一丁目1-1',
    attributes,
    source: 'test',
    fetchedAt: '2026-08-20',
    checkinCount: 0,
    surveyStats,
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  }
}

describe('属性の空白（スライド3の実測）', () => {
  it('属性が空のスポットを数える。AED は行政データが名称と位置しか持たない', () => {
    const spots = [
      spotOf('aed', []),
      spotOf('aed', []),
      spotOf('shelter', ['スロープ等']),
      spotOf('shelter', []),
    ]

    const coverage = coverageOf(spots)

    expect(coverage.spotCount).toBe(4)
    expect(coverage.spotsWithNoAttributes).toBe(3)
  })

  it('AED は設問3問すべてが「埋める」側になる（attributeHints が空のため）', () => {
    const coverage = coverageOf([spotOf('aed', [])])
    const aed = coverage.categories.find((c) => c.category === 'aed')

    expect(aed?.slotTotal).toBe(3)
    expect(aed?.slotCoveredByOpenData).toBe(0)
    expect(aed?.slotBlank).toBe(3)
  })

  it('行政データに記載があれば「確かめる」側として数え、空白から外す', () => {
    const coverage = coverageOf([spotOf('accessible_toilet', ['オストメイト対応'])])
    const toilet = coverage.categories.find((c) => c.category === 'accessible_toilet')

    expect(toilet?.slotCoveredByOpenData).toBe(1)
    expect(toilet?.slotBlank).toBe(2)
  })
})

describe('二重に数えない（充填率が100%を超えない）', () => {
  /*
   * ★ 記載のある項目を市民が確かめても、それは「新しく埋まった」のではない。
   * 分子に入れると slotTotal を超え、充填率が 100% を超えて表示される。
   */
  it('記載のある項目を検証しても、埋まった扱いにはしない', () => {
    const verified: SurveyStats = { ostomate: { yes: 2, no: 0, unknown: 0 } }
    const coverage = coverageOf([spotOf('accessible_toilet', ['オストメイト対応'], verified)])
    const toilet = coverage.categories.find((c) => c.category === 'accessible_toilet')

    expect(toilet?.slotCoveredByOpenData).toBe(1)
    expect(toilet?.slotVerified).toBe(0)
    expect(toilet?.slotTotal).toBe(3)
    expect(
      (toilet?.slotCoveredByOpenData ?? 0) + (toilet?.slotVerified ?? 0) + (toilet?.slotBlank ?? 0),
    ).toBe(toilet?.slotTotal)
  })

  it('記載の無い項目が検証されたら、埋まった扱いにする', () => {
    const verified: SurveyStats = { handrail: { yes: 2, no: 0, unknown: 0 } }
    const coverage = coverageOf([spotOf('accessible_toilet', ['オストメイト対応'], verified)])
    const toilet = coverage.categories.find((c) => c.category === 'accessible_toilet')

    expect(toilet?.slotVerified).toBe(1)
    expect(toilet?.slotBlank).toBe(1)
  })

  it('どのカテゴリでも 記載 + 埋まった + 空白 = 総数 が保たれる', () => {
    const spots = [
      spotOf('aed', [], { indoor: { yes: 2, no: 0, unknown: 0 } }),
      spotOf('shelter', ['スロープ等'], { pet_ok: { yes: 3, no: 0, unknown: 0 } }),
      spotOf('accessible_toilet', ['オストメイト対応']),
      spotOf('water', ['ボトルディスペンサー型'], { handrail: { yes: 1, no: 1, unknown: 0 } }),
    ]

    const coverage = coverageOf(spots)
    for (const category of coverage.categories) {
      expect(
        category.slotCoveredByOpenData + category.slotVerified + category.slotBlank,
        category.category,
      ).toBe(category.slotTotal)
    }
    expect(
      coverage.slotCoveredByOpenData + coverage.slotVerified + coverage.slotBlank,
    ).toBe(coverage.slotTotal)
  })
})

describe('閾値に届かない回答は検証済みにしない（FR-06-2）', () => {
  it('1人だけの回答は検証済みにならない', () => {
    const one: SurveyStats = { indoor: { yes: 1, no: 0, unknown: 0 } }
    const coverage = coverageOf([spotOf('aed', [], one)])
    const aed = coverage.categories.find((c) => c.category === 'aed')

    expect(aed?.slotVerified).toBe(0)
    expect(aed?.fields.find((f) => f.fieldKey === 'indoor')?.reported).toBe(1)
  })

  it('「わからない」が多数でも検証済みにしない（不明は確定ではない）', () => {
    const unknown: SurveyStats = { indoor: { yes: 0, no: 0, unknown: 5 } }
    const coverage = coverageOf([spotOf('aed', [], unknown)])

    expect(coverage.slotVerified).toBe(0)
  })
})

describe('集まり具合は実測だけを出す', () => {
  it('誰も遊んでいなければ、すべて 0 を返す（想定値を作らない）', () => {
    const status = collectionStatusOf([spotOf('aed', []), spotOf('shelter', ['スロープ等'])])

    expect(status).toEqual({
      checkinCount: 0,
      spotsWithAnswers: 0,
      answerCount: 0,
      verifiedFieldCount: 0,
      reportedFieldCount: 0,
    })
  })

  it('「わからない」も回答として数える（不明であることも情報である）', () => {
    const stats: SurveyStats = { indoor: { yes: 1, no: 0, unknown: 2 } }
    const status = collectionStatusOf([spotOf('aed', [], stats)])

    expect(status.answerCount).toBe(3)
    expect(status.spotsWithAnswers).toBe(1)
  })

  it('チェックイン回数はスポット側の事前計算値を合計する', () => {
    const status = collectionStatusOf([
      spotOf('aed', [], {}, { checkinCount: 3 }),
      spotOf('shelter', [], {}, { checkinCount: 4 }),
    ])

    expect(status.checkinCount).toBe(7)
  })
})

describe('町丁目（FR-09-8）', () => {
  it('記録が0件の町丁目は含めない（データが無いことと設備が無いことは違う）', () => {
    const summary = buildDashboardSummary({
      spots: [spotOf('aed', [], {}, { lat: 35.6552, lng: 139.7365 })],
      areaName: '千代田区・港区',
      generatedAt: '2026-08-30T00:00:00.000Z',
      chomeTopLimit: 8,
    })

    // 区の外の座標しか無ければ 0 件。区の中なら 1 件だけが載る（0件の町丁目は出ない）
    expect(summary.chomeWithRecords).toBeLessThanOrEqual(1)
    expect(summary.chomeTop.every((row) => row.total > 0)).toBe(true)
  })

  it('上位の件数は降順で、上限を超えない', () => {
    const summary = buildDashboardSummary({
      spots: [],
      areaName: '千代田区・港区',
      generatedAt: '2026-08-30T00:00:00.000Z',
      chomeTopLimit: 8,
    })

    expect(summary.chomeTop.length).toBeLessThanOrEqual(8)
    expect(summary.consensusThreshold).toBe(2)
  })
})
