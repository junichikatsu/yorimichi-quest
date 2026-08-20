import { describe, expect, it } from 'vitest'
import { CHOMES, CHOME_COUNT } from './chome-data.js'
import { chomeByCode, chomeRecordCounts, findChomeAt, tilesInChome } from './chome.js'

/**
 * 町丁目境界の判定（#27）。
 *
 * 生成データなので中身を目で追えない。**代表的な座標が期待どおりの町丁目に入ること**を
 * 固定しておく。間引きで形が崩れると、ここが落ちる。
 */

describe('町丁目データ', () => {
  it('千代田区と港区の全区画がある', () => {
    expect(CHOMES).toHaveLength(CHOME_COUNT)
    expect(CHOME_COUNT).toBe(256)

    const wards = new Set(CHOMES.map((c) => c.ward))
    expect(wards).toEqual(new Set(['千代田区', '港区']))
  })

  it('人口と面積を持つ（充足率の分母になる）', () => {
    const total = CHOMES.reduce((sum, c) => sum + c.population, 0)
    // 国勢調査の両区の人口。桁が変わったら取込を疑う
    expect(total).toBeGreaterThan(300_000)
    expect(total).toBeLessThan(360_000)

    for (const chome of CHOMES) {
      expect(chome.areaM2, chome.name).toBeGreaterThan(0)
      // 人口 0 の町丁目は実在する（丸の内など）ため、下限は 0
      expect(chome.population, chome.name).toBeGreaterThanOrEqual(0)
    }
  })

  it('輪は閉じていて、面になる点数がある', () => {
    for (const chome of CHOMES) {
      expect(chome.rings.length, chome.name).toBeGreaterThan(0)
      for (const ring of chome.rings) {
        expect(ring.length, chome.name).toBeGreaterThanOrEqual(4)
        expect(ring[0]).toEqual(ring[ring.length - 1])
      }
    }
  })
})

describe('座標から町丁目を引く', () => {
  it('皇居前（丸の内）は千代田区に入る', () => {
    const chome = findChomeAt(35.6785, 139.7594)
    expect(chome?.ward).toBe('千代田区')
  })

  it('東京タワー付近は港区に入る', () => {
    const chome = findChomeAt(35.6586, 139.7454)
    expect(chome?.ward).toBe('港区')
  })

  it('区の外は undefined を返す', () => {
    // 新宿区（西へ大きく外れた点）
    expect(findChomeAt(35.6938, 139.7034)).toBeUndefined()
    // 海の上
    expect(findChomeAt(35.4, 139.9)).toBeUndefined()
  })

  it('返る町丁目の外接矩形に、その座標が収まっている', () => {
    const lat = 35.6586
    const lng = 139.7454
    const chome = findChomeAt(lat, lng)
    expect(chome).toBeDefined()
    const [minLng, minLat, maxLng, maxLat] = chome!.bbox
    expect(lng).toBeGreaterThanOrEqual(minLng)
    expect(lng).toBeLessThanOrEqual(maxLng)
    expect(lat).toBeGreaterThanOrEqual(minLat)
    expect(lat).toBeLessThanOrEqual(maxLat)
  })

  it('コードで引ける', () => {
    const first = CHOMES[0]!
    expect(chomeByCode(first.code)?.name).toBe(first.name)
    expect(chomeByCode('99999999999')).toBeUndefined()
  })
})

describe('町丁目ごとの集計', () => {
  it('区の外の点は数えない', () => {
    const counts = chomeRecordCounts([
      { lat: 35.6785, lng: 139.7594, category: 'shelter' },
      // 新宿区。対象外なので集計に出ない
      { lat: 35.6938, lng: 139.7034, category: 'shelter' },
    ])
    expect(counts).toHaveLength(1)
    expect(counts[0]?.total).toBe(1)
  })

  it('1件も無い町丁目は返さない（データが無いことと設備が無いことは違う）', () => {
    const counts = chomeRecordCounts([{ lat: 35.6785, lng: 139.7594, category: 'water' }])
    expect(counts).toHaveLength(1)
    expect(counts[0]?.counts.water).toBe(1)
    expect(counts[0]?.counts.shelter).toBe(0)
  })

  it('件数の多い順に並ぶ', () => {
    const counts = chomeRecordCounts([
      { lat: 35.6586, lng: 139.7454, category: 'aed' },
      { lat: 35.6586, lng: 139.7454, category: 'aed' },
      { lat: 35.6785, lng: 139.7594, category: 'shelter' },
    ])
    expect(counts[0]?.total).toBe(2)
  })
})

describe('踏破率の分母', () => {
  it('面積をタイル面積で割る', () => {
    const chome = CHOMES[0]!
    expect(tilesInChome(chome, 50)).toBe(Math.max(1, Math.round(chome.areaM2 / 2500)))
  })

  it('タイルサイズが 0 以下なら 0', () => {
    expect(tilesInChome(CHOMES[0]!, 0)).toBe(0)
  })
})
