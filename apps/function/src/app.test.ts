import { FakeDataStoreClient, setDataStoreClient } from '@imanouchi/datastore'
import type {
  AdminConfigResponse,
  ClientConfigResponse,
  ErrorResponse,
  HealthResponse,
  LoginResponse,
  ExplorationResponse,
  ExplorationUpdateResponse,
  MeResponse,
  PurgeResponse,
  SeedResponse,
  SpotsResponse,
} from '@imanouchi/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { resetRateLimit } from './middleware/rate-limit.js'
import { resetFakeDataStore } from './services/datastore-context.js'
import { setStaticAssetLoader } from './static.js'

/**
 * 統合テスト。
 *
 * データストアはローカルで代替できないため fake に差し替え、主要導線を端から端まで通す。
 * LINE の検証エンドポイントは fetch を差し替える（**実際に外へ出さない**）。
 *
 * ★ 認証は「通ること」より「通ってはいけないものが通らないこと」を固定する。
 */

const LINE_USER_ID = 'U0123456789abcdef0123456789abcdef'
const CHANNEL_ID = '1234567890'
const TRIGGER_PATH = '/imanouchi'

const app = createApp()

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

/** LINE の検証エンドポイントの応答を差し替える */
function mockLineVerify(payload: Record<string, unknown>, status = 200): void {
  vi.stubGlobal('fetch', async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://access.line.me',
    sub: LINE_USER_ID,
    aud: CHANNEL_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    name: '山田 太郎',
    picture: 'https://profile.line-scdn.net/example',
    ...overrides,
  }
}

async function loginOk(): Promise<LoginResponse> {
  mockLineVerify(validPayload())
  const response = await app.request('/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: 'dummy-id-token' }),
  })
  expect(response.status).toBe(200)
  return json<LoginResponse>(response)
}

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

