import { offsetByMeters } from '@imanouchi/core'
import { describe, expect, it } from 'vitest'
import { initialWalkTracker, speedKmh, trackWalk, type WalkSample } from './walking.js'

/**
 * 歩行の判定。
 *
 * ★ 守りたいのは「信号待ちで解除されない」「GPS の揺れで点滅しない」こと。
 * どちらも歩行中モードが実用にならなくなる壊れ方である。
 */

const START = { lat: 35.6739, lng: 139.7568 }

/** 現在地から北へ meters 進んだ地点を、seconds 後の測位として作る */
function step(from: WalkSample, meters: number, seconds: number): WalkSample {
  const moved = offsetByMeters(from, 0, meters)
  return { ...moved, at: from.at + seconds * 1000 }
}

function sample(at = 0): WalkSample {
  return { ...START, at }
}

/** 一定の速さで歩き続けたときの状態 */
function walkAt(mps: number, seconds: number, steps = 3) {
  let tracker = trackWalk(initialWalkTracker(), sample(0))
  let current = sample(0)

  for (let i = 0; i < steps; i += 1) {
    current = step(current, mps * seconds, seconds)
    tracker = trackWalk(tracker, current)
  }
  return { tracker, current }
}

describe('trackWalk', () => {
  it('最初の1件では判定しない（速度を出せない）', () => {
    const tracker = trackWalk(initialWalkTracker(), sample(0))

    expect(tracker.walking).toBe(false)
    expect(tracker.anchor).toBeDefined()
  })

  it('歩く速さ（1.3m/s）が続けば歩行中になる', () => {
    expect(walkAt(1.3, 5).tracker.walking).toBe(true)
  })

  it('ゆっくり歩き（0.8m/s）では歩行中にしない', () => {
    // 閾値未満。誤って画面を止めるより、出さないほうを選ぶ
    expect(walkAt(0.8, 5).tracker.walking).toBe(false)
  })

  it('★ 間隔が短いうちは基準を動かさない（速度が 0 に潰れない）', () => {
    const first = trackWalk(initialWalkTracker(), sample(0))
    // 1 秒後に 1m。間隔が足りないので判定しない
    const second = trackWalk(first, step(sample(0), 1, 1))

    expect(second).toBe(first)
    expect(second.anchor?.at).toBe(0)

    // 基準が残っているので、間隔が足りた時点で正しく速度が出る
    const third = trackWalk(second, step(sample(0), 20, 5))
    expect(third.speedMps).toBeCloseTo(4, 0)
  })

  it('★ 信号待ち程度の停止では解除されない（低い閾値で見る）', () => {
    const walking = walkAt(1.3, 5)
    expect(walking.tracker.walking).toBe(true)

    // 30 秒でわずか 12m（0.4m/s）。立ち止まってはいるが解除しない
    const waiting = trackWalk(walking.tracker, step(walking.current, 12, 30))
    expect(waiting.walking).toBe(true)
  })

  it('本当に止まれば解除される', () => {
    const walking = walkAt(1.3, 5)

    // 30 秒で 3m（0.1m/s）。GPS の揺れの範囲であり、止まっている
    const stopped = trackWalk(walking.tracker, step(walking.current, 3, 30))
    expect(stopped.walking).toBe(false)
  })

  it('★ 揺れで点滅しない（歩行中に一度速度が落ちても戻せる）', () => {
    let tracker = walkAt(1.3, 5).tracker
    let current = step(sample(0), 1.3 * 15, 15)

    // 歩・揺れ・歩 と続く並び。閾値が1つだと walking が false→true を繰り返す
    for (const meters of [6.5, 2.5, 6.5, 2.5, 6.5]) {
      current = step(current, meters, 5)
      tracker = trackWalk(tracker, current)
      expect(tracker.walking, `${meters}m/5s で解除された`).toBe(true)
    }
  })

  it('時刻が巻き戻っても壊れない', () => {
    const first = trackWalk(initialWalkTracker(), sample(10_000))
    const back = trackWalk(first, { ...START, at: 0 })

    expect(back).toBe(first)
  })
})

describe('speedKmh', () => {
  it('m/s を km/h に直す', () => {
    expect(speedKmh({ walking: true, speedMps: 1.3, anchor: undefined })).toBe(4.7)
    expect(speedKmh(initialWalkTracker())).toBe(0)
  })
})
