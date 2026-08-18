import { describe, expect, it } from 'vitest'
import { readRetroOptions } from './index.js'
import { NES_PALETTE, nearestNesColor } from './nes-palette.js'

/**
 * 8bit 風表示（spike）の、DOM を使わない部分。
 *
 * 画面に出す部分は canvas と Mapbox が要るので、ここでは URL の解釈とパレットだけを固めている。
 */

describe('readRetroOptions', () => {
  it('?retro=1 で有効になる', () => {
    expect(readRetroOptions('?retro=1').enabled).toBe(true)
    expect(readRetroOptions('?retro=true').enabled).toBe(true)
  })

  it('指定が無い・別の値なら無効', () => {
    expect(readRetroOptions('').enabled).toBe(false)
    expect(readRetroOptions('?retro=0').enabled).toBe(false)
    expect(readRetroOptions('?other=1').enabled).toBe(false)
  })

  it('既定はファミコンの横解像度、ラベルは表示', () => {
    const options = readRetroOptions('?retro=1')
    expect(options.dotWidth).toBe(256)
    expect(options.showLabels).toBe(true)
  })

  it('retroWidth で粗さ、retroLabels=0 でラベルを消せる', () => {
    const options = readRetroOptions('?retro=1&retroWidth=160&retroLabels=0')
    expect(options.dotWidth).toBe(160)
    expect(options.showLabels).toBe(false)
  })

  it('極端な幅は使える範囲へ丸める', () => {
    expect(readRetroOptions('?retroWidth=1').dotWidth).toBe(64)
    expect(readRetroOptions('?retroWidth=99999').dotWidth).toBe(1024)
    expect(readRetroOptions('?retroWidth=abc').dotWidth).toBe(256)
  })
})

describe('nearestNesColor', () => {
  it('パレットは重複の無い 55 色', () => {
    const keys = NES_PALETTE.map((color) => `${color.r},${color.g},${color.b}`)
    expect(new Set(keys).size).toBe(55)
    expect(keys).toHaveLength(55)
  })

  it('パレットにある色はそのまま返る', () => {
    for (const color of NES_PALETTE) {
      expect(nearestNesColor(color)).toEqual(color)
    }
  })

  it('必ずパレットの中から選ぶ', () => {
    const mapped = nearestNesColor({ r: 123, g: 45, b: 67 })
    expect(NES_PALETTE).toContainEqual(mapped)
  })

  it('地図でよく出る色が極端な色へ飛ばない', () => {
    // 水色の面 → 青系へ寄る（緑や赤へ飛ばない）
    const water = nearestNesColor({ r: 160, g: 200, b: 240 })
    expect(water.b).toBeGreaterThan(water.r)

    // 公園の緑 → 緑系へ寄る
    const park = nearestNesColor({ r: 200, g: 230, b: 160 })
    expect(park.g).toBeGreaterThanOrEqual(park.b)
  })
})