beforeEach(() => {
  process.env['USE_FAKE_DATASTORE'] = 'true'
  process.env['SEED_DATASET'] = 'sample'
  // LIFF ID の接頭辞はチャネルIDと一致させる（実際のコンソールの形式）
  process.env['LIFF_ID'] = `${CHANNEL_ID}-abcdefgh`
  process.env['LINE_CHANNEL_ID'] = CHANNEL_ID
  process.env['SESSION_SECRET'] = 'test-session-secret'
  process.env['MAPBOX_ACCESS_TOKEN'] = 'pk.test-token'
  process.env['ADMIN_KEY'] = 'test-admin-key'
  process.env['RATE_LIMIT_PER_MINUTE'] = '200'
  process.env['AREA_ID'] = 'chiyoda-minato'
  setDataStoreClient(new FakeDataStoreClient())
  resetFakeDataStore()
  resetRateLimit()
  setStaticAssetLoader(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  setDataStoreClient(undefined)
  setStaticAssetLoader(undefined)
})

describe('GET /v1/health', () => {
  it('認証なしで応答し、設定の充足を返す', async () => {
    const body = await json<HealthResponse>(await app.request('/v1/health'))
    expect(body.status).toBe('ok')
    expect(body.configOk).toBe(true)
    expect(body.configMissing).toBe(0)
  })

  it('★ 不足しているキー名を漏らさない', async () => {
    delete process.env['MAPBOX_ACCESS_TOKEN']
    const response = await app.request('/v1/health')
    const text = await response.text()

    expect(text).not.toContain('MAPBOX')
    expect(JSON.parse(text).configMissing).toBe(1)
  })

  it('★ LIFF ID とチャネルIDの組み合わせ違いを検出する', async () => {
    // ミニアプリは内部チャネル（開発用・審査用・本番用）ごとに両方が別。
    // 開発用の LIFF ID に別の内部チャネルのIDを組み合わせた状態を作る
    process.env['LIFF_ID'] = '2011183531-CoJerXk1'
    process.env['LINE_CHANNEL_ID'] = '2011183533'

    const body = await json<HealthResponse>(await app.request('/v1/health'))
    expect(body.configOk).toBe(false)
    expect(body.configMissing).toBe(1)
  })

  it('組み合わせが合っていれば configOk のまま', async () => {
    process.env['LIFF_ID'] = '2011183531-CoJerXk1'
    process.env['LINE_CHANNEL_ID'] = '2011183531'

    const body = await json<HealthResponse>(await app.request('/v1/health'))
    expect(body.configOk).toBe(true)
  })

  it('★ 組み合わせ違いでもキー名を漏らさない', async () => {
    process.env['LIFF_ID'] = '2011183531-CoJerXk1'
    process.env['LINE_CHANNEL_ID'] = '2011183533'

    const text = await (await app.request('/v1/health')).text()
    expect(text).not.toContain('LIFF')
    expect(text).not.toContain('MISMATCH')
  })

  it('トリガーのパスが前置されても届く', async () => {
    const response = await app.request(`${TRIGGER_PATH}/v1/health`)
    expect(response.status).toBe(200)
  })
})

describe('GET /v1/admin/config（運用用）', () => {
  it('★ 不足しているキー名を返す（health は件数しか返せないため）', async () => {
    delete process.env['DS_TABLE_EXPLORED_TILES']
    process.env['USE_FAKE_DATASTORE'] = 'false'

    const body = await json<AdminConfigResponse>(
      await app.request('/v1/admin/config', { headers: { 'x-admin-key': 'test-admin-key' } }),
    )
    expect(body.configOk).toBe(false)
    expect(body.missing).toContain('DS_TABLE_EXPLORED_TILES')
  })

  it('LIFF ID とチャネルIDの組み合わせ違いも名前で分かる', async () => {
    process.env['LIFF_ID'] = '2011183531-CoJerXk1'
    process.env['LINE_CHANNEL_ID'] = '2011183533'

    const body = await json<AdminConfigResponse>(
      await app.request('/v1/admin/config', { headers: { 'x-admin-key': 'test-admin-key' } }),
    )
    expect(body.missing).toContain('LIFF_ID_CHANNEL_MISMATCH')
  })

  it('揃っていれば configOk。エリアと出どころも返す（取り違えの確認）', async () => {
    const body = await json<AdminConfigResponse>(
      await app.request('/v1/admin/config', { headers: { 'x-admin-key': 'test-admin-key' } }),
    )
    expect(body.configOk).toBe(true)
    expect(body.missing).toEqual([])
    expect(body.area.areaId).toBe('chiyoda-minato')
    expect(body.seedDataset).toBe('sample')
  })

  it('★ 管理キーが無ければ 403（キー名を誰にでも見せない）', async () => {
    expect((await app.request('/v1/admin/config')).status).toBe(403)
    expect(
      (await app.request('/v1/admin/config', { headers: { 'x-admin-key': 'wrong' } })).status,
    ).toBe(403)
  })
})

describe('GET /v1/client-config', () => {
  it('LIFF ID と地図トークンを配る（FE は環境変数を持たない）', async () => {
    const body = await json<ClientConfigResponse>(await app.request('/v1/client-config'))
    expect(body.liffId).toBe(`${CHANNEL_ID}-abcdefgh`)
    expect(body.mapboxToken).toBe('pk.test-token')
    expect(body.area.areaId).toBe('chiyoda-minato')
  })

  it('★ サンプルデータで動いていることを伝える（架空を実データに見せない）', async () => {
    const body = await json<ClientConfigResponse>(await app.request('/v1/client-config'))
    expect(body.usesSampleData).toBe(true)
    expect(body.dataSources[0]?.title).toContain('架空')
  })

  /*
   * 有事モードの切替（FR-08-1）。
   *
   * ★ サーバーから止められることが要件である。実利用者に見せると、実際に災害が
   * 起きたと誤認させうる。画面側にハードコードしてはいけない。
   */
  it('有事モードの切替を出すかを配る', async () => {
    const body = await json<ClientConfigResponse>(await app.request('/v1/client-config'))
    expect(body.emergencyDemoEnabled).toBe(true)
  })

  it('★ サーバー側で切替そのものを消せる', async () => {
    process.env['ENABLE_EMERGENCY_DEMO'] = 'false'
    const body = await json<ClientConfigResponse>(await app.request('/v1/client-config'))
    expect(body.emergencyDemoEnabled).toBe(false)
  })
})

describe('ログイン（FR-01-1・FR-01-2）', () => {
  it('初回は自動登録され、LINE の表示名とアイコンが入る', async () => {
    const body = await loginOk()

    expect(body.registered).toBe(true)
    expect(body.user.userId).toBe(LINE_USER_ID)
    expect(body.user.displayName).toBe('山田 太郎')
    expect(body.user.pictureUrl).toBe('https://profile.line-scdn.net/example')
    expect(body.token).not.toBe('')
  })

  it('2回目は registered=false（重複登録しない）', async () => {
    await loginOk()
    const second = await loginOk()
    expect(second.registered).toBe(false)
  })

  it('LINE 側で改名したら次のログインで反映する', async () => {
    await loginOk()

    mockLineVerify(validPayload({ name: '山田 花子' }))
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy' }),
    })
    const body = await json<LoginResponse>(response)
    expect(body.user.displayName).toBe('山田 花子')
  })

  it('★ 別チャネル向けのトークンは拒否する（aud の照合）', async () => {
    mockLineVerify(validPayload({ aud: '9999999999' }))
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy' }),
    })
    expect(response.status).toBe(401)
  })

  it('★ 発行元が違うトークンは拒否する', async () => {
    mockLineVerify(validPayload({ iss: 'https://evil.example.com' }))
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy' }),
    })
    expect(response.status).toBe(401)
  })

  it('★ 期限切れは TOKEN_EXPIRED で返す（取り直せば直ることを伝える）', async () => {
    mockLineVerify(validPayload({ exp: Math.floor(Date.now() / 1000) - 10 }))
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy' }),
    })
    expect(response.status).toBe(401)

    // ★ UNAUTHORIZED と混ぜない。クライアントは取り直しに走れるかを code で判断する
    const body = await json<ErrorResponse>(response)
    expect(body.error.code).toBe('TOKEN_EXPIRED')
  })

  it('★ LINE が期限切れと言ってきた場合も TOKEN_EXPIRED にする', async () => {
    // LINE は期限切れのIDトークンにも 400 を返し、理由は error_description に入る
    mockLineVerify({ error: 'invalid_request', error_description: 'IdToken expired.' }, 400)
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy' }),
    })
    expect(response.status).toBe(401)
    expect((await json<ErrorResponse>(response)).error.code).toBe('TOKEN_EXPIRED')
  })

  it('★ 設定違い（aud 不一致）は TOKEN_EXPIRED にしない（取り直しても直らない）', async () => {
    mockLineVerify(validPayload({ aud: '9999999999' }))
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy' }),
    })
    expect((await json<ErrorResponse>(response)).error.code).toBe('UNAUTHORIZED')
  })

  it('★ LINE が 400 を返したら 401 にする（500 にしない）', async () => {
    mockLineVerify({ error: 'invalid_request' }, 400)
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy' }),
    })
    expect(response.status).toBe(401)
  })

  it('★ LINE に届かないときは 502 にする（トークン不正と区別する）', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('ECONNREFUSED')
    })
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy' }),
    })
    expect(response.status).toBe(502)
  })

  it('★ userId を自己申告しても効かない（body の余分な値は無視される）', async () => {
    mockLineVerify(validPayload())
    const response = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy', userId: 'Uffffffffffffffffffffffffffffffff' }),
    })
    const body = await json<LoginResponse>(response)
    // トークンの sub が使われる
    expect(body.user.userId).toBe(LINE_USER_ID)
  })
})

