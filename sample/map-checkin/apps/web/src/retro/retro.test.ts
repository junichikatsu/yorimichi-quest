import { describe, expect, it } from 'vitest'
import { isRetroEnabled } from './index.js'
import { cubeStripInput } from './lut.js'
import { NES_PALETTE, nearestNesColor } from './nes-palette.js'

/**
 * 8bit 風表示（spike）の、DOM を使わない部分。
 *
 * LUT の生成そのものは canvas が要るので、ここでは軸の対応だけを固めている。
 * この対応を取り違えると地図全体の色が入れ替わるので、リファクタで壊れないようにしておく。
 */

describe('isRetroEnabled', () => {
  it('?retro=1 で有効になる', () => {
    expect(isRetroEnabled('?retro=1')).toBe(true)
    expect(isRetroEnabled('?retro=true')).toBe(true)
  })

  it('指定が無い・別の値なら無効', () => {
    expect(isRetroEnabled('')).toBe(false)
    expect(isRetroEnabled('?retro=0')).toBe(false)
    expect(isRetroEnabled('?other=1')).toBe(false)
  })
})

describe('cubeStripInput', () => {
  const size = 32
  const width = size * size

  it('左上は黒、右下は白', () => {
    expect(cubeStripInput(size, 0, 0)).toEqual({ r: 0, g: 0, b: 0 })
    expect(cubeStripInput(size, width - 1, size - 1)).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('列の中の位置が赤、何枚目の正方形かが青、行が緑', () => {
    // 1 枚目の正方形の右端 → 赤だけが最大
    expect(cubeStripInput(size, size - 1, 0)).toEqual({ r: 255, g: 0, b: 0 })
    // 最後の正方形の左端 → 青だけが最大
    expect(cubeStripInput(size, size * (size - 1), 0)).toEqual({ r: 0, g: 0, b: 255 })
    // 最終行の左端 → 緑だけが最大
    expect(cubeStripInput(size, 0, size - 1)).toEqual({ r: 0, g: 255, b: 0 })
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
