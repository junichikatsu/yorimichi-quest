import type {
  CheckinResponse,
  ErrorResponse,
  HealthResponse,
  MeResponse,
  SpotsResponse,
} from '@map-checkin/shared'
import { FakeDataStoreClient, setDataStoreClient } from '@map-checkin/datastore'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { resetRateLimit } from './middleware/rate-limit.js'
import { resetFakeDataStore } from './services/datastore-context.js'
import { setStaticAssetLoader } from './static.js'

/**
 * 統合テスト。
 *
 * データストアはローカルで代替できないため、fake に差し替えて主要導線を端から端まで通す。
 * 「トリガーのパス付きで呼ばれる」「?v= が付く」など、壊れると気づきにくい箇所を固定する。
 */

const USER_ID = '11111111-2222-4333-8444-555555555555'
const OTHER_USER_ID = '99999999-8888-4777-8666-555555555555'
const TRIGGER_PATH = '/yorimichi-sample'

const app = createApp()

function headers(userId = USER_ID): Record<string, string> {
  return { 'x-sample-user-id': userId, 'content-type': 'application/json' }
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

beforeEach(() => {
  process.env['USE_FAKE_DATASTORE'] = 'true'
  process.env['MAPBOX_ACCESS_TOKEN'] = 'pk.test-token'
  process.env['ADMIN_KEY'] = 'test-admin-key'
  process.env['RATE_LIMIT_PER_MINUTE'] = '100'
  delete process.env['MOCK_MODE']
  resetFakeDataStore()
  resetRateLimit()
  setStaticAssetLoader(undefined)
})

afterEach(() => {
  setStaticAssetLoader(undefined)
})

describe('GET /v1/health', () => {
  it('認証なしで 200 を返す', async () => {
    const response = await app.request('/v1/health')
    expect(response.status).toBe(200)

    const body = await json<HealthResponse>(response)
    expect(body.status).toBe('ok')
    expect(body.configOk).toBe(true)
    expect(body.configMissing).toBe(0)
    expect(body.limits.checkinRadiusM).toBe(100)
  })

  it('設定不足でも起動は止まらず configOk:false を返す', async () => {
    delete process.env['MAPBOX_ACCESS_TOKEN']
    const response = await app.request('/v1/health')

    expect(response.status).toBe(200)
    const body = await json<HealthResponse>(response)
    expect(body.configOk).toBe(false)
    expect(body.configMissing).toBeGreaterThan(0)
    // ★ 不足キー名はレスポンスに出さない
    expect(JSON.stringify(body)).not.toContain('MAPBOX_ACCESS_TOKEN')
  })

  it('トリガーのパスを含めて呼ばれても届く', async () => {
    const response = await app.request(`${TRIGGER_PATH}/v1/health`)
    expect(response.status).toBe(200)
  })
})

describe('静的ファイル配信', () => {
  beforeEach(() => {
    setStaticAssetLoader((name) => {
      if (name === 'index.html') {
        return {
          contentType: 'text/html; charset=utf-8',
          encoding: 'utf8',
          body: '<link href="styles.css?v=__ASSET_VERSION__"><script src="app.js?v=__ASSET_VERSION__"></script>',
        }
      }
      return undefined
    })
  })

  it('トリガーのルート URL は末尾スラッシュへリダイレクトする', async () => {
    const response = await app.request(TRIGGER_PATH)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(`${TRIGGER_PATH}/`)
  })

  it('index.html の ?v= が実際の値へ置換される（前段キャッシュ対策）', async () => {
    const response = await app.request('/')
    expect(response.status).toBe(200)

    const html = await response.text()
    expect(html).not.toContain('__ASSET_VERSION__')
    expect(html).toMatch(/styles\.css\?v=[\w-]+/)
    expect(html).toMatch(/app\.js\?v=[\w-]+/)
  })

  it('未ビルドの静的ファイルは白画面ではなく 500 を返す', async () => {
    const response = await app.request('/app.js')
    expect(response.status).toBe(500)

    const body = await json<ErrorResponse>(response)
    expect(body.error.message).toBe('ASSET_NOT_BUILT')
  })
})

describe('認証（サンプル用の識別子）', () => {
  it('ヘッダが無ければ 401', async () => {
    const response = await app.request('/v1/spots')
    expect(response.status).toBe(401)
  })

  it('形式が不正なら 401', async () => {
    const response = await app.request('/v1/spots', { headers: { 'x-sample-user-id': 'not-a-uuid' } })
    expect(response.status).toBe(401)
  })

  it('client-config は認証不要', async () => {
    const response = await app.request('/v1/client-config')
    expect(response.status).toBe(200)
  })
})

describe('GET /v1/spots', () => {
  it('サンプルスポットを返し、現在地があれば距離順に並ぶ', async () => {
    const response = await app.request('/v1/spots?lat=35.6739&lng=139.7568', { headers: headers() })
    expect(response.status).toBe(200)

    const body = await json<SpotsResponse>(response)
    expect(body.spots.length).toBeGreaterThan(0)
    expect(body.spots[0]?.spotId).toBe('sample-hibiya-park')

    const distances = body.spots.map((spot) => spot.distanceM ?? Infinity)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
  })

  it('未チェックインのスポットは未開拓（×3）', async () => {
    const response = await app.request('/v1/spots', { headers: headers() })
    const body = await json<SpotsResponse>(response)

    expect(body.spots.every((spot) => spot.unexplored && spot.pointMultiplier === 3)).toBe(true)
  })
})

describe('チェックインの通し導線', () => {
  const spotId = 'sample-hibiya-park'
  const position = { lat: 35.6739, lng: 139.7568 }

  it('チェックイン → ポイント付与 → マイページ反映', async () => {
    const checkin = await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(position),
    })
    expect(checkin.status).toBe(200)

    const result = await json<CheckinResponse>(checkin)
    // 10pt × 未開拓 3 倍 + 初回 20pt
    expect(result.pointsEarned).toBe(50)
    expect(result.breakdown).toEqual({ base: 10, multiplier: 3, firstVisitBonus: 20 })
    expect(result.spot.checkinCount).toBe(1)

    const me = await json<MeResponse>(await app.request('/v1/me', { headers: headers() }))
    expect(me.user.totalPoints).toBe(50)
    expect(me.user.checkinCount).toBe(1)
    expect(me.recentCheckins[0]?.spotId).toBe(spotId)
  })

  it('同一スポットへの再チェックインは COOLDOWN', async () => {
    await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(position),
    })

    const second = await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(position),
    })

    expect(second.status).toBe(409)
    const body = await json<ErrorResponse>(second)
    expect(body.error.code).toBe('COOLDOWN')
    expect(body.error.details?.['nextAvailableAt']).toBeTruthy()
  })

  it('別ユーザーは同じスポットにチェックインできる（クールダウンはユーザー単位）', async () => {
    await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(position),
    })

    const other = await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(OTHER_USER_ID),
      body: JSON.stringify(position),
    })

    expect(other.status).toBe(200)
    // 1 人目のチェックインで倍率が下がっている（10 × 2 + 初回 20）
    const result = await json<CheckinResponse>(other)
    expect(result.pointsEarned).toBe(40)
  })

  it('圏外は TOO_FAR で距離を返す', async () => {
    const response = await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ lat: 35.7, lng: 139.8 }),
    })

    expect(response.status).toBe(409)
    const body = await json<ErrorResponse>(response)
    expect(body.error.code).toBe('TOO_FAR')
    expect(Number(body.error.details?.['distanceM'])).toBeGreaterThan(100)
  })

  it('存在しないスポットは 404', async () => {
    const response = await app.request('/v1/spots/sample-missing-spot/checkin', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(position),
    })
    expect(response.status).toBe(404)
  })

  it('緯度経度が範囲外なら 400', async () => {
    const response = await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ lat: 999, lng: 139.7 }),
    })
    expect(response.status).toBe(400)
  })

  it('チェックインは他ユーザーの履歴に混ざらない', async () => {
    await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(position),
    })

    const otherMe = await json<MeResponse>(
      await app.request('/v1/me', { headers: headers(OTHER_USER_ID) }),
    )
    expect(otherMe.recentCheckins).toHaveLength(0)
    expect(otherMe.user.totalPoints).toBe(0)
  })
})