describe('認証が要るエンドポイント', () => {
  it('★ トークンなしは 401', async () => {
    expect((await app.request('/v1/me')).status).toBe(401)
    expect((await app.request('/v1/spots')).status).toBe(401)
  })

  it('★ 偽のトークンは 401', async () => {
    const response = await app.request('/v1/me', { headers: auth('bogus.token') })
    expect(response.status).toBe(401)
  })

  it('★ Bearer 以外の渡し方を受け付けない', async () => {
    const { token } = await loginOk()
    const response = await app.request('/v1/me', { headers: { authorization: token } })
    expect(response.status).toBe(401)
  })

  it('正しいトークンならプロフィールを返す', async () => {
    const { token } = await loginOk()
    const body = await json<MeResponse>(await app.request('/v1/me', { headers: auth(token) }))
    expect(body.user.userId).toBe(LINE_USER_ID)
  })
})

describe('キャラクター（FR-01-5・FR-01-6）', () => {
  it('初回は既定の見た目が入る（作成画面を通らなくても地図に出せる）', async () => {
    const body = await loginOk()
    expect(body.user.avatar).toBeDefined()
    expect(typeof body.user.avatar.hair).toBe('number')
  })

  it('見た目を変更して保存できる', async () => {
    const { token, user } = await loginOk()
    const next = { ...user.avatar, hair: 3, cloth: 5 }

    const saved = await json<MeResponse>(
      await app.request('/v1/me/avatar', {
        method: 'PUT',
        headers: auth(token),
        body: JSON.stringify(next),
      }),
    )
    expect(saved.user.avatar.hair).toBe(3)
    expect(saved.user.avatar.cloth).toBe(5)
  })

  it('★ ログインし直しても見た目が保たれる（初期化されない）', async () => {
    const { token, user } = await loginOk()
    await app.request('/v1/me/avatar', {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ ...user.avatar, hair: 7 }),
    })

    const again = await loginOk()
    expect(again.user.avatar.hair).toBe(7)
  })

  it('★ 範囲外の番号は 400（描画側で存在しない髪型を引かせない）', async () => {
    const { token, user } = await loginOk()
    const response = await app.request('/v1/me/avatar', {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ ...user.avatar, hair: 999 }),
    })
    expect(response.status).toBe(400)
  })

  it('認証なしは 401', async () => {
    expect(
      (await app.request('/v1/me/avatar', { method: 'PUT', body: JSON.stringify({}) })).status,
    ).toBe(401)
  })
})

