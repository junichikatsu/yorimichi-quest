import { describe, expect, it } from 'vitest'
import {
  areaKeyOf,
  chomeOfTile,
  effectiveTileCount,
  interpolatePath,
  summarizeExploration,
  tilesNeededToUnlock,
  tilesPerArea,
  unlockedAreas,
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

/**
 * 区画（町丁目）単位の開放（#27）。
 *
 * タイルを 1 枚ずつ塗るだけでは区画全体を晴らすのに歩きすぎるため、
 * 一定割合で全面を開放する。判定は FE と BE の両方から同じ関数を呼ぶので、
 * ここがずれると「見た目は晴れているのに探索率が上がらない」ことになる。
 *
 * ★ 区画は格子ではなく実在の町丁目なので、**実座標でしかテストできない**。
 * 原点付近の合成キーはギニア湾の海上になり、どの町丁目にも入らない。
 */
const UNLOCK = { tileSizeM: 50, unlockRatio: 0.25, unlockMaxTiles: 12 }

/** 日比谷公園（千代田区）。サンプルの導線がここを通る */
const HIBIYA = { lat: 35.6739, lng: 139.7568 }
/** 東京タワー付近（港区） */
const TOKYO_TOWER = { lat: 35.6586, lng: 139.7454 }

/**
 * ある地点と**同じ町丁目に入るタイル**だけを集める。
 *
 * ★ 東へ一列に並べてはいけない。50m タイル 12 枚は 600m あり、途中で隣の町丁目へ
 * 抜けてしまう（実際にそれで開放が起きなかった）。町丁目は格子ではないので、
 * 周囲を走査して同じ区画のものだけを拾う。
 */
function tilesOfChome(origin: { lat: number; lng: number }, count: number): string[] {
  const step = 50 / 111_320
  const target = chomeOfTile(tileOf(origin, 50).key, 50)
  expect(target).toBeDefined()

  const keys: string[] = []
  for (let row = -20; row <= 20 && keys.length < count; row += 1) {
    for (let col = -20; col <= 20 && keys.length < count; col += 1) {
      const key = tileOf({ lat: origin.lat + row * step, lng: origin.lng + col * step }, 50).key
      if (chomeOfTile(key, 50)?.code === target!.code) keys.push(key)
    }
  }
  return keys
}

/** その地点の町丁目 */
function chomeAt(position: { lat: number; lng: number }) {
  const chome = chomeOfTile(tileOf(position, 50).key, 50)
  expect(chome).toBeDefined()
  return chome!
}

describe('areaKeyOf（タイル → 町丁目）', () => {
  it('同じ町丁目のタイルは同じキーになる', () => {
    const keys = tilesOfChome(HIBIYA, 2)
    expect(keys).toHaveLength(2)
    expect(areaKeyOf(keys[0]!, 50)).toBe(areaKeyOf(keys[1]!, 50))
  })

  it('別の区の町丁目は別のキーになる', () => {
    const chiyoda = areaKeyOf(tileOf(HIBIYA, 50).key, 50)
    const minato = areaKeyOf(tileOf(TOKYO_TOWER, 50).key, 50)
    expect(chiyoda).toBeDefined()
    expect(minato).toBeDefined()
    expect(chiyoda).not.toBe(minato)
  })

  it('小地域コードを返す（丁目のない町字は9桁、丁目ありは11桁）', () => {
    expect(areaKeyOf(tileOf(HIBIYA, 50).key, 50)).toMatch(/^\d{9,11}$/)
    expect(areaKeyOf(tileOf(TOKYO_TOWER, 50).key, 50)).toMatch(/^\d{9,11}$/)
  })

  it('境界データの外は undefined（区画開放が起きない）', () => {
    // 新宿区。両区の境界データを持っていないので区画にならない
    expect(areaKeyOf(tileOf({ lat: 35.6938, lng: 139.7034 }, 50).key, 50)).toBeUndefined()
  })

  it('壊れたキーは undefined', () => {
    expect(areaKeyOf('abc', 50)).toBeUndefined()
    expect(areaKeyOf('1', 50)).toBeUndefined()
  })
})

describe('tilesNeededToUnlock', () => {
  it('割合で決まるが、上限を超えない', () => {
    for (const position of [HIBIYA, TOKYO_TOWER]) {
      const needed = tilesNeededToUnlock(chomeAt(position), UNLOCK)
      expect(needed).toBeLessThanOrEqual(UNLOCK.unlockMaxTiles)
      expect(needed).toBeGreaterThan(0)
    }
  })

  it('上限を下げれば必要枚数も下がる', () => {
    const chome = chomeAt(TOKYO_TOWER)
    const strict = tilesNeededToUnlock(chome, UNLOCK)
    const loose = tilesNeededToUnlock(chome, { ...UNLOCK, unlockMaxTiles: 3 })
    expect(loose).toBeLessThanOrEqual(strict)
    expect(loose).toBe(3)
  })

  it('区画のタイル数そのものを超えて要求しない', () => {
    const chome = chomeAt(HIBIYA)
    const total = tilesPerArea(chome, 50)
    expect(tilesNeededToUnlock(chome, { ...UNLOCK, unlockMaxTiles: 10_000 })).toBeLessThanOrEqual(total)
  })
})

describe('unlockedAreas', () => {
  it('必要枚数に1枚足りなければ開かない', () => {
    const needed = tilesNeededToUnlock(chomeAt(HIBIYA), UNLOCK)
    expect(unlockedAreas(tilesOfChome(HIBIYA, needed - 1), UNLOCK)).toHaveLength(0)
  })

  it('必要枚数を歩けば開き、町丁目名が返る', () => {
    const chome = chomeAt(HIBIYA)
    const needed = tilesNeededToUnlock(chome, UNLOCK)
    const areas = unlockedAreas(tilesOfChome(HIBIYA, needed), UNLOCK)

    expect(areas).toHaveLength(1)
    expect(areas[0]?.areaKey).toBe(chome.code)
    expect(areas[0]?.name).toBe(chome.name)
    expect(areas[0]?.ward).toBe('千代田区')
  })

  it('境界データの外を歩いても区画は開かない', () => {
    const step = 50 / 111_320
    const outside = Array.from(
      { length: 30 },
      (_, i) => tileOf({ lat: 35.6938 + i * step, lng: 139.7034 }, 50).key,
    )
    expect(unlockedAreas(outside, UNLOCK)).toHaveLength(0)
  })

  it('別々の町丁目は個別に判定される', () => {
    const hibiya = chomeAt(HIBIYA)
    const tower = chomeAt(TOKYO_TOWER)
    const keys = [
      ...tilesOfChome(HIBIYA, tilesNeededToUnlock(hibiya, UNLOCK)),
      // 港区側は1枚だけ（開かない）
      ...tilesOfChome(TOKYO_TOWER, 1),
    ]
    const areas = unlockedAreas(keys, UNLOCK)

    expect(areas).toHaveLength(1)
    expect(areas[0]?.areaKey).toBe(hibiya.code)
    expect(areas[0]?.areaKey).not.toBe(tower.code)
  })

  it('返り順はコード順で安定する', () => {
    const keys = [
      ...tilesOfChome(HIBIYA, tilesNeededToUnlock(chomeAt(HIBIYA), UNLOCK)),
      ...tilesOfChome(TOKYO_TOWER, tilesNeededToUnlock(chomeAt(TOKYO_TOWER), UNLOCK)),
    ]
    const codes = unlockedAreas(keys, UNLOCK).map((a) => a.areaKey)
    expect(codes.length).toBeGreaterThanOrEqual(2)
    expect([...codes].sort()).toEqual(codes)
  })
})

describe('effectiveTileCount', () => {
  it('未開放なら歩いたタイル数のまま', () => {
    const needed = tilesNeededToUnlock(chomeAt(HIBIYA), UNLOCK)
    const keys = tilesOfChome(HIBIYA, needed - 1)
    expect(effectiveTileCount(keys, UNLOCK)).toBe(keys.length)
  })

  it('開放された町丁目は全面として数える', () => {
    const chome = chomeAt(HIBIYA)
    const needed = tilesNeededToUnlock(chome, UNLOCK)
    expect(effectiveTileCount(tilesOfChome(HIBIYA, needed), UNLOCK)).toBe(
      tilesPerArea(chome, 50),
    )
  })

  it('開放済みの区画の中を歩き足しても二重に数えない', () => {
    const chome = chomeAt(HIBIYA)
    const needed = tilesNeededToUnlock(chome, UNLOCK)
    const full = tilesPerArea(chome, 50)
    expect(effectiveTileCount(tilesOfChome(HIBIYA, needed), UNLOCK)).toBe(full)
    expect(effectiveTileCount(tilesOfChome(HIBIYA, needed + 5), UNLOCK)).toBe(full)
  })

  it('境界データの外のタイルは 1 枚ずつ数える', () => {
    const step = 50 / 111_320
    const outside = Array.from(
      { length: 5 },
      (_, i) => tileOf({ lat: 35.6938 + i * step, lng: 139.7034 }, 50).key,
    )
    expect(effectiveTileCount(outside, UNLOCK)).toBe(5)
  })
})
