import { distanceMeters } from '@map-checkin/core'
import type { SpotWithDistance } from '@map-checkin/shared'
import { describe, expect, it } from 'vitest'
import { withLocalDistance } from './spots.js'

/**
 * 距離をクライアントで付け直す処理のテスト。
 *
 * ここが壊れると「圏内なのにチェックインできない」など、通信を減らした副作用が
 * そのまま体験の不具合になるため、サーバー（decorateSpot）と同じ結果になることを固定する。
 */

const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 }

function spot(name: string, lat: number, lng: number): SpotWithDistance {
  return {
    spotId: name as SpotWithDistance['spotId'],
    areaId: 'chiyoda' as SpotWithDistance['areaId'],
    name,
    category: 'shelter',
    lat,
    lng,
    address: '—',
    attributes: [],
    source: 'test',
    fetchedAt: '2026-08-19',
    checkinCount: 0,
    updatedAt: '2026-08-19',
    // サーバーから来た値。位置に依らないのでそのまま残ること
    distanceM: 99999,
    unexplored: true,
    pointMultiplier: 3,
  }
}

const NEAR = spot('近い', 35.6815, 139.7672)
const FAR = spot('遠い', 35.69, 139.78)

describe('withLocalDistance', () => {
  it('現在地からの距離を付け、近い順に並べ替える', () => {
    const result = withLocalDistance([FAR, NEAR], TOKYO_STATION)

    expect(result.map((s) => s.name)).toEqual(['近い', '遠い'])
    expect(result[0]?.distanceM).toBeCloseTo(distanceMeters(TOKYO_STATION, NEAR), 6)
  })

  it('位置が無ければ距離は null にして名前順に並べる', () => {
    const result = withLocalDistance([NEAR, FAR], undefined)

    expect(result.every((s) => s.distanceM === null)).toBe(true)
    expect(result.map((s) => s.name)).toEqual(['近い', '遠い'].sort((a, b) => a.localeCompare(b, 'ja')))
  })

  it('距離以外のサーバー由来の値は変えない（未開拓判定・倍率）', () => {
    const result = withLocalDistance([NEAR], TOKYO_STATION)

    expect(result[0]?.unexplored).toBe(true)
    expect(result[0]?.pointMultiplier).toBe(3)
    expect(result[0]?.checkinCount).toBe(0)
  })

  it('元の配列を書き換えない（再レンダーのたびに副作用が積み上がらない）', () => {
    const input = [FAR, NEAR]
    withLocalDistance(input, TOKYO_STATION)

    expect(input.map((s) => s.name)).toEqual(['遠い', '近い'])
    expect(input[0]?.distanceM).toBe(99999)
  })
})
