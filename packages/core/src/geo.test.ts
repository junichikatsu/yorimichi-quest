import { describe, expect, it } from 'vitest'
import { distanceMeters, formatDistance, offsetByMeters } from './geo.js'

const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 }
const HIBIYA_PARK = { lat: 35.6739, lng: 139.7568 }

describe('distanceMeters', () => {
  it('同じ点なら 0', () => {
    expect(distanceMeters(TOKYO_STATION, TOKYO_STATION)).toBeCloseTo(0, 6)
  })

  it('東京駅と日比谷公園は約 1.2km', () => {
    const d = distanceMeters(TOKYO_STATION, HIBIYA_PARK)
    expect(d).toBeGreaterThan(1000)
    expect(d).toBeLessThan(1500)
  })

  it('向きを変えても同じ距離になる', () => {
    expect(distanceMeters(TOKYO_STATION, HIBIYA_PARK)).toBeCloseTo(
      distanceMeters(HIBIYA_PARK, TOKYO_STATION),
      6,
    )
  })
})

describe('offsetByMeters', () => {
  it('北へ 1000m ずらすと距離も約 1000m になる', () => {
    const moved = offsetByMeters(TOKYO_STATION, 0, 1000)
    expect(distanceMeters(TOKYO_STATION, moved)).toBeGreaterThan(995)
    expect(distanceMeters(TOKYO_STATION, moved)).toBeLessThan(1005)
  })

  it('★ 東へのずれに緯度補正が入っている', () => {
    const moved = offsetByMeters(TOKYO_STATION, 1000, 0)
    const d = distanceMeters(TOKYO_STATION, moved)
    // 補正が無いと cos(35.68) ぶん（約 813m）に縮む
    expect(d).toBeGreaterThan(995)
    expect(d).toBeLessThan(1005)
  })
})

describe('formatDistance', () => {
  it('1km 未満は m、以上は km で丸める', () => {
    expect(formatDistance(0)).toBe('0m')
    expect(formatDistance(85)).toBe('85m')
    expect(formatDistance(1500)).toBe('1.5km')
  })
})
