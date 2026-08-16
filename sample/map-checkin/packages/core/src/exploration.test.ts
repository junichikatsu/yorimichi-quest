import { describe, expect, it } from 'vitest'
import {
  interpolatePath,
  summarizeExploration,
  tileAreaM2,
  tileOf,
} from './exploration.js'
import { distanceMeters, formatArea } from './geo.js'

const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 }
const TILE_SIZE_M = 50

describe('tileOf', () => {
  it('同じ座標は同じタイルになる', () => {
    expect(tileOf(TOKYO_STATION, TILE_SIZE_M).key).toBe(tileOf(TOKYO_STATION, TILE_SIZE_M).key)
  })

  it('タイル内で少し動いてもキーは変わらない（重複送信を防げる）', () => {
    const base = tileOf(TOKYO_STATION, TILE_SIZE_M)
    // 中心から 10m 程度ずらす
    const nudged = tileOf({ lat: base.center.lat + 0.00005, lng: base.center.lng }, TILE_SIZE_M)
    expect(nudged.key).toBe(base.key)
  })

  it('1 タイル分ずらすと別のタイルになる', () => {
    const base = tileOf(TOKYO_STATION, TILE_SIZE_M)
    const north = tileOf({ ...base.center, lat: base.center.lat + 0.00045 }, TILE_SIZE_M)
    const east = tileOf({ ...base.center, lng: base.center.lng + 0.00045 }, TILE_SIZE_M)

    expect(north.key).not.toBe(base.key)
    expect(east.key).not.toBe(base.key)
  })

  it('真北へ歩いても経度がずれない（軌跡が斜めに流れない）', () => {
    // 経度の刻みを行ごとに計算すると、列番号（25 万前後）に幅の差が掛かって大きくずれる
    const centers = [0, 0.00045, 0.0009, 0.00135, 0.0018].map(
      (offset) => tileOf({ ...TOKYO_STATION, lat: TOKYO_STATION.lat + offset }, TILE_SIZE_M).center,
    )

    for (const center of centers) {
      expect(center.lng).toBe(centers[0]?.lng)
    }
  })

  it('隣り合うタイルは霧の半径（40m）で繋がる間隔に収まる', () => {
    const base = tileOf(TOKYO_STATION, TILE_SIZE_M)
    const north = tileOf({ ...base.center, lat: base.center.lat + 0.00045 }, TILE_SIZE_M)
    const east = tileOf({ ...base.center, lng: base.center.lng + 0.00045 }, TILE_SIZE_M)

    // 中心間の距離が半径 2 つ分（80m）未満なら、円が重なって軌跡が途切れない
    expect(distanceMeters(base.center, north.center)).toBeLessThan(80)
    expect(distanceMeters(base.center, east.center)).toBeLessThan(80)
  })

  it('中心は元の座標からタイル半分以内にある', () => {
    const tile = tileOf(TOKYO_STATION, TILE_SIZE_M)
    // 正方形タイルなので中心までの最大距離は対角線の半分
    expect(distanceMeters(TOKYO_STATION, tile.center)).toBeLessThan(TILE_SIZE_M * 0.71)
  })

  it('中心を入れ直しても同じタイルへ戻る（往復して壊れない）', () => {
    const tile = tileOf(TOKYO_STATION, TILE_SIZE_M)
    expect(tileOf(tile.center, TILE_SIZE_M).key).toBe(tile.key)
  })

  it('南半球・西経でも往復する', () => {
    const sydney = { lat: -33.8688, lng: 151.2093 }
    const lima = { lat: -12.0464, lng: -77.0428 }

    for (const position of [sydney, lima]) {
      const tile = tileOf(position, TILE_SIZE_M)
      expect(tileOf(tile.center, TILE_SIZE_M).key).toBe(tile.key)
      expect(distanceMeters(position, tile.center)).toBeLessThan(TILE_SIZE_M * 0.71)
    }
  })

  it('タイル幅を変えると別のグリッドになる', () => {
    expect(tileOf(TOKYO_STATION, 50).key).not.toBe(tileOf(TOKYO_STATION, 200).key)
  })
})

