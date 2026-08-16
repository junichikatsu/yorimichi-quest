import { asAreaId, asSpotId, asUserId } from '@map-checkin/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDataStoreContext, isPlaceholder } from './context.js'
import { DataStoreConfigError, DataStoreError, classifyDataStoreError, isNotFoundError } from './errors.js'
import { createFakeDataStore, FakeDataStoreClient } from './fake.js'
import { appendCheckin, listRecentCheckins } from './repositories/checkins.js'
import { getSpot, incrementSpotCheckinCount, listSpotsByArea, putSpot } from './repositories/spots.js'
import { getUser, putUser } from './repositories/users.js'
import { getUserSpotState, putUserSpotState } from './repositories/user-spot-state.js'
import { runGet, runOp } from './run.js'

const AREA = asAreaId('chiyoda')
const SPOT = asSpotId('sample-hibiya-park')
const USER = asUserId('11111111-2222-4333-8444-555555555555')

function sampleSpot() {
  return {
    spotId: SPOT,
    areaId: AREA,
    name: '日比谷公園（サンプル）',
    category: 'shelter' as const,
    lat: 35.6739,
    lng: 139.7568,
    address: 'サンプル住所',
    attributes: ['車いす対応'],
    source: 'sample-fixture',
    fetchedAt: '2026-08-16',
    checkinCount: 0,
    updatedAt: '2026-08-16T00:00:00.000Z',
  }
}

describe('エラー分類', () => {
  it('文字列 throw は failed（操作は届いたが失敗した）', () => {
    const err = classifyDataStoreError('putItem', 'ValidationException: bad key')
    expect(err.kind).toBe('failed')
    expect(err.operation).toBe('putItem')
  })

  it('Error throw は threw（プロキシに到達できない）', () => {
    const err = classifyDataStoreError('query', new TypeError('socket hang up'))
    expect(err.kind).toBe('threw')
    expect(err.errorName).toBe('TypeError')
  })

  it('SDK の生メッセージをどこにも含めない', () => {
    const secret = 'item body with user@example.com'
    const err = classifyDataStoreError('putItem', secret)
    expect(err.message).not.toContain(secret)
    expect(JSON.stringify(err.toDetails())).not.toContain(secret)
  })

  it('"Not found" は文字列でも Error でも検出できる', () => {
    expect(isNotFoundError('Not found')).toBe(true)
    expect(isNotFoundError(new Error('Item not found'))).toBe(true)
    expect(isNotFoundError('AccessDenied')).toBe(false)
  })
})

describe('runGet / runOp', () => {
  it('runGet は "Not found" を undefined に落とす', async () => {
    await expect(runGet(() => Promise.reject('Not found'))).resolves.toBeUndefined()
  })

  it('runGet はそれ以外を DataStoreError にする', async () => {
    await expect(runGet(() => Promise.reject('AccessDenied'))).rejects.toBeInstanceOf(DataStoreError)
  })

  it('runOp は "Not found" を吸収しない（設定ミスを隠さない）', async () => {
    await expect(runOp('putItem', () => Promise.reject('Not found'))).rejects.toBeInstanceOf(
      DataStoreError,
    )
  })
})

describe('テーブル ID の解決', () => {
  beforeEach(() => {
    delete process.env['DS_TABLE_SPOTS']
  })

  it('未設定はリクエスト単位のエラー（起動は止めない）', () => {
    const ctx = createDataStoreContext(new FakeDataStoreClient())
    expect(() => ctx.tableId('spots')).toThrow(DataStoreConfigError)
  })

  it('雛形の値は未設定と同じ扱い', () => {
    expect(isPlaceholder('00000000-0000-0000-0000-000000000000')).toBe(true)
    expect(isPlaceholder('change-me')).toBe(true)
    expect(isPlaceholder('   ')).toBe(true)
    expect(isPlaceholder('a1b2c3')).toBe(false)
  })

  it('設定済みなら trim して返す', () => {
    process.env['DS_TABLE_SPOTS'] = '  table-abc  '
    const ctx = createDataStoreContext(new FakeDataStoreClient())
    expect(ctx.tableId('spots')).toBe('table-abc')
  })
})

describe('リポジトリ（fake データストア）', () => {
  it('スポットの保存・取得・一覧', async () => {
    const { ctx } = createFakeDataStore()
    await putSpot(ctx, sampleSpot())

    expect(await getSpot(ctx, AREA, SPOT)).toMatchObject({ name: '日比谷公園（サンプル）' })
    expect(await listSpotsByArea(ctx, AREA, 100)).toHaveLength(1)
  })

  it('存在しないスポットは undefined', async () => {
    const { ctx } = createFakeDataStore()
    expect(await getSpot(ctx, AREA, asSpotId('missing-spot'))).toBeUndefined()
  })

  it('別エリアのスポットは取得できない（メインキーが一致しない）', async () => {
    const { ctx } = createFakeDataStore()
    await putSpot(ctx, sampleSpot())
    expect(await listSpotsByArea(ctx, asAreaId('setagaya'), 100)).toHaveLength(0)
  })

  it('チェックイン数は書き込み時に事前計算する', async () => {
    const { ctx } = createFakeDataStore()
    const spot = sampleSpot()
    await putSpot(ctx, spot)
    await incrementSpotCheckinCount(ctx, spot, '2026-08-17T00:00:00.000Z')

    expect((await getSpot(ctx, AREA, SPOT))?.checkinCount).toBe(1)
  })

  it('未登録ユーザーは undefined（初回アクセスを 503 にしない）', async () => {
    const { ctx } = createFakeDataStore()
    expect(await getUser(ctx, USER)).toBeUndefined()
  })

  it('ユーザープロフィールを保存・取得できる', async () => {
    const { ctx } = createFakeDataStore()
    await putUser(ctx, {
      userId: USER,
      displayName: 'サンプル太郎',
      totalPoints: 30,
      checkinCount: 1,
      createdAt: '2026-08-16T00:00:00.000Z',
      lastActiveAt: '2026-08-16T00:00:00.000Z',
    })

    expect(await getUser(ctx, USER)).toMatchObject({ totalPoints: 30, displayName: 'サンプル太郎' })
  })

  it('チェックイン履歴は新しい順に返る（order: true が降順）', async () => {
    const { ctx } = createFakeDataStore()
    for (const [i, at] of [1000, 3000, 2000].entries()) {
      await appendCheckin(ctx, USER, {
        checkinAt: at,
        spotId: asSpotId(`sample-spot-${i}`),
        spotName: `スポット${i}`,
        pointsEarned: 10,
        lat: 35,
        lng: 139,
      })
    }

    const recent = await listRecentCheckins(ctx, USER, 10)
    expect(recent.map((r) => r.checkinAt)).toEqual([3000, 2000, 1000])
  })

  it('user_spot_state は 1 回の getItem で判定できる', async () => {
    const { ctx, client } = createFakeDataStore()
    await putUserSpotState(ctx, USER, SPOT, { lastCheckinAt: 1234, visitCount: 1 })

    const before = client.accessCount
    const state = await getUserSpotState(ctx, USER, SPOT)

    expect(state).toEqual({ lastCheckinAt: 1234, visitCount: 1 })
    expect(client.accessCount - before).toBe(1)
  })
})