describe('位置情報の同意（FR-01-4）', () => {
  it('初回ログイン直後は未同意', async () => {
    const body = await loginOk()
    expect(body.user.locationConsentGiven).toBe(false)
  })

  it('同意すると記録され、次のログインでも保たれる', async () => {
    const { token } = await loginOk()

    const consented = await json<MeResponse>(
      await app.request('/v1/me/location-consent', {
        method: 'POST',
        headers: auth(token),
        body: JSON.stringify({ granted: true }),
      }),
    )
    expect(consented.user.locationConsentGiven).toBe(true)

    // ★ ログインし直しても同意が消えない（貯めたものを初期化しない）
    const again = await loginOk()
    expect(again.user.locationConsentGiven).toBe(true)
  })

  it('撤回できる', async () => {
    const { token } = await loginOk()
    await app.request('/v1/me/location-consent', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ granted: true }),
    })

    const revoked = await json<MeResponse>(
      await app.request('/v1/me/location-consent', {
        method: 'POST',
        headers: auth(token),
        body: JSON.stringify({ granted: false }),
      }),
    )
    expect(revoked.user.locationConsentGiven).toBe(false)
  })

  it('真偽値以外は 400', async () => {
    const { token } = await loginOk()
    const response = await app.request('/v1/me/location-consent', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ granted: 'yes' }),
    })
    expect(response.status).toBe(400)
  })
})

