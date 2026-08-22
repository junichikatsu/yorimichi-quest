import {
  DEFAULT_AVATAR,
  EMPTY_EQUIPMENT,
  asAreaId,
  asSpotId,
  asUserId,
  type Spot,
  type UserProfile,
} from '@imanouchi/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeDataStore, FAKE_TABLE_IDS } from './fake.js'
import { getSpot, listSpotsByArea, putSpot } from './repositories/spots.js'
import { getUser, putUser } from './repositories/users.js'

/**
 * リポジトリの検査。
 *
 * ★ 目的は「他人のデータが引けないこと」の確認である。メインキーに所有者を
 * 含める設計が効いているかを、ここで固定する。
 */

const AREA = asAreaId('chiyoda-minato')
const OTHER_AREA = asAreaId('shinjuku')
const USER = asUserId('U0123456789abcdef0123456789abcdef')
const OTHER_USER = asUserId('Uffffffffffffffffffffffffffffffff')

function spot(id: string, overrides: Partial<Spot> = {}): Spot {
  return {
    spotId: asSpotId(id),
    areaId: AREA,
    name: 'テストスポット',
    category: 'shelter',
    lat: 35.6739,
    lng: 139.7568,
    address: '東京都千代田区',
    attributes: ['スロープ等'],
    source: 'test',
    fetchedAt: '2026-08-20',
    checkinCount: 0,
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  }
}

function profile(userId = USER, overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    userId,
    displayName: '山田 太郎',
    pictureUrl: 'https://example.com/a.png',
    avatar: DEFAULT_AVATAR,
    equipment: EMPTY_EQUIPMENT,
    totalPoints: 10,
    titles: ['はじめの一歩'],
    locationConsentAt: '2026-08-20T00:00:00.000Z',
    createdAt: '2026-08-20T00:00:00.000Z',
    lastActiveAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  }
}

describe('spots', () => {
  let ctx: ReturnType<typeof createFakeDataStore>['ctx']

  beforeEach(() => {
    for (const id of Object.values(FAKE_TABLE_IDS)) void id
    ctx = createFakeDataStore().ctx
  })

  it('入れて引ける', async () => {
    await putSpot(ctx, spot('a-1'))
    const found = await getSpot(ctx, AREA, asSpotId('a-1'))
    expect(found?.name).toBe('テストスポット')
    expect(found?.attributes).toEqual(['スロープ等'])
  })

  it('無いものは undefined（エラーにしない）', async () => {
    expect(await getSpot(ctx, AREA, asSpotId('missing'))).toBeUndefined()
  })

  it('★ 別エリアのスポットは引けない', async () => {
    await putSpot(ctx, spot('a-1'))
    expect(await getSpot(ctx, OTHER_AREA, asSpotId('a-1'))).toBeUndefined()
    expect(await listSpotsByArea(ctx, OTHER_AREA, 100)).toHaveLength(0)
  })

  it('エリア内を一覧できる', async () => {
    await putSpot(ctx, spot('a-1'))
    await putSpot(ctx, spot('a-2', { name: 'ふたつめ' }))
    expect(await listSpotsByArea(ctx, AREA, 100)).toHaveLength(2)
  })

  it('上限で打ち切れる', async () => {
    await putSpot(ctx, spot('a-1'))
    await putSpot(ctx, spot('a-2'))
    expect(await listSpotsByArea(ctx, AREA, 1)).toHaveLength(1)
  })
})

describe('users', () => {
  let ctx: ReturnType<typeof createFakeDataStore>['ctx']

  beforeEach(() => {
    ctx = createFakeDataStore().ctx
  })

  it('入れて引ける。称号は配列で戻る', async () => {
    await putUser(ctx, profile())
    const found = await getUser(ctx, USER)
    expect(found?.displayName).toBe('山田 太郎')
    expect(found?.titles).toEqual(['はじめの一歩'])
    expect(found?.totalPoints).toBe(10)
  })

  it('未登録は undefined（初回ログインを成立させるため）', async () => {
    expect(await getUser(ctx, USER)).toBeUndefined()
  })

  it('★ 他人のプロフィールは引けない', async () => {
    await putUser(ctx, profile())
    expect(await getUser(ctx, OTHER_USER)).toBeUndefined()
  })

  it('★ 見た目が壊れていても既定値へ落ちる（描画側を落とさない）', async () => {
    await putUser(ctx, profile())
    // JSON として壊れた値を直接書き込む
    await ctx.client.putItem({
      tableId: 'fake-users',
      item: {
        userKey: 'user#U0123456789abcdef0123456789abcdef',
        recordKey: 'profile',
        userId: USER,
        displayName: '山田 太郎',
        avatar: 'これは JSON ではない',
        titles: '[]',
        locationConsentAt: '',
        createdAt: '',
        lastActiveAt: '',
      },
    })

    const found = await getUser(ctx, USER)
    expect(found?.avatar).toEqual(DEFAULT_AVATAR)
  })

  it('見た目を保存して読み戻せる', async () => {
    const custom = { ...DEFAULT_AVATAR, hair: 3, cloth: 5 }
    await putUser(ctx, profile(USER, { avatar: custom }))
    expect((await getUser(ctx, USER))?.avatar).toEqual(custom)
  })

  it('未同意は undefined として戻る（空文字を同意扱いにしない）', async () => {
    await putUser(ctx, profile(USER, { locationConsentAt: undefined }))
    expect((await getUser(ctx, USER))?.locationConsentAt).toBeUndefined()
  })
})
