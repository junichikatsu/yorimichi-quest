import { SPOT_CATEGORIES, asAreaId, isSpotId } from '@map-checkin/shared'
import { describe, expect, it } from 'vitest'
import { OPENDATA_SOURCES, OPENDATA_SPOT_COUNT, opendataSpots } from './opendata-spots.js'

/**
 * 取り込んだ実データの検査（FR-10）。
 *
 * 生成ファイルは自動生成なので中身を目で追えない。**壊れ方が静かなので**、
 * ここで固定する。取込スクリプトを直したときに気づけるようにするのが目的である。
 */

const AREA = asAreaId('chiyoda-minato')
const UPDATED_AT = '2026-08-20T00:00:00.000Z'

describe('オープンデータ取込（FR-10）', () => {
  const spots = opendataSpots(AREA, UPDATED_AT)

  it('生成時の件数と一致する', () => {
    expect(spots).toHaveLength(OPENDATA_SPOT_COUNT)
    expect(spots.length).toBeGreaterThan(0)
  })

  it('4カテゴリすべてが存在する（FR-10-1）', () => {
    // 片方の区だけでは AED か公衆トイレが欠ける。両区を取り込む理由そのもの（#6）
    for (const category of SPOT_CATEGORIES) {
      const found = spots.filter((s) => s.category === category)
      expect(found.length, `${category} が 0 件`).toBeGreaterThan(0)
    }
  })

  it('spotId は形式を満たし、重複しない', () => {
    for (const spot of spots) {
      expect(isSpotId(spot.spotId), `不正な spotId: ${spot.spotId}`).toBe(true)
    }
    expect(new Set(spots.map((s) => s.spotId)).size).toBe(spots.length)
  })

  it('座標が都内に収まっている', () => {
    // 港区の AED には箱根の保養施設が混ざっている。取込時に除外できていることを確認する
    for (const spot of spots) {
      expect(spot.lat, spot.name).toBeGreaterThan(35.5)
      expect(spot.lat, spot.name).toBeLessThan(35.9)
      expect(spot.lng, spot.name).toBeGreaterThan(139.5)
      expect(spot.lng, spot.name).toBeLessThan(139.95)
    }
  })

  it('すべてのスポットが出典と取得日を持つ（FR-10-2）', () => {
    const keys = new Set(OPENDATA_SOURCES.map((s) => s.key))
    for (const spot of spots) {
      expect(keys.has(spot.source), `未知の出典: ${spot.source}`).toBe(true)
      expect(spot.fetchedAt).not.toBe('')
    }
  })

  it('areaId は引数に従う（区ごとに固定しない）', () => {
    // 千代田区・港区を1つのパーティションに入れるため（要件定義書 6.2）
    expect(new Set(spots.map((s) => s.areaId))).toEqual(new Set([AREA]))
  })

  it('属性の空欄は取り込まない（未記入と「無い」を混同しない）', () => {
    for (const spot of spots) {
      for (const attribute of spot.attributes) {
        expect(attribute).not.toBe('')
        expect(attribute).toBe(attribute.trim())
      }
    }
  })

  it('出典の件数の合計が、絞り込み前の全件と対応する', () => {
    // 撮影ルートで絞り込むと spots は減るため、合計以下であることだけを固定する
    const declared = OPENDATA_SOURCES.reduce((sum, s) => sum + s.count, 0)
    expect(spots.length).toBeLessThanOrEqual(declared)
  })
})
