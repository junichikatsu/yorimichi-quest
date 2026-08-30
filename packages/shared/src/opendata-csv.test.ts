import { describe, expect, it } from 'vitest'
import { asAreaId, asSpotId } from './ids.js'
import { buildChomeCsv, buildGapCsv, buildVerifiedCsv, wardOf } from './opendata-csv.js'
import type { Spot, SpotCategory } from './spot.js'
import type { SurveyStats } from './survey.js'

/**
 * 行政へ返す CSV（FR-09-4）。
 *
 * ★ ここで固定するのは**行政の手元に残るファイルの中身**である。列がずれても
 * 文字化けしても、画面は何事もなく「出力しました」と言う。**壊れたことに
 * こちら側では気づけない**ので、テストで留める。
 */

function spotOf(
  category: SpotCategory,
  attributes: string[],
  surveyStats: SurveyStats = {},
  overrides: Partial<Spot> = {},
): Spot {
  return {
    spotId: asSpotId('spot-test-0001'),
    areaId: asAreaId('chiyoda-minato'),
    name: 'テスト施設',
    category,
    lat: 35.6585,
    lng: 139.7454,
    address: '東京都港区麻布十番一丁目1-1',
    attributes,
    source: 'test',
    fetchedAt: '2026-08-20',
    checkinCount: 0,
    surveyStats,
    updatedAt: '2026-08-30T12:00:00.000Z',
    ...overrides,
  }
}

const VERIFIED: SurveyStats = { indoor: { yes: 2, no: 0, unknown: 0 } }

describe('Excel で開ける形にする', () => {
  it('BOM を付ける（無いと施設名が文字化けし、中身を見る前に捨てられる）', () => {
    const csv = buildVerifiedCsv([spotOf('aed', [], VERIFIED)])
    expect(csv.startsWith('﻿')).toBe(true)
  })

  it('改行は CRLF にする', () => {
    const csv = buildVerifiedCsv([spotOf('aed', [], VERIFIED)])
    expect(csv).toContain('\r\n')
    expect(/[^\r]\n/.test(csv)).toBe(false)
  })

  it('見出しは取り込んだ自治体標準準拠CSVと同じ列名を使う', () => {
    const header = buildVerifiedCsv([]).replace('﻿', '').split('\r\n')[0]
    expect(header).toContain('名称')
    expect(header).toContain('所在地_市区町村')
    expect(header).toContain('所在地_連結表記')
    expect(header).toContain('緯度')
    expect(header).toContain('経度')
  })
})

describe('列がずれない', () => {
  it('カンマ・引用符・改行を含む施設名を囲んで逃がす', () => {
    const spot = spotOf('aed', [], VERIFIED, { name: '港区役所, 本庁舎 "北" 棟\n別館' })
    const csv = buildVerifiedCsv([spot])

    expect(csv).toContain('"港区役所, 本庁舎 ""北"" 棟\n別館"')
  })

  it('すべての行の列数が見出しと一致する', () => {
    const spots = [
      spotOf('aed', [], VERIFIED, { name: 'カンマ, あり' }),
      spotOf('shelter', ['スロープ等'], { pet_ok: { yes: 3, no: 0, unknown: 0 } }),
    ]
    const csv = buildVerifiedCsv(spots).replace('﻿', '')

    // 囲まれたセルの中の区切りを数えないよう、素朴に分解せず件数だけを確かめる
    const lines = csv.split('\r\n').filter((line) => line !== '')
    expect(lines.length).toBe(3) // 見出し + 2行
  })
})

