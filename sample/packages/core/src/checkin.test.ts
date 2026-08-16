import { describe, expect, it } from 'vitest'
import { classifyExploration, evaluateCheckin, POINT_RULES } from './checkin.js'
import { distanceMeters, formatDistance } from './geo.js'

const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 }
const HOUR = 60 * 60 * 1000

describe('distanceMeters', () => {
  it('同一地点は 0m', () => {
    expect(distanceMeters(TOKYO_STATION, TOKYO_STATION)).toBe(0)
  })

  it('緯度 0.001 度の差はおよそ 111m', () => {
    const d = distanceMeters(TOKYO_STATION, { ...TOKYO_STATION, lat: TOKYO_STATION.lat + 0.001 })
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(120)
  })
})

describe('formatDistance', () => {
  it('1km 未満は m 表記', () => {
    expect(formatDistance(87.4)).toBe('87m')
  })

  it('1km 以上は km 表記', () => {
    expect(formatDistance(1540)).toBe('1.5km')
  })
})

describe('classifyExploration', () => {
  it('チェックイン 0 件は 3 倍の未開拓ゾーン', () => {
    expect(classifyExploration(0)).toEqual({ unexplored: true, multiplier: 3 })
  })

  it('4 件までは 2 倍', () => {
    expect(classifyExploration(4)).toEqual({ unexplored: true, multiplier: 2 })
  })

  it('5 件以上は等倍で未開拓ではない', () => {
    expect(classifyExploration(5)).toEqual({ unexplored: false, multiplier: 1 })
  })
})

describe('evaluateCheckin', () => {
  const base = {
    now: 1_700_000_000_000,
    userPosition: TOKYO_STATION,
    radiusM: 100,
    cooldownMs: 24 * HOUR,
  }

  it('圏内かつ初回はボーナス込みで付与する', () => {
    const result = evaluateCheckin({
      ...base,
      spot: { ...TOKYO_STATION, checkinCount: 0 },
      lastCheckinAt: undefined,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pointsEarned).toBe(POINT_RULES.checkinBase * 3 + POINT_RULES.firstVisitBonus)
    expect(result.breakdown).toEqual({ base: 10, multiplier: 3, firstVisitBonus: 20 })
    expect(result.nextAvailableAt).toBe(base.now + base.cooldownMs)
  })

  it('2 回目以降は初回ボーナスが付かない', () => {
    const result = evaluateCheckin({
      ...base,
      spot: { ...TOKYO_STATION, checkinCount: 10 },
      lastCheckinAt: base.now - 25 * HOUR,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pointsEarned).toBe(POINT_RULES.checkinBase)
    expect(result.breakdown.firstVisitBonus).toBe(0)
  })

  it('半径を超えると too_far で弾く', () => {
    const result = evaluateCheckin({
      ...base,
      // 緯度 +0.01 度 ≒ 1.1km
      spot: { lat: TOKYO_STATION.lat + 0.01, lng: TOKYO_STATION.lng, checkinCount: 0 },
      lastCheckinAt: undefined,
    })

    expect(result).toMatchObject({ ok: false, reason: 'too_far', radiusM: 100 })
  })

  it('境界（半径ちょうど）は許可する', () => {
    const spot = { lat: TOKYO_STATION.lat, lng: TOKYO_STATION.lng, checkinCount: 0 }
    const exact = distanceMeters(base.userPosition, spot)
    const result = evaluateCheckin({ ...base, spot, lastCheckinAt: undefined, radiusM: exact })

    expect(result.ok).toBe(true)
  })

  it('クールダウン中は cooldown で弾き、再開可能時刻を返す', () => {
    const lastCheckinAt = base.now - 3 * HOUR
    const result = evaluateCheckin({
      ...base,
      spot: { ...TOKYO_STATION, checkinCount: 3 },
      lastCheckinAt,
    })

    expect(result).toMatchObject({ ok: false, reason: 'cooldown' })
    if (result.ok || result.reason !== 'cooldown') return
    expect(result.nextAvailableAt).toBe(lastCheckinAt + 24 * HOUR)
  })

  it('クールダウン明けちょうどは許可する', () => {
    const result = evaluateCheckin({
      ...base,
      spot: { ...TOKYO_STATION, checkinCount: 3 },
      lastCheckinAt: base.now - 24 * HOUR,
    })

    expect(result.ok).toBe(true)
  })

  it('距離判定はクールダウン判定より先に効く', () => {
    const result = evaluateCheckin({
      ...base,
      spot: { lat: TOKYO_STATION.lat + 0.01, lng: TOKYO_STATION.lng, checkinCount: 0 },
      lastCheckinAt: base.now - 1 * HOUR,
    })

    expect(result).toMatchObject({ ok: false, reason: 'too_far' })
  })
})
