import type { AreaId, SpotId, SpotWithDistance } from '@imanouchi/shared'
import { describe, expect, it } from 'vitest'
import { EXIT_MARGIN_M, initialNearby, trackNearby, type NearbyTracker } from './nearby.js'

/**
 * 到着の検出。
 *
 * ★ 守りたいのは「鳴りすぎない」ことである。ポケットに入れて歩く前提なので、
 * 圏界で鳴り続けたり、開いた瞬間にまとめて鳴ったりすれば**音を切られる**。
 * 切られたら FR-02-10 の仕組みそのものが死ぬ。
 */

function spot(id: string, distanceM: number | null): SpotWithDistance {
  return {
    spotId: id as SpotId,
    areaId: 'chiyoda' as AreaId,
    name: `スポット${id}`,
    category: 'shelter',
    lat: 35.68,
    lng: 139.76,
    address: '',
    attributes: [],
    source: '',
    fetchedAt: '',
    checkinCount: 0,
    surveyStats: {},
    updatedAt: '',
    distanceM,
  }
}

const RADIUS = 100

/** 最初の1回で圏内を覚えさせた状態を作る（以降の判定が本題なので） */
function seeded(spots: SpotWithDistance[]): NearbyTracker {
  return trackNearby(initialNearby(), { radiusM: RADIUS, spots }).tracker
}

describe('trackNearby', () => {
  it('★ 最初の判定では知らせない（開いた瞬間にまとめて鳴らない）', () => {
    const step = trackNearby(initialNearby(), { radiusM: RADIUS, spots: [spot('a', 10), spot('b', 20)] })

    expect(step.arrived).toEqual([])
    // 覚えてはいる。次に離れて戻れば知らせる
    expect(step.tracker.inside).toEqual(['a', 'b'])
    expect(step.tracker.seeded).toBe(true)
  })

  it('圏内へ入ったら知らせる', () => {
    const tracker = seeded([spot('a', 300)])
    const step = trackNearby(tracker, { radiusM: RADIUS, spots: [spot('a', 90)] })

    expect(step.arrived.map((s) => s.spotId)).toEqual(['a'])
  })

  it('★ 1スポット1回だけ知らせる（圏内に留まっても鳴り続けない）', () => {
    let tracker = seeded([spot('a', 300)])
    const first = trackNearby(tracker, { radiusM: RADIUS, spots: [spot('a', 90)] })
    expect(first.arrived).toHaveLength(1)

    tracker = first.tracker
    for (const distance of [80, 95, 99, 60]) {
      const step = trackNearby(tracker, { radiusM: RADIUS, spots: [spot('a', distance)] })
      expect(step.arrived).toEqual([])
      tracker = step.tracker
    }
  })

  it('★ 圏界で揺れても鳴り続けない（出るには余白のぶん離れる必要がある）', () => {
    const entered = trackNearby(seeded([spot('a', 300)]), {
      radiusM: RADIUS,
      spots: [spot('a', 99)],
    })

    // 半径をわずかに超えただけでは「出た」と見なさない
    const drifted = trackNearby(entered.tracker, {
      radiusM: RADIUS,
      spots: [spot('a', RADIUS + EXIT_MARGIN_M - 1)],
    })
    expect(drifted.tracker.inside).toEqual(['a'])

    // 戻ってきても新しい到着にはならない（ここが鳴り続けの正体）
    const back = trackNearby(drifted.tracker, { radiusM: RADIUS, spots: [spot('a', 90)] })
    expect(back.arrived).toEqual([])
  })

  it('離れたら再武装する（また来たときに知らせる）', () => {
    const entered = trackNearby(seeded([spot('a', 300)]), {
      radiusM: RADIUS,
      spots: [spot('a', 50)],
    })

    const left = trackNearby(entered.tracker, {
      radiusM: RADIUS,
      spots: [spot('a', RADIUS + EXIT_MARGIN_M + 1)],
    })
    expect(left.tracker.inside).toEqual([])

    const again = trackNearby(left.tracker, { radiusM: RADIUS, spots: [spot('a', 40)] })
    expect(again.arrived.map((s) => s.spotId)).toEqual(['a'])
  })

  it('★ 距離が付いていないあいだは判定を進めない（測位が切れただけで再武装しない）', () => {
    const entered = trackNearby(seeded([spot('a', 300)]), {
      radiusM: RADIUS,
      spots: [spot('a', 50)],
    })

    // 現在地を失った状態。ここで「圏外」にすると、戻った瞬間にもう一度鳴る
    const lost = trackNearby(entered.tracker, { radiusM: RADIUS, spots: [spot('a', null)] })
    expect(lost.tracker.inside).toEqual(['a'])

    const back = trackNearby(lost.tracker, { radiusM: RADIUS, spots: [spot('a', 50)] })
    expect(back.arrived).toEqual([])
  })

  it('★ スポットが未取得のうちは何も確定させない（届いた瞬間に全件が到着になる）', () => {
    const step = trackNearby(initialNearby(), { radiusM: RADIUS, spots: [] })

    expect(step.tracker.seeded).toBe(false)

    // 位置が取れていない（距離が無い）場合も同じ
    const noPosition = trackNearby(initialNearby(), { radiusM: RADIUS, spots: [spot('a', null)] })
    expect(noPosition.tracker.seeded).toBe(false)
  })

  it('複数まとめて入ったら近い順に返す', () => {
    const tracker = seeded([spot('far', 400), spot('near', 500)])
    const step = trackNearby(tracker, { radiusM: RADIUS, spots: [spot('far', 80), spot('near', 20)] })

    expect(step.arrived.map((s) => s.spotId)).toEqual(['near', 'far'])
  })

  it('半径は引数で変わる（サーバーの設定に従う）', () => {
    const tracker = seeded([spot('a', 300)])

    expect(trackNearby(tracker, { radiusM: 100, spots: [spot('a', 200)] }).arrived).toEqual([])
    expect(
      trackNearby(tracker, { radiusM: 300, spots: [spot('a', 200)] }).arrived.map((s) => s.spotId),
    ).toEqual(['a'])
  })
})