describe('管理エンドポイント', () => {
  it('管理キーが違えば 403', async () => {
    const response = await app.request('/v1/admin/seed', {
      method: 'POST',
      headers: { ...headers(), 'x-admin-key': 'wrong' },
    })
    expect(response.status).toBe(403)
  })

  it('管理キーが一致すればシードできる（2 回目は skip）', async () => {
    const first = await app.request('/v1/admin/seed', {
      method: 'POST',
      headers: { ...headers(), 'x-admin-key': 'test-admin-key' },
    })
    expect(first.status).toBe(200)

    const second = await app.request('/v1/admin/seed', {
      method: 'POST',
      headers: { ...headers(), 'x-admin-key': 'test-admin-key' },
    })
    const body = await json<{ inserted: number; skipped: number }>(second)
    expect(body.inserted).toBe(0)
    expect(body.skipped).toBeGreaterThan(0)
  })
})

describe('レート制限', () => {
  it('上限を超えると 429 と Retry-After を返す', async () => {
    process.env['RATE_LIMIT_PER_MINUTE'] = '2'

    await app.request('/v1/spots', { headers: headers() })
    await app.request('/v1/spots', { headers: headers() })
    const third = await app.request('/v1/spots', { headers: headers() })

    expect(third.status).toBe(429)
    expect(third.headers.get('Retry-After')).toBeTruthy()
  })
})