describe('GET /v1/spots（FR-02）', () => {
  it('エリア内のスポットを返す', async () => {
    const { token } = await loginOk()
    const body = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))

    expect(body.area.areaId).toBe('chiyoda-minato')
    expect(body.spots.length).toBeGreaterThan(0)
    // 4カテゴリが揃っている（FR-02-1）
    expect(new Set(body.spots.map((s) => s.category)).size).toBe(4)
  })

  it('現在地を渡すと距離が付いて近い順になる', async () => {
    const { token } = await loginOk()
    // 日比谷公園のすぐ近く
    const body = await json<SpotsResponse>(
      await app.request('/v1/spots?lat=35.6740&lng=139.7569', { headers: auth(token) }),
    )

    expect(body.spots[0]?.distanceM).not.toBeNull()
    const distances = body.spots.map((s) => s.distanceM ?? Infinity)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
  })

  it('★ 上限以内なら truncated は false', async () => {
    const { token } = await loginOk()
    const body = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    expect(body.truncated).toBe(false)
  })

  it('★ 上限で切れたら truncated が true になる（黙って切らない）', async () => {
    const { token } = await loginOk()
    // サンプルは4件。上限2件にすれば切れる
    const body = await json<SpotsResponse>(
      await app.request('/v1/spots?limit=2', { headers: auth(token) }),
    )
    expect(body.spots).toHaveLength(2)
    expect(body.truncated).toBe(true)
  })

  it('現在地が無ければ距離は null', async () => {
    const { token } = await loginOk()
    const body = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    expect(body.spots.every((s) => s.distanceM === null)).toBe(true)
  })

  it('★ 出典と取得日を保持している（FR-10-2）', async () => {
    const { token } = await loginOk()
    const body = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    for (const spot of body.spots) {
      expect(spot.source).not.toBe('')
      expect(spot.fetchedAt).not.toBe('')
    }
  })

  it('範囲外の緯度経度は 400', async () => {
    const { token } = await loginOk()
    const response = await app.request('/v1/spots?lat=999&lng=139', { headers: auth(token) })
    expect(response.status).toBe(400)
  })

  it('個別取得は存在しない ID で 404', async () => {
    const { token } = await loginOk()
    const response = await app.request('/v1/spots/does-not-exist', { headers: auth(token) })
    expect(response.status).toBe(404)

    const body = await json<ErrorResponse>(response)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('個別取得は不正な形の ID で 400', async () => {
    const { token } = await loginOk()
    const response = await app.request('/v1/spots/NOT_VALID', { headers: auth(token) })
    expect(response.status).toBe(400)
  })
})

