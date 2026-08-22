import type { AreaId, AreaSummary } from '@imanouchi/shared'
import { describe, expect, it } from 'vitest'
import { EMERGENCY_MAP_STYLE, MAP_STYLE, mapOptions, mapStyleFor } from './map-options.js'

/**
 * 地図の初期設定。
 *
 * ★ ここで見るのは「外れても地図が表示されてしまう」設定だけである。
 * 言語が外れれば表記が英語に戻り、投影法が外れれば霧の半径がずれる。
 * どちらも画面は出るので、見ただけでは気づけない。
 */

const AREA: AreaSummary = {
  areaId: 'chiyoda-minato' as AreaId,
  name: '千代田区・港区',
  center: { lat: 35.6739, lng: 139.7568 },
  zoom: 15,
}

describe('mapOptions', () => {
  it('★ 地名を日本語で出す（既定では英語表記になる）', () => {
    expect(mapOptions(AREA).language).toBe('ja')
  })

  it('★ 投影法はメルカトルに固定する（霧の半径計算の前提）', () => {
    // 既定の globe のままだと低ズームで霧の半径がずれる
    expect(mapOptions(AREA).projection).toBe('mercator')
  })

  it('★ 帰属表示を消さない（Mapbox の利用規約・FR-02-6）', () => {
    expect(mapOptions(AREA).attributionControl).toBe(true)
  })

  it('漢字・かなを描くフォントを本文と揃える', () => {
    // 指定しないと地図の中だけ別の書体になる
    expect(mapOptions(AREA).localIdeographFontFamily).toContain('Hiragino')
  })

  it('操作部品の文言を日本語にする（読み上げとツールチップ）', () => {
    const locale = mapOptions(AREA).locale

    expect(locale?.['NavigationControl.ZoomIn']).toBe('拡大')
    expect(locale?.['NavigationControl.ZoomOut']).toBe('縮小')
  })

  it('中心とズームはエリア設定から取る（画面側に持たない）', () => {
    const options = mapOptions(AREA)

    expect(options.center).toEqual([AREA.center.lng, AREA.center.lat])
    expect(options.zoom).toBe(AREA.zoom)
  })
})

describe('mapStyleFor', () => {
  it('有事モードでは配色を切り替える（FR-08-2）', () => {
    expect(mapStyleFor(true)).toBe(EMERGENCY_MAP_STYLE)
    expect(mapStyleFor(false)).toBe(MAP_STYLE)
  })

  it('★ 平時と有事で別のスタイルであること（同じだと切替が伝わらない）', () => {
    expect(EMERGENCY_MAP_STYLE).not.toBe(MAP_STYLE)
  })
})
