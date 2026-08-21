import { chomeOfTile, tileOf, tilesNeededToUnlock, type LatLng } from '@imanouchi/core'
import { createFakeDataStore, type DataStoreContext } from '@imanouchi/datastore'
import type { UserId } from '@imanouchi/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { getExploration, recordExploration, type ExplorationParams } from './exploration-service.js'

/**
 * 探索の記録。
 *
 * ★ 区画は実在の町丁目なので、**実座標でしかテストできない**。
 * 原点付近の合成座標はどの町丁目にも入らず、区画開放が起きない。
 */

const PARAMS: ExplorationParams = {
  userId: 'u-test' as UserId,
  tileSizeM: 50,
  latitude: 35.6739,
  areaRadiusM: 1500,
  maxTiles: 2000,
  unlockRatio: 0.25,
  unlockMaxTiles: 12,
}

/** 日比谷公園（千代田区） */
const HIBIYA = { lat: 35.6739, lng: 139.7568 }

function chomeAt(position: LatLng) {
  const chome = chomeOfTile(tileOf(position, PARAMS.tileSizeM).key, PARAMS.tileSizeM)
  expect(chome).toBeDefined()
  return chome!
}

/** ある地点と同じ町丁目に入る座標だけを集める（町丁目は格子ではない） */
function pointsInChome(origin: LatLng, count: number): LatLng[] {
  const step = PARAMS.tileSizeM / 111_320
  const target = chomeAt(origin)

  const points: LatLng[] = []
  for (let row = -20; row <= 20 && points.length < count; row += 1) {
    for (let col = -20; col <= 20 && points.length < count; col += 1) {
      const tile = tileOf(
        { lat: origin.lat + row * step, lng: origin.lng + col * step },
        PARAMS.tileSizeM,
      )
      if (chomeOfTile(tile.key, PARAMS.tileSizeM)?.code !== target.code) continue
      points.push(tile.center)
    }
  }
  expect(points).toHaveLength(count)
  return points
}

let ctx: DataStoreContext
let writes: number

beforeEach(() => {
  const fake = createFakeDataStore()
  writes = 0
  ctx = {
    tableId: fake.ctx.tableId,
    client: {
      ...fake.client,
      getItem: (params) => fake.client.getItem(params),
      query: (params) => fake.client.query(params),
      deleteItem: (params) => fake.client.deleteItem(params),
      putItem: (params) => {
        writes += 1
        return fake.client.putItem(params)
      },
    },
  }
})

async function walk(points: LatLng[]): Promise<number> {
  const response = await recordExploration(ctx, { ...PARAMS, points, now: 1_700_000_000_000 })
  return response.newTileCount
}

describe('recordExploration', () => {
  it('新しいタイルだけを書く（同じ場所を歩き直しても増えない）', async () => {
    const points = pointsInChome(HIBIYA, 3)

    expect(await walk(points)).toBe(3)
    expect(writes).toBe(3)

    expect(await walk(points)).toBe(0)
    expect(writes).toBe(3)
  })

  it('開放済みの町丁目の中は、新しいタイルでも書かない', async () => {
    const needed = tilesNeededToUnlock(chomeAt(HIBIYA), PARAMS)
    const points = pointsInChome(HIBIYA, needed + 5)

    // 閾値ぶん歩いて開放する
    expect(await walk(points.slice(0, needed))).toBe(needed)
    const opened = await getExploration(ctx, PARAMS)
    expect(opened.unlockedAreas.map((area) => area.areaKey)).toEqual([chomeAt(HIBIYA).code])

    const before = writes
    // 同じ町丁目の未踏タイル。開放済みなので表示も数値も変わらない
    expect(await walk(points.slice(needed))).toBe(0)
    expect(writes).toBe(before)
  })

  it('開放済みでも、応答（開放一覧と探索率）は変わらない', async () => {
    const needed = tilesNeededToUnlock(chomeAt(HIBIYA), PARAMS)
    const points = pointsInChome(HIBIYA, needed + 5)
    await walk(points.slice(0, needed))

    const before = await getExploration(ctx, PARAMS)
    await walk(points.slice(needed))
    const after = await getExploration(ctx, PARAMS)

    expect(after.unlockedAreas).toEqual(before.unlockedAreas)
    expect(after.summary).toEqual(before.summary)
  })

  it('開放前は同じ町丁目のタイルも書く', async () => {
    const needed = tilesNeededToUnlock(chomeAt(HIBIYA), PARAMS)
    const points = pointsInChome(HIBIYA, needed)

    // 閾値に1枚足りない状態から、もう1枚
    expect(await walk(points.slice(0, needed - 1))).toBe(needed - 1)
    expect(await walk(points.slice(needed - 1))).toBe(1)
  })

  it('保存上限に達したら書かない', async () => {
    const params = { ...PARAMS, maxTiles: 2 }
    const points = pointsInChome(HIBIYA, 5)

    const first = await recordExploration(ctx, { ...params, points, now: 1 })
    expect(first.newTileCount).toBe(2)
    expect(first.summary.truncated).toBe(true)
  })
})
