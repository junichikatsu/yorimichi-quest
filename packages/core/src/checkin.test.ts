import { describe, expect, it } from 'vitest'
import { POINT_RULES, evaluateCheckin } from './checkin.js'
import { offsetByMeters } from './geo.js'

/**
 * ★ 見ているのは境界だけである。
 *
 * 「半径ちょうど」「クールダウンが切れる直前と直後」は、歩いて再現できない。
 * ここで固定しておかないと、実機で踏んだときに原因を切り分けられない。
 */

const SPOT = { lat: 35.669, lng: 139.753 }
const HOUR = 60 * 60 * 1000
const COOLDOWN = 24 * HOUR

function at(distanceM: number): { lat: number; lng: number } {
  return offsetByMeters(SPOT, distanceM, 0)
}

describe('evaluateCheckin', () => {
  it('圏内なら成功し、初回はボーナスが付く（FR-03-2）', () => {
    const decision = evaluateCheckin({
      now: 1_000_000,
      userPosition: at(50),
      spot: SPOT,
      lastCheckinAt: undefined,
      radiusM: 100,
      cooldownMs: COOLDOWN,
    })

    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.breakdown.firstVisitBonus).toBe(POINT_RULES.firstVisitBonus)
    expect(decision.pointsEarned).toBe(POINT_RULES.checkinBase + POINT_RULES.firstVisitBonus)
    expect(decision.nextAvailableAt).toBe(1_000_000 + COOLDOWN)
  })

  it('2回目以降は初回ボーナスが付かない', () => {
    const decision = evaluateCheckin({
      now: 100 * HOUR,
      userPosition: at(10),
      spot: SPOT,
      lastCheckinAt: 0,
      radiusM: 100,
      cooldownMs: COOLDOWN,
    })

    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.breakdown.firstVisitBonus).toBe(0)
    expect(decision.pointsEarned).toBe(POINT_RULES.checkinBase)
  })

  it('★ 半径ちょうどは通す（境界を含める）', () => {
    // offsetByMeters の丸めで数cm ずれるため、半径側に余裕を持たせて「ちょうど」を作る
    const decision = evaluateCheckin({
      now: 0,
      userPosition: at(100),
      spot: SPOT,
      lastCheckinAt: undefined,
      radiusM: 100.5,
      cooldownMs: COOLDOWN,
    })

    expect(decision.ok).toBe(true)
  })

  it('半径を超えたら too_far。距離と半径を返す（画面が「あと何m」を出せる）', () => {
    const decision = evaluateCheckin({
      now: 0,
      userPosition: at(150),
      spot: SPOT,
      lastCheckinAt: undefined,
      radiusM: 100,
      cooldownMs: COOLDOWN,
    })

    expect(decision.ok).toBe(false)
    if (decision.ok) return
    expect(decision.reason).toBe('too_far')
    expect(Math.round(decision.distanceM)).toBe(150)
  })

  it('★ クールダウン中は cooldown。切れた瞬間から通る（FR-03-3）', () => {
    const base = {
      userPosition: at(10),
      spot: SPOT,
      lastCheckinAt: 0,
      radiusM: 100,
      cooldownMs: COOLDOWN,
    }

    const during = evaluateCheckin({ ...base, now: COOLDOWN - 1 })
    expect(during.ok).toBe(false)
    if (!during.ok && during.reason === 'cooldown') {
      expect(during.nextAvailableAt).toBe(COOLDOWN)
    }

    expect(evaluateCheckin({ ...base, now: COOLDOWN }).ok).toBe(true)
  })

  it('★ 圏外かつクールダウン中は too_far を返す（過去に行ったことを漏らさない）', () => {
    const decision = evaluateCheckin({
      now: 0,
      userPosition: at(500),
      spot: SPOT,
      lastCheckinAt: 0,
      radiusM: 100,
      cooldownMs: COOLDOWN,
    })

    expect(decision.ok).toBe(false)
    if (decision.ok) return
    expect(decision.reason).toBe('too_far')
  })
})