describe('探索（FR-02-7）', () => {
  /** 日比谷公園。千代田区の町丁目に入る座標 */
  const HIBIYA = { lat: 35.6739, lng: 139.7568 }
  const TILE_STEP = 50 / 111_320

  async function record(points: { lat: number; lng: number }[], token: string) {
    return app.request('/v1/exploration', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ points }),
    })
  }

  it('最初は何も塗られていない', async () => {
    const { token } = await loginOk()
    const body = await json<ExplorationResponse>(
      await app.request('/v1/exploration', { headers: auth(token) }),
    )
    expect(body.tiles).toHaveLength(0)
    expect(body.unlockedAreas).toHaveLength(0)
    expect(body.summary.tileCount).toBe(0)
  })

  it('歩いた座標がタイルとして記録される', async () => {
    const { token } = await loginOk()
    const body = await json<ExplorationUpdateResponse>(await record([HIBIYA], token))

    expect(body.newTileCount).toBe(1)
    expect(body.tiles).toHaveLength(1)
    expect(body.summary.tileCount).toBe(1)
  })

  it('★ 同じタイル内で動いても増えない（書き込みが利用量に比例しない）', async () => {
    const { token } = await loginOk()
    await record([HIBIYA], token)

    // 同じタイルの中を少しずれた3点
    const body = await json<ExplorationUpdateResponse>(
      await record(
        [
          { lat: HIBIYA.lat + TILE_STEP * 0.1, lng: HIBIYA.lng },
          { lat: HIBIYA.lat, lng: HIBIYA.lng + TILE_STEP * 0.1 },
          HIBIYA,
        ],
        token,
      ),
    )
    expect(body.newTileCount).toBe(0)
    expect(body.tiles).toHaveLength(1)
  })

  it('★ 他ユーザーの記録は見えない', async () => {
    const { token } = await loginOk()
    await record([HIBIYA], token)

    // 別ユーザーとしてログインし直す
    mockLineVerify(validPayload({ sub: 'Uffffffffffffffffffffffffffffffff' }))
    const other = await json<LoginResponse>(
      await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: 'dummy' }),
      }),
    )

    const body = await json<ExplorationResponse>(
      await app.request('/v1/exploration', { headers: auth(other.token) }),
    )
    expect(body.tiles).toHaveLength(0)
  })

  it('★ 一定割合を歩くと町丁目が開放され、探索率も全面ぶんになる', async () => {
    const { token } = await loginOk()

    // 同じ町丁目に収まる範囲を格子で埋める（東へ一列だと隣の町丁目へ抜ける）
    const points: { lat: number; lng: number }[] = []
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        points.push({ lat: HIBIYA.lat + row * TILE_STEP, lng: HIBIYA.lng + col * TILE_STEP })
      }
    }

    const body = await json<ExplorationUpdateResponse>(await record(points, token))

    expect(body.unlockedAreas.length).toBeGreaterThanOrEqual(1)
    // 町丁目名が返る。「300m四方の区画」ではなく地名で言える
    expect(body.unlockedAreas[0]?.name).not.toBe('')
    expect(body.unlockedAreas[0]?.ward).toBe('千代田区')
    // 歩いた枚数より多く数えられる（開放された区画は全面ぶん）
    expect(body.summary.tileCount).toBeGreaterThan(body.tiles.length)
  })

  it('★ 境界データの外を歩いても区画は開かない', async () => {
    const { token } = await loginOk()

    // 新宿区。両区の境界データを持っていないので区画にならない
    const points = Array.from({ length: 30 }, (_, i) => ({
      lat: 35.6938 + i * TILE_STEP,
      lng: 139.7034,
    }))
    const body = await json<ExplorationUpdateResponse>(await record(points, token))

    expect(body.tiles.length).toBeGreaterThan(0)
    expect(body.unlockedAreas).toHaveLength(0)
  })

  it('点が無い・多すぎるリクエストは 400', async () => {
    const { token } = await loginOk()
    expect((await record([], token)).status).toBe(400)

    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      lat: HIBIYA.lat + i * TILE_STEP,
      lng: HIBIYA.lng,
    }))
    expect((await record(tooMany, token)).status).toBe(400)
  })

  it('認証なしは 401', async () => {
    expect((await app.request('/v1/exploration')).status).toBe(401)
  })
})

