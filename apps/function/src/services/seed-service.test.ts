import type { DataStoreClient, DataStoreContext } from '@imanouchi/datastore'
import { asAreaId, asSpotId, type Spot } from '@imanouchi/shared'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED_DELAY_MS, seedSpots } from './seed-service.js'

/**
 * 投入の再試行（FR-10-2）。
 *
 * ★ 連続して速く書くとスロットリングされる（実測：間隔なしで約280件目で失敗）。
 * ここで固定するのは「詰まっても入り切ること」と「設定の誤りは早く落ちること」。
 */

const AREA = asAreaId('chiyoda-minato')

function spots(count: number): Spot[] {
  return Array.from({ length: count }, (_, i) => ({
    spotId: asSpotId(`test-${String(i).padStart(4, '0')}`),
    areaId: AREA,
    name: `テスト${i}`,
    category: 'shelter' as const,
    lat: 35.6739,
    lng: 139.7568,
    address: '東京都千代田区',
    attributes: [],
    source: 'test',
    fetchedAt: '2026-08-20',
    checkinCount: 0,
    surveyStats: {},
    updatedAt: '2026-08-20T00:00:00.000Z',
  }))
}

/**
 * 指定した回数だけ失敗するデータストア。
 *
 * ★ スロットリングは**文字列**で投げられる（`packages/datastore` の分類参照）。
 * Error で投げると別の経路になるので、実物と同じ投げ方にする。
 */
function throttlingCtx(failAt: number[], failTimes = 1): { ctx: DataStoreContext; calls: () => number } {
  let calls = 0
  const remaining = new Map(failAt.map((n) => [n, failTimes]))

  const client: DataStoreClient = {
    async putItem() {
      calls += 1
      const left = remaining.get(calls) ?? 0
      if (left > 0) {
        remaining.set(calls, left - 1)
        throw 'ProvisionedThroughputExceededException: slow down'
      }
      return {}
    },
    async getItem() {
      return {}
    },
    async query() {
      return {}
    },
    async deleteItem() {
      return {}
    },
  }

  return { ctx: { client, tableId: () => 'table' }, calls: () => calls }
}

describe('seedSpots', () => {
  it('詰まらなければ指定範囲を入れて完走する', async () => {
    const { ctx } = throttlingCtx([])
    const result = await seedSpots(ctx, spots(5), { offset: 0, count: 5, delayMs: 0 })

    expect(result.inserted).toBe(5)
    expect(result.stoppedAt).toBeUndefined()
    expect(result.nextOffset).toBeNull()
    expect(result.retries).toBe(0)
  })

  it('★ スロットリングされても再試行して入り切る', async () => {
    // 3件目の書き込みが1回だけ失敗する
    const { ctx } = throttlingCtx([3])
    const result = await seedSpots(ctx, spots(5), { offset: 0, count: 5, delayMs: 0 })

    expect(result.inserted).toBe(5)
    expect(result.retries).toBe(1)
    expect(result.stoppedAt).toBeUndefined()
  })

  it('★ 一度詰まったら残りの間隔を広げる（同じ速さで続けない）', async () => {
    const { ctx } = throttlingCtx([2])
    const result = await seedSpots(ctx, spots(3), { offset: 0, count: 3, delayMs: 0 })

    expect(result.retries).toBe(1)
    // 0 のままではなく引き上げられている
    expect(result.delayMs).toBeGreaterThan(0)
  })

  it('★ 回数の上限を超えたら止まり、再開位置を返す', async () => {
    // 3件目が何度やっても失敗する
    const { ctx } = throttlingCtx([3, 4, 5, 6, 7], 99)
    const result = await seedSpots(ctx, spots(10), { offset: 0, count: 10, delayMs: 0 })

    expect(result.inserted).toBe(2)
    expect(result.stoppedAt).toBe(2)
    // 止まった位置から再開できる
    expect(result.nextOffset).toBe(2)
  })

  it('★ offset 0 の1件目から失敗したら例外を投げる（0件で 200 を返さない）', async () => {
    const { ctx } = throttlingCtx([1, 2, 3, 4, 5], 99)
    await expect(seedSpots(ctx, spots(5), { offset: 0, count: 5, delayMs: 0 })).rejects.toBeDefined()
  })

  it('★ 再開（offset > 0）の1件目の失敗は例外にしない', async () => {
    // 前回まで入っている＝設定は正しい。スロットリングが続いているだけなので、
    // 503 にすると呼び出し側が「設定ミス」と受け取って諦めてしまう
    const { ctx } = throttlingCtx([1, 2, 3, 4, 5], 99)
    const result = await seedSpots(ctx, spots(10), { offset: 5, count: 5, delayMs: 0 })

    expect(result.inserted).toBe(0)
    expect(result.stoppedAt).toBe(5)
    // 同じ位置から再開できる
    expect(result.nextOffset).toBe(5)
  })

  it('★ 諦める前に間隔を広げて返す（緩めるべきことが伝わる）', async () => {
    const { ctx } = throttlingCtx([3, 4, 5, 6, 7], 99)
    const result = await seedSpots(ctx, spots(10), { offset: 0, count: 10, delayMs: 0 })

    expect(result.stoppedAt).toBe(2)
    // 100ms のまま返すと、呼び出し側が同じ速さで再開してまた詰まる
    expect(result.delayMs).toBeGreaterThan(0)
  })

  it('範囲を指定できる', async () => {
    const { ctx } = throttlingCtx([])
    const result = await seedSpots(ctx, spots(10), { offset: 4, count: 3, delayMs: 0 })

    expect(result.from).toBe(4)
    expect(result.to).toBe(7)
    expect(result.inserted).toBe(3)
    expect(result.nextOffset).toBe(7)
    expect(result.total).toBe(10)
  })

  it('範囲が全件を超えても落ちない', async () => {
    const { ctx } = throttlingCtx([])
    const result = await seedSpots(ctx, spots(3), { offset: 2, count: 100, delayMs: 0 })

    expect(result.inserted).toBe(1)
    expect(result.nextOffset).toBeNull()
  })

  it('既定の間隔は 100ms より大きい（100ms でも詰まったため）', () => {
    expect(DEFAULT_SEED_DELAY_MS).toBeGreaterThan(100)
  })
})