describe('tileAreaM2', () => {
  it('赤道では tileSizeM の 2 乗', () => {
    expect(tileAreaM2(50, 0)).toBeCloseTo(2500, 5)
  })

  it('緯度が上がるほど横幅が縮んで面積が減る', () => {
    // 北緯 35 度では 50m × 約 41m
    expect(tileAreaM2(50, 35.68)).toBeCloseTo(2031, 0)
    expect(tileAreaM2(50, 60)).toBeLessThan(tileAreaM2(50, 35.68))
  })

  it('極でも 0 にはならない（面積がゼロ除算の種にならない）', () => {
    expect(tileAreaM2(50, 90)).toBeGreaterThan(0)
  })
})

describe('summarizeExploration', () => {
  const areaRadiusM = 1500
  const latitude = 35.6785

  it('未探索は 0%', () => {
    expect(
      summarizeExploration({ tileCount: 0, tileSizeM: 50, latitude, areaRadiusM, truncated: false }),
    ).toEqual({ tileCount: 0, exploredAreaM2: 0, coveragePercent: 0, truncated: false })
  })

  it('面積はタイル数 × タイル面積', () => {
    const summary = summarizeExploration({
      tileCount: 20,
      tileSizeM: 50,
      latitude,
      areaRadiusM,
      truncated: false,
    })
    expect(summary.exploredAreaM2).toBe(Math.round(20 * tileAreaM2(50, latitude)))
    // 約 40,600m² / (π × 1500²) ≒ 0.57%
    expect(summary.coveragePercent).toBeCloseTo(0.57, 1)
  })

  it('対象エリアを超えても 100% で頭打ちにする', () => {
    const summary = summarizeExploration({
      tileCount: 1_000_000,
      tileSizeM: 50,
      latitude,
      areaRadiusM,
      truncated: true,
    })
    expect(summary.coveragePercent).toBe(100)
    expect(summary.truncated).toBe(true)
  })
})

describe('interpolatePath', () => {
  const goal = { lat: 35.6739, lng: 139.7568 }

  it('終点を含み、始点は含まない（始点は記録済みのため）', () => {
    const path = interpolatePath(TOKYO_STATION, goal, 50, 200)

    expect(path.at(-1)).toEqual(goal)
    expect(path[0]).not.toEqual(TOKYO_STATION)
  })

  it('刻み幅ごとにおおよそ 1 点を置く', () => {
    const total = distanceMeters(TOKYO_STATION, goal)
    const path = interpolatePath(TOKYO_STATION, goal, 50, 200)

    expect(path.length).toBe(Math.ceil(total / 50))
  })

  it('連続する点の間隔は刻み幅を超えない（軌跡が飛ばない）', () => {
    const path = interpolatePath(TOKYO_STATION, goal, 50, 200)
    let previous = TOKYO_STATION

    for (const point of path) {
      expect(distanceMeters(previous, point)).toBeLessThanOrEqual(50)
      previous = point
    }
  })

  it('maxPoints を超えない（送信上限を破らない）', () => {
    const faraway = { lat: 35.9, lng: 140.2 }
    expect(interpolatePath(TOKYO_STATION, faraway, 50, 200)).toHaveLength(200)
  })

  it('同一地点でも空にはならない', () => {
    expect(interpolatePath(TOKYO_STATION, TOKYO_STATION, 50, 200)).toHaveLength(1)
  })
})

describe('formatArea', () => {
  it('1ha 未満は m² 表記', () => {
    expect(formatArea(2500)).toBe('2500m²')
  })

  it('1ha 以上は km² 表記', () => {
    expect(formatArea(180_000)).toBe('0.18km²')
  })
})