describe('POST /v1/admin/seed', () => {
  it('★ 管理キーだけで投入できる（LINE ログインを要求しない）', async () => {
    // 運用者が端末や CI から叩く。セッショントークンを要求すると、
    // 取るために LINE アプリを開く必要が出てしまう
    const response = await app.request('/v1/admin/seed', {
      method: 'POST',
      headers: { 'x-admin-key': 'test-admin-key' },
    })
    expect(response.status).toBe(200)
    expect((await json<SeedResponse>(response)).inserted).toBeGreaterThan(0)
  })

  it('★ 範囲を指定して少しずつ入れられる（一息に入れない）', async () => {
    const first = await json<SeedResponse>(
      await app.request('/v1/admin/seed?offset=0&count=2', {
        method: 'POST',
        headers: { 'x-admin-key': 'test-admin-key' },
      }),
    )
    expect(first.inserted).toBe(2)
    expect(first.from).toBe(0)
    expect(first.to).toBe(2)
    // 続きの位置が返る
    expect(first.nextOffset).toBe(2)
    expect(first.stoppedAt).toBeUndefined()

    const second = await json<SeedResponse>(
      await app.request(`/v1/admin/seed?offset=${first.nextOffset}&count=100`, {
        method: 'POST',
        headers: { 'x-admin-key': 'test-admin-key' },
      }),
    )
    expect(second.from).toBe(2)
    // 全件入り切ったので次は無い
    expect(second.nextOffset).toBeNull()
  })

  it('★ 1件だけ入れて設定の誤りを切り分けられる', async () => {
    const body = await json<SeedResponse>(
      await app.request('/v1/admin/seed?count=1', {
        method: 'POST',
        headers: { 'x-admin-key': 'test-admin-key' },
      }),
    )
    expect(body.inserted).toBe(1)
    expect(body.total).toBeGreaterThan(1)
  })

  it('★ 範囲の指定が不正なら 400', async () => {
    const response = await app.request('/v1/admin/seed?count=0', {
      method: 'POST',
      headers: { 'x-admin-key': 'test-admin-key' },
    })
    expect(response.status).toBe(400)
  })

  it('間隔を指定しても入る（速すぎる書き込みを避けられる）', async () => {
    const body = await json<SeedResponse>(
      await app.request('/v1/admin/seed?count=2&delayMs=1', {
        method: 'POST',
        headers: { 'x-admin-key': 'test-admin-key' },
      }),
    )
    expect(body.inserted).toBe(2)
  })

  it('★ 消してから入れ直せる（やり直しの経路）', async () => {
    // まず全件入れる
    await app.request('/v1/admin/seed?count=200', {
      method: 'POST',
      headers: { 'x-admin-key': 'test-admin-key' },
    })

    const purged = await json<PurgeResponse>(
      await app.request('/v1/admin/purge?count=200', {
        method: 'POST',
        headers: { 'x-admin-key': 'test-admin-key' },
      }),
    )
    expect(purged.deleted).toBeGreaterThan(0)
    expect(purged.stopped).toBe(false)

    // 消えていること
    const { token } = await loginOk()
    const after = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    expect(after.spots).toHaveLength(0)

    // 入れ直せること
    await app.request('/v1/admin/seed?count=200', {
      method: 'POST',
      headers: { 'x-admin-key': 'test-admin-key' },
    })
    const again = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    expect(again.spots.length).toBeGreaterThan(0)
  })

  it('★ 削除も管理キーだけで通り、鍵が違えば 403', async () => {
    expect(
      (await app.request('/v1/admin/purge', { method: 'POST', headers: { 'x-admin-key': 'wrong' } }))
        .status,
    ).toBe(403)
    expect((await app.request('/v1/admin/purge', { method: 'POST' })).status).toBe(403)
  })

  it('★ 管理キーが違えば 403（401 ではない）', async () => {
    const response = await app.request('/v1/admin/seed', {
      method: 'POST',
      headers: { 'x-admin-key': 'wrong' },
    })
    expect(response.status).toBe(403)
  })

  it('★ 管理キーの前方一致では通らない（長さ違いを弾く）', async () => {
    const response = await app.request('/v1/admin/seed', {
      method: 'POST',
      headers: { 'x-admin-key': 'test-admin' },
    })
    expect(response.status).toBe(403)
  })

  it('★ 管理キーが無ければ 403', async () => {
    const response = await app.request('/v1/admin/seed', { method: 'POST' })
    expect(response.status).toBe(403)
  })

  it('セッショントークンを一緒に送っても通る（従来の呼び方を壊さない）', async () => {
    const { token } = await loginOk()
    const response = await app.request('/v1/admin/seed', {
      method: 'POST',
      headers: { ...auth(token), 'x-admin-key': 'test-admin-key' },
    })
    expect(response.status).toBe(200)
  })
})