describe('検証済みしか出さない（FR-09-7）', () => {
  it('1人だけの回答は出力しない', () => {
    const one: SurveyStats = { indoor: { yes: 1, no: 0, unknown: 0 } }
    const csv = buildVerifiedCsv([spotOf('aed', [], one)])
    const lines = csv.replace('﻿', '').split('\r\n').filter((l) => l !== '')

    expect(lines.length).toBe(1) // 見出しだけ
  })

  it('誰も答えていなければ、見出しだけの CSV を返す（0件を隠さない）', () => {
    const csv = buildVerifiedCsv([spotOf('aed', []), spotOf('shelter', ['スロープ等'])])
    const lines = csv.replace('﻿', '').split('\r\n').filter((l) => l !== '')

    expect(lines.length).toBe(1)
  })

  it('検証済みの値は設問の言葉で書く（「はい」のままでは後から読めない）', () => {
    const csv = buildVerifiedCsv([spotOf('aed', [], VERIFIED)])
    expect(csv).toContain('建物の中')
    expect(csv).not.toContain(',yes,')
  })

  it('「わからない」が多数でも検証済みにしない', () => {
    const unknown: SurveyStats = { indoor: { yes: 0, no: 0, unknown: 9 } }
    const csv = buildVerifiedCsv([spotOf('aed', [], unknown)])
    const lines = csv.replace('﻿', '').split('\r\n').filter((l) => l !== '')

    expect(lines.length).toBe(1)
  })
})

describe('未取得項目の一覧（現時点の主要な成果物）', () => {
  it('誰も答えていないスポットの設問がすべて並ぶ', () => {
    const csv = buildGapCsv([spotOf('aed', [])])
    const lines = csv.replace('﻿', '').split('\r\n').filter((l) => l !== '')

    expect(lines.length).toBe(4) // 見出し + AED の設問3件
  })

  it('「未取得」と「回答はあるが未確定」を潰さない', () => {
    const one: SurveyStats = { indoor: { yes: 1, no: 0, unknown: 0 } }
    const csv = buildGapCsv([spotOf('aed', [], one)])

    expect(csv).toContain('未取得')
    expect(csv).toContain('回答はあるが未確定（あと1件で確定）')
  })

  it('行政データの記載の有無を「埋める／確かめる」として書き分ける', () => {
    const csv = buildGapCsv([spotOf('accessible_toilet', ['オストメイト対応'])])

    expect(csv).toContain('記載あり（確かめる）')
    expect(csv).toContain('記載なし（埋める）')
  })

  it('検証済みになった項目は一覧から外れる', () => {
    const csv = buildGapCsv([spotOf('aed', [], VERIFIED)])
    const lines = csv.replace('﻿', '').split('\r\n').filter((l) => l !== '')

    expect(lines.length).toBe(3) // 見出し + 残り2件
  })
})

describe('町丁目の CSV（FR-09-8）', () => {
  it('人口あたりの比を列にしない（受け取った側がそのまま地図に塗るため）', () => {
    const header = buildChomeCsv([]).replace('﻿', '').split('\r\n')[0]

    expect(header).toContain('人口')
    expect(header).toContain('記録件数')
    expect(header).not.toContain('率')
    expect(header).not.toContain('あたり')
    expect(header).not.toContain('危険')
  })

  it('カテゴリの内訳を列として出す', () => {
    const csv = buildChomeCsv([
      {
        code: '13103008001',
        ward: '港区',
        name: '麻布十番一丁目',
        population: 2431,
        total: 5,
        counts: { shelter: 1, aed: 3, accessible_toilet: 0, water: 1 },
      },
    ])

    expect(csv).toContain('13103008001,港区,麻布十番一丁目,2431,5,1,3,0,1')
  })
})

describe('市区町村の切り出し', () => {
  it('都の前置きが付いていても外す', () => {
    expect(wardOf('東京都港区麻布十番一丁目1-1')).toBe('港区')
    expect(wardOf('東京都千代田区神田小川町二丁目1')).toBe('千代田区')
  })

  it('前置きが無くても取れる', () => {
    expect(wardOf('港区芝公園四丁目')).toBe('港区')
  })

  it('取れなければ空にする（推測で別の自治体名を付けない）', () => {
    expect(wardOf('')).toBe('')
    expect(wardOf('ホーム中央')).toBe('')
  })
})