describe('データストアの異常系', () => {
  const TABLE_KEYS = [
    'DS_TABLE_SPOTS',
    'DS_TABLE_USERS',
    'DS_TABLE_CHECKINS',
    'DS_TABLE_USER_SPOT_STATE',
  ]

  afterEach(() => {
    setDataStoreClient(undefined)
  })

  it('テーブル ID 未設定は 500 CONFIG_ERROR（キー名は出さない）', async () => {
    process.env['USE_FAKE_DATASTORE'] = 'false'
    for (const key of TABLE_KEYS) delete process.env[key]
    // クライアント生成は成功させ、テーブル ID の解決だけを失敗させる
    setDataStoreClient(new FakeDataStoreClient())

    const response = await app.request('/v1/spots', { headers: headers() })
    expect(response.status).toBe(500)

    const body = await json<ErrorResponse>(response)
    expect(body.error.code).toBe('CONFIG_ERROR')
    expect(JSON.stringify(body)).not.toContain('DS_TABLE_SPOTS')
  })

  it('実行環境の外ではクライアントを作れず 503 になる（500 にしない）', async () => {
    process.env['USE_FAKE_DATASTORE'] = 'false'
    for (const key of TABLE_KEYS) process.env[key] = 'table-id-for-test'
    delete process.env['ENEBULAR_DS_JWT']
    delete process.env['ENEBULAR_DS_PROXY_ARN']

    const response = await app.request('/v1/spots', { headers: headers() })
    expect(response.status).toBe(503)

    const body = await json<ErrorResponse>(response)
    expect(body.error.code).toBe('DATASTORE_UNAVAILABLE')
    expect(body.error.details?.['reason']).toBe('client_init')
  })
})

describe('404', () => {
  it('受け取ったパスとメソッドを返す', async () => {
    const response = await app.request('/no-such-path', { method: 'POST' })
    expect(response.status).toBe(404)

    const body = await json<{ error: { path: string; method: string } }>(response)
    expect(body.error.path).toBe('/no-such-path')
    expect(body.error.method).toBe('POST')
  })
})
