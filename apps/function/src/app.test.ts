import { FakeDataStoreClient, setDataStoreClient } from '@imanouchi/datastore'
import type {
  AdminConfigResponse,
  CardsResponse,
  CheckinResponse,
  ClientConfigResponse,
  ErrorResponse,
  HealthResponse,
  LoginResponse,
  ExplorationResponse,
  ExplorationUpdateResponse,
  GuestLoginResponse,
  MeResponse,
  ProgressResponse,
  PurgeResponse,
  QuizAnswerResponse,
  QuizResponse,
  SeedResponse,
  SpotsResponse,
  SurveyAnswerResponse,
  SurveyResponse,
} from '@imanouchi/shared'
import { HAIR_NAMES } from '@imanouchi/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { resetRateLimit } from './middleware/rate-limit.js'
import { fakeDataStore, resetFakeDataStore } from './services/datastore-context.js'
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

/**
 * インメモリ実装の中身を見る。
 *
 * ★ おためし（ゲスト）で「書かれていないこと」を確かめるには、レスポンスだけでは
 * 足りない。**行が増えていないこと**を見る必要がある。
 */
function dump(tableId: string): Record<string, unknown>[] {
  const store = fakeDataStore()
  expect(store, 'インメモリ実装が使われていない').toBeDefined()
  return store!.client.dump(tableId)
}

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
  process.env['ENABLE_GUEST_MODE'] = 'true'
  // ★ 個別のテストで上書きするので、毎回消してから始める（前のテストの値が残る）
  delete process.env['CHECKIN_COOLDOWN_HOURS']
  // ローカル起動（local.ts）と同じ状態にする。個別のテストが上書きする
  process.env['ENABLE_DEV_LOGIN'] = 'true'
  delete process.env['MAX_SPOTS_PER_REQUEST']
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
    /*
     * ★ 髪型の番号は選択肢の数より小さいものを使う。
     * 選択肢は「絵が描けるものだけ」に絞ってあり（HAIR_NAMES）、数は変わりうる。
     * 固定の大きい番号を書くと、選択肢を減らしたときにこのテストだけが落ちる（実際に落ちた）。
     */
    const hair = HAIR_NAMES.length - 1
    await app.request('/v1/me/avatar', {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ ...user.avatar, hair }),
    })

    const again = await loginOk()
    expect(again.user.avatar.hair).toBe(hair)
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

/**
 * おためし利用（LINE ログインなし）。
 *
 * ★ 守りたいのは「読めるものしか通らない」こと。ルートを足したときに
 * 書き忘れて**おためしの利用者がデータストアへ書ける**のが最悪の壊れ方である。
 */
describe('おためし利用（POST /v1/auth/guest）', () => {
  async function guestToken(): Promise<string> {
    const response = await app.request('/v1/auth/guest', { method: 'POST' })
    expect(response.status).toBe(200)
    const body = await json<GuestLoginResponse>(response)
    return body.token
  }

  it('LINE ログインなしでセッションを発行する', async () => {
    const response = await app.request('/v1/auth/guest', { method: 'POST' })
    const body = await json<GuestLoginResponse>(response)

    expect(response.status).toBe(200)
    expect(body.token).not.toBe('')
    expect(body.user.displayName).toBe('おためし')
    // ★ 同意はサーバーに持てない（書けない）。端末の中だけで扱う
    expect(body.user.locationConsentGiven).toBe(false)
  })

  it('★ ゲストIDは LINE の userId の形と重ならない', async () => {
    const body = await json<GuestLoginResponse>(
      await app.request('/v1/auth/guest', { method: 'POST' }),
    )
    expect(body.user.userId).toMatch(/^G[0-9a-f]{32}$/)
  })

  it('スポットは読める（地図が成立する最低限）', async () => {
    const token = await guestToken()
    const response = await app.request('/v1/spots', { headers: auth(token) })
    const body = await json<SpotsResponse>(response)

    expect(response.status).toBe(200)
    expect(body.spots.length).toBeGreaterThan(0)
  })

  it('スポット詳細も読める', async () => {
    const token = await guestToken()
    const spots = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    const spotId = spots.spots[0]?.spotId

    const response = await app.request(`/v1/spots/${spotId}`, { headers: auth(token) })
    expect(response.status).toBe(200)
  })

  it('★ 書き込みは通らない（探索・同意・キャラクター）', async () => {
    const token = await guestToken()

    const writes = [
      ['/v1/exploration', 'POST', JSON.stringify({ points: [{ lat: 35.6739, lng: 139.7568 }] })],
      ['/v1/me/location-consent', 'POST', JSON.stringify({ agreed: true })],
      ['/v1/me/avatar', 'PUT', JSON.stringify({ hair: 'short', outfit: 'casual' })],
    ] as const

    for (const [path, method, body] of writes) {
      const response = await app.request(path, { method, headers: auth(token), body })
      expect(response.status, `${method} ${path}`).toBe(403)
      expect((await json<ErrorResponse>(response)).error.code).toBe('FORBIDDEN')
    }
  })

  it('★ 自分の記録の読み取りも通らない（ユーザーごとの経路は開けない）', async () => {
    const token = await guestToken()

    for (const path of ['/v1/me', '/v1/exploration']) {
      const response = await app.request(path, { headers: auth(token) })
      expect(response.status, path).toBe(403)
    }
  })

  it('★ サーバー側でおためしを止められる', async () => {
    process.env['ENABLE_GUEST_MODE'] = 'false'
    const response = await app.request('/v1/auth/guest', { method: 'POST' })

    expect(response.status).toBe(403)
  })
})

/* ------------------------------------------------------------------ *
 * チェックイン（FR-03）
 * ------------------------------------------------------------------ */

/** サンプルデータの避難場所（日比谷公園）。位置はこのスポットに合わせる */
const SHELTER_SPOT_ID = 'sample-hibiya-park'
const AT_SPOT = { lat: 35.6739, lng: 139.7568 }

function checkinBody(position: { lat: number; lng: number }): string {
  return JSON.stringify(position)
}

async function checkin(
  token: string,
  position: { lat: number; lng: number },
  spotId = SHELTER_SPOT_ID,
): Promise<Response> {
  return app.request(`/v1/spots/${spotId}/checkin`, {
    method: 'POST',
    headers: auth(token),
    body: checkinBody(position),
  })
}

describe('POST /v1/spots/:spotId/checkin', () => {
  it('圏内ならチェックインでき、初回ボーナスが付く（FR-03-1・FR-03-2）', async () => {
    const { token } = await loginOk()
    const response = await checkin(token, AT_SPOT)
    const body = await json<CheckinResponse>(response)

    expect(response.status).toBe(200)
    expect(body.saved).toBe(true)
    expect(body.breakdown.firstVisitBonus).toBeGreaterThan(0)
    expect(body.pointsEarned).toBe(body.breakdown.base + body.breakdown.firstVisitBonus)
    expect(body.totalPoints).toBe(body.pointsEarned)
    expect(body.visitCount).toBe(1)
    // 回数は事前計算で持つ（集計クエリが無いため）
    expect(body.spot.checkinCount).toBe(1)
  })

  it('累計ポイントが /v1/me にも反映される', async () => {
    const { token } = await loginOk()
    const earned = (await json<CheckinResponse>(await checkin(token, AT_SPOT))).pointsEarned

    const me = await json<MeResponse>(await app.request('/v1/me', { headers: auth(token) }))
    expect(me.user.totalPoints).toBe(earned)
  })

  it('★ 圏外は 409 TOO_FAR。距離を返して近づけることを伝える', async () => {
    const { token } = await loginOk()
    // 約 1.4km 南（サーバーが距離を計算するので、申告位置がそのまま判定される）
    const response = await checkin(token, { lat: 35.6615, lng: 139.7568 })
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(409)
    expect(body.error.code).toBe('TOO_FAR')
    expect(body.error.details?.['distanceM']).toBeGreaterThan(100)
  })

  it('★ 同一スポットの再チェックインは制限される（FR-03-3）', async () => {
    const { token } = await loginOk()
    expect((await checkin(token, AT_SPOT)).status).toBe(200)

    const response = await checkin(token, AT_SPOT)
    const body = await json<ErrorResponse>(response)

    expect(response.status).toBe(409)
    expect(body.error.code).toBe('COOLDOWN')
    expect(typeof body.error.details?.['nextAvailableAt']).toBe('string')
  })

  it('★ 制限が明けたら初回ボーナス無しで通り、訪問回数が増える', async () => {
    /*
     * ★ 偽の時計を持ち込まず、待ち時間を 0 にして「明けた状態」を作る。
     * 時刻をずらす仕掛けはテストの外（環境変数）に置くほうが壊れにくい。
     * クールダウンの境界そのものは packages/core の単体テストで見ている。
     */
    process.env['CHECKIN_COOLDOWN_HOURS'] = '0'
    const { token } = await loginOk()
    await checkin(token, AT_SPOT)

    const body = await json<CheckinResponse>(await checkin(token, AT_SPOT))
    expect(body.breakdown.firstVisitBonus).toBe(0)
    expect(body.pointsEarned).toBe(body.breakdown.base)
    expect(body.visitCount).toBe(2)
    expect(body.spot.checkinCount).toBe(2)
  })

  it('存在しないスポットは 404', async () => {
    const { token } = await loginOk()
    const response = await checkin(token, AT_SPOT, 'sample-does-not-exist')
    expect(response.status).toBe(404)
  })

  it('spotId の形が不正なら 400', async () => {
    const { token } = await loginOk()
    const response = await checkin(token, AT_SPOT, 'NOT_A_SPOT_ID')
    expect(response.status).toBe(400)
  })

  it('★ 認証なしでは呼べない', async () => {
    const response = await app.request(`/v1/spots/${SHELTER_SPOT_ID}/checkin`, {
      method: 'POST',
      body: checkinBody(AT_SPOT),
    })
    expect(response.status).toBe(401)
  })

  it('★ 履歴が新しい順に取れる形で入る（サブキーは数値）', async () => {
    const { token } = await loginOk()
    await checkin(token, AT_SPOT)

    const rows = dump('fake-checkins')
    expect(rows.length).toBe(1)
    expect(typeof rows[0]?.['checkinAt']).toBe('number')
    // スポット名は非正規化して持つ（JOIN が無いため）
    expect(rows[0]?.['spotName']).toContain('日比谷公園')
  })
})

/* ------------------------------------------------------------------ *
 * クイズ（FR-04）
 * ------------------------------------------------------------------ */

async function fetchQuiz(token: string, spotId = SHELTER_SPOT_ID): Promise<QuizResponse> {
  const response = await app.request(`/v1/spots/${spotId}/quiz`, { headers: auth(token) })
  expect(response.status).toBe(200)
  return json<QuizResponse>(response)
}

async function answer(
  token: string,
  quizId: string,
  choiceIndex: number,
  spotId = SHELTER_SPOT_ID,
): Promise<Response> {
  return app.request(`/v1/spots/${spotId}/quiz/answer`, {
    method: 'POST',
    headers: auth(token),
    body: JSON.stringify({ quizId, choiceIndex }),
  })
}

describe('GET /v1/spots/:spotId/quiz', () => {
  it('スポットに応じた出題を返す（FR-04-1）', async () => {
    const { token } = await loginOk()
    const body = await fetchQuiz(token)

    expect(body.quiz.question).not.toBe('')
    expect(body.quiz.options.length).toBeGreaterThanOrEqual(2)
    expect(body.quiz.generatedBy).toBe('fixture')
    expect(body.alreadyCleared).toBe(false)
  })

  it('★ レスポンスに正解も解説も含まれない（配信物から答えが読めない）', async () => {
    const { token } = await loginOk()
    const text = await (
      await app.request(`/v1/spots/${SHELTER_SPOT_ID}/quiz`, { headers: auth(token) })
    ).text()

    expect(text).not.toContain('answerIndex')
    expect(text).not.toContain('explanation')
  })

  it('★ 同じスポットでは毎回同じ問題が出る（リロードで変わらない）', async () => {
    const { token } = await loginOk()
    const first = await fetchQuiz(token)
    const second = await fetchQuiz(token)

    expect(second.quiz.quizId).toBe(first.quiz.quizId)
  })

  it('★ 未正解のうちは行動を問う設問が出る（FR-04-7・G-8）', async () => {
    const { token } = await loginOk()
    const body = await fetchQuiz(token)

    // 固定データでは行動の設問だけが `-action-` / `-flood-` の形を持つ
    expect(body.quiz.quizId.startsWith('shelter-action')).toBe(true)
  })
})

describe('POST /v1/spots/:spotId/quiz/answer', () => {
  it('正解でボーナスポイントが入る（FR-04-3）', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)

    const body = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 0))

    expect(body.correct).toBe(true)
    expect(body.pointsEarned).toBeGreaterThan(0)
    expect(body.totalPoints).toBe(body.pointsEarned)
    expect(body.saved).toBe(true)
    expect(body.canRetry).toBe(false)
  })

  it('★ 不正解でも解説と正解が返り、再挑戦できる（FR-04-6・G-7）', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)

    const body = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 1))

    expect(body.correct).toBe(false)
    expect(body.explanation).not.toBe('')
    expect(body.answerIndex).toBe(0)
    expect(body.canRetry).toBe(true)
    // ★ ペナルティを与えない
    expect(body.pointsEarned).toBe(0)
    expect(body.totalPoints).toBe(0)
  })

  it('★ 報酬はスポットごとに一度だけ（二度目の正解では増えない）', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)
    const first = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 0))

    const again = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 0))

    expect(again.correct).toBe(true)
    expect(again.pointsEarned).toBe(0)
    expect(again.totalPoints).toBe(first.totalPoints)
    expect(again.saved).toBe(false)
  })

  it('正解済みなら次は設備・備蓄を問う設問が出る（行動を扱ったあと）', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)
    await answer(token, quiz.quiz.quizId, 0)

    const next = await fetchQuiz(token)
    expect(next.alreadyCleared).toBe(true)
    expect(next.quiz.quizId).not.toBe(quiz.quiz.quizId)
  })

  it('★ 別スポットのクイズIDで報酬だけ得ることはできない', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)

    // 避難場所の設問を AED のスポットへ送る
    const response = await answer(token, quiz.quiz.quizId, 0, 'sample-toranomon-aed')

    expect(response.status).toBe(400)
    expect((await json<ErrorResponse>(response)).error.code).toBe('BAD_REQUEST')
  })

  it('選択肢の範囲外は 400', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)

    const response = await answer(token, quiz.quiz.quizId, 9)
    expect(response.status).toBe(400)
  })

  it('存在しないクイズIDは 404', async () => {
    const { token } = await loginOk()
    const response = await answer(token, 'no-such-quiz', 0)
    expect(response.status).toBe(404)
  })
})

/* ------------------------------------------------------------------ *
 * おためし（ゲスト）でのチェックインとクイズ
 * ------------------------------------------------------------------ */

describe('おためしのチェックイン・クイズ', () => {
  async function guestToken(): Promise<string> {
    const response = await app.request('/v1/auth/guest', { method: 'POST' })
    expect(response.status).toBe(200)
    return (await json<GuestLoginResponse>(response)).token
  }

  it('判定はサーバーが行う（圏内なら成功する）', async () => {
    const token = await guestToken()
    const body = await json<CheckinResponse>(await checkin(token, AT_SPOT))

    expect(body.pointsEarned).toBeGreaterThan(0)
    // ★ サーバーは累計を持たない。画面が端末の記録へ加算する合図
    expect(body.saved).toBe(false)
    expect(body.totalPoints).toBe(0)
  })

  it('★ チェックインしてもデータストアには何も書かれない', async () => {
    const token = await guestToken()
    await checkin(token, AT_SPOT)

    expect(dump('fake-checkins')).toEqual([])
    expect(dump('fake-user-spot-state')).toEqual([])
    expect(dump('fake-users')).toEqual([])
  })

  it('★ 圏外はゲストでも弾かれる（位置の判定は同じ経路）', async () => {
    const token = await guestToken()
    const response = await checkin(token, { lat: 35.6615, lng: 139.7568 })

    expect(response.status).toBe(409)
    expect((await json<ErrorResponse>(response)).error.code).toBe('TOO_FAR')
  })

  it('クイズは採点までサーバーで行い、保存はしない', async () => {
    const token = await guestToken()
    const quiz = await fetchQuiz(token)

    const wrong = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 1))
    expect(wrong.correct).toBe(false)
    expect(wrong.explanation).not.toBe('')

    const right = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 0))
    expect(right.correct).toBe(true)
    expect(right.pointsEarned).toBeGreaterThan(0)
    expect(right.saved).toBe(false)
    expect(dump('fake-user-spot-state')).toEqual([])
  })

  it('★ アンケートに答えても集計へは足されない（公開データに混ぜない）', async () => {
    const token = await guestToken()
    const body = await json<SurveyAnswerResponse>(
      await submitSurvey(token, { answers: { ostomate: 'yes' } }),
    )

    expect(body.pointsEarned).toBeGreaterThan(0)
    expect(body.saved).toBe(false)
    expect(body.verifiedFieldKeys).toEqual([])
    /*
     * ★ おためしは身元を持たないので、同じ端末から何度でも送れる。それを集計へ
     * 混ぜると**検証済み（FR-06-2）という表示が意味を失う。**
     */
    expect(dump('fake-user-spot-state')).toEqual([])
    expect(surveyTally(SHELTER_SPOT_ID, 'ostomate', 'yes')).toBe(0)
  })
})

/* ------------------------------------------------------------------ *
 * 現地確認アンケート（FR-12）
 * ------------------------------------------------------------------ */

async function fetchSurvey(token: string, spotId = SHELTER_SPOT_ID): Promise<SurveyResponse> {
  const response = await app.request(`/v1/spots/${spotId}/survey`, { headers: auth(token) })
  expect(response.status).toBe(200)
  return json<SurveyResponse>(response)
}

async function submitSurvey(
  token: string,
  body: { answers: Record<string, string>; note?: string },
  spotId = SHELTER_SPOT_ID,
): Promise<Response> {
  return app.request(`/v1/spots/${spotId}/survey`, {
    method: 'POST',
    headers: auth(token),
    body: JSON.stringify(body),
  })
}

/** スポットの行に事前計算されている件数を直接見る（集計クエリが無いため） */
function surveyTally(spotId: string, fieldKey: string, value: string): number {
  const row = dump('fake-spots').find((item) => item['spotId'] === spotId)
  const count = row?.[`sv_${fieldKey}_${value}`]
  return typeof count === 'number' ? count : 0
}

/**
 * 別の LINE 利用者でログインする。
 *
 * ★ 合意（FR-06-2）は**独立した2人**が同じ答えを出したときに成立する。
 * 1人で越えられないことを固定するには、2人目が要る。
 */
async function loginAsOther(): Promise<LoginResponse> {
  mockLineVerify(validPayload({ sub: 'Ufedcba9876543210fedcba9876543210', name: '鈴木 花子' }))
  const response = await app.request('/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: 'dummy-id-token' }),
  })
  expect(response.status).toBe(200)
  return json<LoginResponse>(response)
}

describe('GET /v1/spots/:spotId/survey', () => {
  it('カテゴリごとのデータ辞書から設問を返す（FR-12-1）', async () => {
    const { token } = await loginOk()
    const body = await fetchSurvey(token)

    expect(body.spotName).toContain('日比谷公園')
    expect(body.fields.length).toBe(3)
    expect(body.fields.every((field) => field.question !== '')).toBe(true)
    expect(body.alreadyAnswered).toBe(false)
  })

  it('★ 行政データの記載の有無で「確かめる／埋める」が切り替わる（FR-12-2）', async () => {
    /*
     * 日比谷公園（サンプル）の属性は ['スロープ等', '車椅子使用者対応トイレ']。
     * 段差は記載があるので**確かめる**設問、オストメイトは記載が無いので
     * **埋める**設問になる。ここが逆になると、行政データに既にある項目を
     * 集めに行くことになり FR-12 の原則に反する。
     */
    const { token } = await loginOk()
    const body = await fetchSurvey(token)

    expect(body.fields.find((field) => field.fieldKey === 'step_free')?.intent).toBe('verify')
    expect(body.fields.find((field) => field.fieldKey === 'ostomate')?.intent).toBe('fill')
  })

  it('★ 属性が1件も無い AED は満額になる（欠損の多いほうが得・要点P-1）', async () => {
    const { token } = await loginOk()
    const shelter = await fetchSurvey(token)
    const aed = await fetchSurvey(token, 'sample-toranomon-aed')

    // AED は3問すべてが「埋める」側、避難所は1問が「確かめる」側
    expect(aed.fields.every((field) => field.intent === 'fill')).toBe(true)
    expect(aed.pointsIfAnswered).toBeGreaterThan(shelter.pointsIfAnswered)
  })

  it('まだ誰も答えていない項目は empty で返る（FR-12-2 の未取得）', async () => {
    const { token } = await loginOk()
    const body = await fetchSurvey(token)

    expect(body.fields.every((field) => field.consensus.status === 'empty')).toBe(true)
  })

  it('存在しないスポットは 404', async () => {
    const { token } = await loginOk()
    const response = await app.request('/v1/spots/sample-does-not-exist/survey', {
      headers: auth(token),
    })
    expect(response.status).toBe(404)
  })
})

describe('POST /v1/spots/:spotId/survey', () => {
  it('回答が集計と本人の記録の両方に入り、ポイントが付く', async () => {
    const { token } = await loginOk()
    const body = await json<SurveyAnswerResponse>(
      await submitSurvey(token, {
        answers: { step_free: 'yes', ostomate: 'no', pet_ok: 'unknown' },
        note: '入口は北側だけ開いている',
      }),
    )

    expect(body.saved).toBe(true)
    expect(body.recordedCount).toBe(3)
    expect(body.pointsEarned).toBeGreaterThan(0)
    expect(body.totalPoints).toBe(body.pointsEarned)

    expect(surveyTally(SHELTER_SPOT_ID, 'step_free', 'yes')).toBe(1)
    expect(surveyTally(SHELTER_SPOT_ID, 'ostomate', 'no')).toBe(1)
    // ★ 「わからない」も数える。不明であること自体が情報である
    expect(surveyTally(SHELTER_SPOT_ID, 'pet_ok', 'unknown')).toBe(1)

    const row = dump('fake-user-spot-state')[0]
    expect(row?.['surveyNote']).toBe('入口は北側だけ開いている')
  })

  it('★ ポイントは答えの中身で変わらない（断定させる動機を作らない）', async () => {
    /*
     * ★ ここが崩れると公開データの精度がそのまま落ちる。「はい／いいえ」に
     * 加点して「わからない」に加点しない形にすると、**見ていないのに断定する**
     * ほうが得になる。倍率はスポット側の欠損数だけで決めている。
     */
    const first = await loginOk()
    const decided = await json<SurveyAnswerResponse>(
      await submitSurvey(first.token, { answers: { step_free: 'yes', ostomate: 'yes' } }),
    )

    const second = await loginAsOther()
    const unsure = await json<SurveyAnswerResponse>(
      await submitSurvey(second.token, { answers: { step_free: 'unknown', ostomate: 'unknown' } }),
    )

    expect(unsure.pointsEarned).toBe(decided.pointsEarned)
  })

  it('★ 同じ人は2回答えられない（1人で閾値を越えられないため）', async () => {
    const { token } = await loginOk()
    expect((await submitSurvey(token, { answers: { ostomate: 'yes' } })).status).toBe(200)

    const again = await submitSurvey(token, { answers: { ostomate: 'yes' } })
    expect(again.status).toBe(400)
    // 集計は増えていない
    expect(surveyTally(SHELTER_SPOT_ID, 'ostomate', 'yes')).toBe(1)
  })

  it('★ 独立した2人が同じ答えを出して初めて検証済みになる（FR-06-2）', async () => {
    const first = await loginOk()
    const one = await json<SurveyAnswerResponse>(
      await submitSurvey(first.token, { answers: { ostomate: 'yes' } }),
    )
    // 1人目では確定させない
    expect(one.verifiedFieldKeys).toEqual([])
    expect((await fetchSurvey(first.token)).fields.find((f) => f.fieldKey === 'ostomate')?.consensus.status).toBe(
      'reported',
    )

    const second = await loginAsOther()
    const two = await json<SurveyAnswerResponse>(
      await submitSurvey(second.token, { answers: { ostomate: 'yes' } }),
    )
    expect(two.verifiedFieldKeys).toEqual(['ostomate'])

    const view = await fetchSurvey(second.token)
    const field = view.fields.find((f) => f.fieldKey === 'ostomate')
    expect(field?.consensus.status).toBe('verified')
    expect(field?.consensus.value).toBe('yes')
  })

  it('★ 「わからない」が2件でも検証済みにならない（不明は確定ではない）', async () => {
    const first = await loginOk()
    await submitSurvey(first.token, { answers: { ostomate: 'unknown' } })
    const second = await loginAsOther()
    const body = await json<SurveyAnswerResponse>(
      await submitSurvey(second.token, { answers: { ostomate: 'unknown' } }),
    )

    expect(body.verifiedFieldKeys).toEqual([])
    expect(
      (await fetchSurvey(second.token)).fields.find((f) => f.fieldKey === 'ostomate')?.consensus.status,
    ).toBe('reported')
  })

  it('回答済みなら自分の回答が読み取り専用で返る', async () => {
    const { token } = await loginOk()
    await submitSurvey(token, { answers: { ostomate: 'no' } })

    const body = await fetchSurvey(token)
    expect(body.alreadyAnswered).toBe(true)
    expect(body.myAnswers).toEqual({ ostomate: 'no' })
  })

  it('★ 別カテゴリの項目キーは 400（集計を膨らませられない）', async () => {
    const { token } = await loginOk()
    // handrail はバリアフリートイレの設問。避難所には無い
    const response = await submitSurvey(token, { answers: { handrail: 'yes' } })

    expect(response.status).toBe(400)
    expect(surveyTally(SHELTER_SPOT_ID, 'handrail', 'yes')).toBe(0)
  })

  it('★ 選択肢の値は3値だけ（真偽値を受け付けない）', async () => {
    const { token } = await loginOk()
    const response = await submitSurvey(token, { answers: { ostomate: 'maybe' } })
    expect(response.status).toBe(400)
  })

  it('★ 自由記述は上限を超えると 400（そのまま公開できない文を長く受けない）', async () => {
    const { token } = await loginOk()
    const response = await submitSurvey(token, {
      answers: { ostomate: 'yes' },
      note: 'あ'.repeat(121),
    })
    expect(response.status).toBe(400)
  })

  it('アンケート回答で道具カードが手に入る（チェックインから移した報酬）', async () => {
    const { token } = await loginOk()
    const body = await json<SurveyAnswerResponse>(
      await submitSurvey(token, { answers: { ostomate: 'yes' } }),
    )

    // 避難所ではヘルメットが手に入る
    expect(body.acquiredCards.map((card) => card.cardId)).toContain('tool:helmet')
  })

  it('★ チェックインの状態を消さない（初回ボーナスと制限を壊さない）', async () => {
    const { token } = await loginOk()
    await checkin(token, AT_SPOT)
    await submitSurvey(token, { answers: { ostomate: 'yes' } })

    // アンケートのあとでも再チェックインは制限されたままである
    const again = await checkin(token, AT_SPOT)
    expect(again.status).toBe(409)
    expect((await json<ErrorResponse>(again)).error.code).toBe('COOLDOWN')
  })

  it('★ 認証なしでは呼べない', async () => {
    const response = await app.request(`/v1/spots/${SHELTER_SPOT_ID}/survey`, {
      method: 'POST',
      body: JSON.stringify({ answers: { ostomate: 'yes' } }),
    })
    expect(response.status).toBe(401)
  })
})

/* ------------------------------------------------------------------ *
 * 進み具合（FR-03-3 の再チェックイン制限を画面へ復元する）
 * ------------------------------------------------------------------ */

describe('GET /v1/progress', () => {
  it('チェックイン済みのスポットが次に押せる時刻つきで返る', async () => {
    const { token } = await loginOk()
    await checkin(token, AT_SPOT)

    const body = await json<ProgressResponse>(
      await app.request('/v1/progress', { headers: auth(token) }),
    )

    expect(body.truncated).toBe(false)
    const entry = body.spots.find((spot) => spot.spotId === SHELTER_SPOT_ID)
    expect(entry?.visitCount).toBe(1)
    expect(entry?.quizCleared).toBe(false)
    // ★ 待ち時間の計算はサーバー側（設定を変えたときに食い違わないようにする）
    expect(new Date(entry?.nextAvailableAt ?? 0).getTime()).toBeGreaterThan(Date.now())
  })

  it('★ これが無いと再読み込み後に押せてしまう、という値が入っている', async () => {
    /*
     * 実際に踏んだ不具合の再現。チェックイン → 別セッション（再読み込み相当）で
     * 進み具合を引き、**押せない状態を復元できること**を見る。
     */
    const first = await loginOk()
    await checkin(first.token, AT_SPOT)

    const second = await loginOk()
    const body = await json<ProgressResponse>(
      await app.request('/v1/progress', { headers: auth(second.token) }),
    )

    expect(body.spots.some((spot) => spot.spotId === SHELTER_SPOT_ID)).toBe(true)
  })

  it('クイズに正解しただけのスポットも返る（チェックインしていなくても）', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)
    await answer(token, quiz.quiz.quizId, 0)

    const body = await json<ProgressResponse>(
      await app.request('/v1/progress', { headers: auth(token) }),
    )
    const entry = body.spots.find((spot) => spot.spotId === SHELTER_SPOT_ID)

    expect(entry?.quizCleared).toBe(true)
    // ★ 行っていないので待ち時間は無い。ここに時刻が入ると初回ボーナスが消える
    expect(entry?.nextAvailableAt).toBeUndefined()
  })

  it('何もしていなければ空で返る', async () => {
    const { token } = await loginOk()
    const body = await json<ProgressResponse>(
      await app.request('/v1/progress', { headers: auth(token) }),
    )

    expect(body.spots).toEqual([])
  })

  it('★ 他人の進み具合は混ざらない', async () => {
    const mine = await loginOk()
    await checkin(mine.token, AT_SPOT)

    // 別の LINE ユーザーとしてログインする
    mockLineVerify(validPayload({ sub: 'U' + 'f'.repeat(32) }))
    const otherResponse = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'dummy-id-token' }),
    })
    const other = await json<LoginResponse>(otherResponse)

    const body = await json<ProgressResponse>(
      await app.request('/v1/progress', { headers: auth(other.token) }),
    )
    expect(body.spots).toEqual([])
  })

  it('★ おためしでは使えない（端末の記録を使う経路）', async () => {
    const guest = await json<GuestLoginResponse>(
      await app.request('/v1/auth/guest', { method: 'POST' }),
    )
    const response = await app.request('/v1/progress', { headers: auth(guest.token) })

    expect(response.status).toBe(403)
  })

  it('認証なしでは呼べない', async () => {
    expect((await app.request('/v1/progress')).status).toBe(401)
  })
})

/* ------------------------------------------------------------------ *
 * カードコレクション（FR-14）
 * ------------------------------------------------------------------ */

async function fetchCards(token: string): Promise<CardsResponse> {
  const response = await app.request('/v1/cards', { headers: auth(token) })
  expect(response.status).toBe(200)
  return json<CardsResponse>(response)
}

describe('GET /v1/cards', () => {
  it('4種のカードを1つの一覧で返す（FR-14-1）', async () => {
    const { token } = await loginOk()
    const body = await fetchCards(token)

    // 行動12 + 道具10 + ミッション3。場所は達成分だけなので0
    expect(body.summary.byKind.action.total).toBe(12)
    expect(body.summary.byKind.tool.total).toBe(10)
    expect(body.summary.byKind.mission.total).toBe(3)
    expect(body.cards.filter((card) => card.kind === 'place')).toEqual([])
  })

  it('★ 行動カードの見出しは「場面」で、行動は達成するまで見えない', async () => {
    const { token } = await loginOk()
    const body = await fetchCards(token)
    const card = body.cards.find((c) => c.cardId === 'action:shelter-action-1')

    expect(card?.achieved).toBe(false)
    expect(card?.title).toBe('大きな地震の直後')
    // ★ 中身を返さない。表示側で隠す形にすると、配信データを読めば分かってしまう
    expect(card?.body).toBeUndefined()
  })

  it('★ 未達成カードの中身がレスポンスに一切出ない（FR-14-3）', async () => {
    const { token } = await loginOk()
    const text = await (await app.request('/v1/cards', { headers: auth(token) })).text()

    // 行動カードの中身（答えそのもの）が本文に混ざっていないこと
    expect(text).not.toContain('頭を守って身を低くし')
    expect(text).not.toContain('揺れが収まるまで動かない')
  })

  it('場所カードはカテゴリ別の件数で残りを示す（全枚数を並べない）', async () => {
    const { token } = await loginOk()
    const body = await fetchCards(token)

    expect(body.places.length).toBeGreaterThan(0)
    for (const place of body.places) {
      expect(place.total).toBeGreaterThan(0)
      expect(place.achieved).toBe(0)
    }
    // 集計の総数はスポット件数（並べた枚数ではない）
    expect(body.summary.byKind.place.total).toBeGreaterThan(0)
  })

  it('★ 場所の総数は表示上限（MAX_SPOTS_PER_REQUEST）に引きずられない', async () => {
    /*
     * 実際に踏んだ間違い。表示用の上限（既定 200）で数えると、対象エリアの 370 件に
     * 対して「AED 0/200」のように**総数が嘘になる**（query はサブキーの昇順で返すため、
     * 辞書順で先のカテゴリだけが残る）。
     */
    process.env['MAX_SPOTS_PER_REQUEST'] = '1'
    const { token } = await loginOk()
    const body = await fetchCards(token)

    // 上限 1 でも、カードの総数はサンプルデータの全件ぶんになる
    expect(body.summary.byKind.place.total).toBeGreaterThan(1)
    expect(body.places.length).toBeGreaterThan(1)
  })

  it('★ 認証なし・おためしでは使えない', async () => {
    expect((await app.request('/v1/cards')).status).toBe(401)

    const guest = await json<GuestLoginResponse>(
      await app.request('/v1/auth/guest', { method: 'POST' }),
    )
    expect((await app.request('/v1/cards', { headers: auth(guest.token) })).status).toBe(403)
  })
})

describe('カードの達成（FR-14-4・FR-14-5・FR-14-6）', () => {
  it('チェックインで場所カードが達成される', async () => {
    const { token } = await loginOk()
    const body = await json<CheckinResponse>(await checkin(token, AT_SPOT))

    const ids = body.acquiredCards.map((card) => card.cardId)
    expect(ids).toContain(`place:${SHELTER_SPOT_ID}`)
    // ★ 達成したカードは中身が入っている（演出でそのまま見せる）
    expect(body.acquiredCards.every((card) => card.body !== undefined)).toBe(true)
  })

  it('★ チェックインでは道具カードを渡さない（アンケートへ移した・G-6）', async () => {
    /*
     * ★ 「近くまで来た」だけで道具が手に入ると、立ち止まって設備を見る動機が
     * 消える。集めたいデータはアンケート（FR-12）の側にあるので、報酬もそちらへ
     * 寄せてある。ここが戻ると**アンケートを飛ばしても損をしなくなる。**
     */
    const { token } = await loginOk()
    const body = await json<CheckinResponse>(await checkin(token, AT_SPOT))

    expect(body.acquiredCards.map((card) => card.cardId)).not.toContain('tool:helmet')
  })

  it('★ 2回目のチェックインではカードが増えない（達成は一度だけ）', async () => {
    process.env['CHECKIN_COOLDOWN_HOURS'] = '0'
    const { token } = await loginOk()
    await checkin(token, AT_SPOT)

    const again = await json<CheckinResponse>(await checkin(token, AT_SPOT))
    expect(again.acquiredCards).toEqual([])
  })

  it('クイズ正解で行動カードと道具カードが達成される', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)
    const body = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 0))

    const ids = body.acquiredCards.map((card) => card.cardId)
    expect(ids).toContain(`action:${quiz.quiz.quizId}`)
    // 避難所のクイズ正解では防炎ずきんが手に入る（チェックインの報酬と重ならない）
    expect(ids).toContain('tool:zukin')
  })

  it('不正解ではカードが増えない', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)
    const body = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 1))

    expect(body.acquiredCards).toEqual([])
  })

  it('★ ミッションは他のカードの枚数だけで達成する（FR-14-7）', async () => {
    const { token } = await loginOk()
    const quiz = await fetchQuiz(token)

    // 行動カード1枚で「まず身を守る」が達成される
    const body = await json<QuizAnswerResponse>(await answer(token, quiz.quiz.quizId, 0))
    expect(body.acquiredCards.map((card) => card.cardId)).toContain('mission:first-action')
  })

  it('達成したカードは一覧でも達成として返り、中身が見える', async () => {
    const { token } = await loginOk()
    await checkin(token, AT_SPOT)

    const cards = await fetchCards(token)
    const place = cards.cards.find((card) => card.cardId === `place:${SHELTER_SPOT_ID}`)

    expect(place?.achieved).toBe(true)
    expect(place?.body).not.toBe(undefined)
    expect(place?.achievedAt).not.toBe('')
    // カテゴリ別の件数にも反映される
    expect(cards.places.find((p) => p.category === 'shelter')?.achieved).toBe(1)
  })

  it('★ おためしではカードを配らない（データストアにも書かない）', async () => {
    const guest = await json<GuestLoginResponse>(
      await app.request('/v1/auth/guest', { method: 'POST' }),
    )
    const body = await json<CheckinResponse>(await checkin(guest.token, AT_SPOT))

    expect(body.acquiredCards).toEqual([])
    expect(dump('fake-user-cards')).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * 開発用ログイン（ローカル確認専用）
 * ------------------------------------------------------------------ */

describe('POST /v1/auth/dev', () => {
  /*
   * ★ 守りたいのは「本番に経路が生えない」ことである。
   *
   * ルートの登録が `useFakeDataStore` を条件にしているため、本番（テーブルへ
   * 接続する構成）ではハンドラそのものが存在しない。ここを崩すと、**誰でも
   * ログインできるエンドポイントが本番に生える。**
   */
  it('ローカル（インメモリ実装）ではログインでき、書き込みも通る', async () => {
    const response = await app.request('/v1/auth/dev', { method: 'POST' })
    expect(response.status).toBe(200)

    const body = await json<LoginResponse>(response)
    expect(body.user.userId).toMatch(/^U[0-9a-f]{32}$/)

    // LINE ログインと同じ形のセッションなので、書き込みが要る経路も通る
    const checkinResponse = await checkin(body.token, AT_SPOT)
    expect(checkinResponse.status).toBe(200)
    expect((await json<CheckinResponse>(checkinResponse)).saved).toBe(true)
  })

  it('★ インメモリ実装でなければ 404（本番に経路が生えない）', async () => {
    process.env['USE_FAKE_DATASTORE'] = 'false'

    const response = await app.request('/v1/auth/dev', { method: 'POST' })
    expect(response.status).toBe(404)
  })

  it('★ 環境変数で止められる', async () => {
    process.env['ENABLE_DEV_LOGIN'] = 'false'

    expect((await app.request('/v1/auth/dev', { method: 'POST' })).status).toBe(404)
  })

  it('クライアントへ「使えるか」を配る（画面が入口を出すかを決められる）', async () => {
    const body = await json<ClientConfigResponse>(await app.request('/v1/client-config'))
    expect(body.devLoginEnabled).toBe(true)

    process.env['USE_FAKE_DATASTORE'] = 'false'
    const production = await json<ClientConfigResponse>(await app.request('/v1/client-config'))
    expect(production.devLoginEnabled).toBe(false)
  })

  it('★ 同じ利用者として続けられる（開き直しても記録が残る）', async () => {
    const first = await json<LoginResponse>(await app.request('/v1/auth/dev', { method: 'POST' }))
    await checkin(first.token, AT_SPOT)

    const second = await json<LoginResponse>(await app.request('/v1/auth/dev', { method: 'POST' }))
    expect(second.user.userId).toBe(first.user.userId)
    expect(second.registered).toBe(false)
    expect(second.user.totalPoints).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ *
 * 装備（FR-07-8）
 * ------------------------------------------------------------------ */

describe('PUT /v1/me/equipment', () => {
  async function equip(token: string, equipment: Record<string, string | null>): Promise<Response> {
    return app.request('/v1/me/equipment', {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ head: null, body: null, hand: null, back: null, ...equipment }),
    })
  }

  /**
   * ヘルメットを手に入れる。
   *
   * ★ **入手先はチェックインではなくアンケートである**（FR-12・G-6）。
   * 近くまで来ただけで道具が手に入ると、立ち止まって設備を見る動機が消えるため、
   * 道具カードをアンケートへ移した。ここを1か所に寄せておかないと、入手先を
   * 変えるたびに装備のテストが道連れで落ちる。
   */
  async function acquireHelmet(token: string): Promise<void> {
    // 避難所（日比谷公園）のアンケートに答えるとヘルメットが手に入る
    const response = await submitSurvey(token, { answers: { ostomate: 'yes' } })
    expect(response.status).toBe(200)
  }

  it('★ 持っていない道具は保存されない（申告を信じない）', async () => {
    const { token } = await loginOk()

    const body = await json<MeResponse>(await equip(token, { head: 'helmet' }))
    expect(body.user.equipment.head).toBeNull()
  })

  it('アンケートで手に入れた道具は装備できる', async () => {
    const { token } = await loginOk()
    await acquireHelmet(token)

    const body = await json<MeResponse>(await equip(token, { head: 'helmet' }))
    expect(body.user.equipment.head).toBe('helmet')
  })

  it('★ 手に入れた道具は空きスロットへ自動で装備される', async () => {
    const { token } = await loginOk()
    const body = await json<SurveyAnswerResponse>(
      await submitSurvey(token, { answers: { ostomate: 'yes' } }),
    )

    expect(body.acquiredCards.map((card) => card.cardId)).toContain('tool:helmet')

    const me = await json<MeResponse>(await app.request('/v1/me', { headers: auth(token) }))
    expect(me.user.equipment.head).toBe('helmet')
  })

  it('★ すでに装備しているスロットは自動装備で置き換えない', async () => {
    const { token } = await loginOk()
    await acquireHelmet(token)

    // クイズ正解で防炎ずきん（同じ頭スロット）が手に入る
    const quiz = await fetchQuiz(token)
    await answer(token, quiz.quiz.quizId, 0)

    const me = await json<MeResponse>(await app.request('/v1/me', { headers: auth(token) }))
    expect(me.user.equipment.head).toBe('helmet')
  })

  it('スロット違いは弾く（頭の道具を手に持たせない）', async () => {
    const { token } = await loginOk()
    // ★ 持っていることが前提の検査である（持っていないと理由が別になる）
    await acquireHelmet(token)

    const body = await json<MeResponse>(await equip(token, { hand: 'helmet' }))
    expect(body.user.equipment.hand).toBeNull()
  })

  it('外せる（null を保存できる）', async () => {
    const { token } = await loginOk()
    await acquireHelmet(token)
    await equip(token, { head: 'helmet' })

    const body = await json<MeResponse>(await equip(token, { head: null }))
    expect(body.user.equipment.head).toBeNull()
  })

  it('★ おためしでは使えない', async () => {
    const guest = await json<GuestLoginResponse>(
      await app.request('/v1/auth/guest', { method: 'POST' }),
    )
    expect((await equip(guest.token, { head: 'helmet' })).status).toBe(403)
  })

  it('知らない道具の名前は 400', async () => {
    const { token } = await loginOk()
    const response = await app.request('/v1/me/equipment', {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ head: 'no-such-item', body: null, hand: null, back: null }),
    })
    expect(response.status).toBe(400)
  })
})

describe('行政還元ダッシュボード（FR-09）', () => {
  it('★ 認証なしで集計を返す（FR-09-5 の閲覧専用デモ）', async () => {
    const response = await app.request('/v1/dashboard/summary')
    expect(response.status).toBe(200)

    const body = await json<Record<string, unknown>>(response)
    expect(body['areaName']).toBe('千代田区・港区')
    expect(body['consensusThreshold']).toBe(2)
  })

  it('★ トリガーのパス前置が付いても通る（本番だけ 401 になるのを防ぐ）', async () => {
    const response = await app.request(`${TRIGGER_PATH}/v1/dashboard/summary`)
    expect(response.status).toBe(200)
  })

  it('★ 書き込む経路を生やしていない（公開しても壊せるものが無い）', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await app.request('/v1/dashboard/summary', { method })
      expect(response.status, method).not.toBe(200)
    }
  })

  it('誰も答えていなければ、集まり具合は 0 を返す（想定値を作らない）', async () => {
    const body = await json<{ collection: Record<string, number> }>(
      await app.request('/v1/dashboard/summary'),
    )

    expect(body.collection.answerCount).toBe(0)
    expect(body.collection.verifiedFieldCount).toBe(0)
    expect(body.collection.spotsWithAnswers).toBe(0)
  })

  it('属性の空白をカテゴリごとに返す（スライド3の実測）', async () => {
    const body = await json<{
      coverage: { spotCount: number; slotTotal: number; categories: { category: string }[] }
    }>(await app.request('/v1/dashboard/summary'))

    expect(body.coverage.spotCount).toBeGreaterThan(0)
    expect(body.coverage.slotTotal).toBeGreaterThan(0)
    expect(body.coverage.categories.length).toBe(4)
  })

  /*
   * ★ 集計の上限は地図の上限（MAX_SPOTS_PER_REQUEST=200）と別である。
   * 使い回すと実データ 370 件が 200 で切られ、「属性が空なのは何件か」が
   * 小さく出る。**主張が弱くなる方向に静かに壊れる**ので固定する。
   */
  it('★ 地図の上限を下げても、集計の件数は減らない', async () => {
    process.env['MAX_SPOTS_PER_REQUEST'] = '1'
    const body = await json<{ coverage: { spotCount: number }; truncated: boolean }>(
      await app.request('/v1/dashboard/summary'),
    )
    delete process.env['MAX_SPOTS_PER_REQUEST']

    expect(body.coverage.spotCount).toBeGreaterThan(1)
    expect(body.truncated).toBe(false)
  })

  it('★ 集計の上限で切られたら、切られたことを返す（黙って間違った数を出さない）', async () => {
    process.env['DASHBOARD_MAX_SPOTS'] = '2'
    const body = await json<{ truncated: boolean }>(await app.request('/v1/dashboard/summary'))
    delete process.env['DASHBOARD_MAX_SPOTS']

    expect(body.truncated).toBe(true)
  })
})

describe('CSV での書き出し（FR-09-4）', () => {
  it('★ 認証なしでダウンロードできる', async () => {
    const response = await app.request('/v1/dashboard/export/gaps.csv')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('attachment')
  })

  /*
   * ★ バイト列で確かめる。`Response.text()` は仕様どおり先頭の BOM を取り除くので、
   * 文字列で見ると**送っていても「無い」と出る**。ここで見たいのは Excel が
   * 受け取るバイトそのものである。
   */
  it('★ BOM 付きで返す（無いと Excel で施設名が文字化けする）', async () => {
    const buffer = await (await app.request('/v1/dashboard/export/gaps.csv')).arrayBuffer()
    const head = [...new Uint8Array(buffer).slice(0, 3)]

    expect(head).toEqual([0xef, 0xbb, 0xbf])
  })

  it('未取得項目の一覧は、いま実際に行が出る（現時点の主要な成果物）', async () => {
    const text = await (await app.request('/v1/dashboard/export/gaps.csv')).text()
    const lines = text.replace('\ufeff', '').split('\r\n').filter((line) => line !== '')

    expect(lines.length).toBeGreaterThan(1)
    expect(lines[0]).toContain('所在地_連結表記')
  })

  it('★ 検証済みは、誰も答えていなければ見出しだけを返す（0件を隠さない）', async () => {
    const text = await (await app.request('/v1/dashboard/export/verified.csv')).text()
    const lines = text.replace('\ufeff', '').split('\r\n').filter((line) => line !== '')

    expect(lines.length).toBe(1)
  })

  it('町丁目の CSV に危険度を示す列を作らない（FR-09-8）', async () => {
    const text = await (await app.request('/v1/dashboard/export/chome.csv')).text()
    const header = text.replace('\ufeff', '').split('\r\n')[0] ?? ''

    expect(header).toContain('人口')
    expect(header).not.toContain('危険')
    expect(header).not.toContain('率')
  })

  it('ファイル名に日付が入る（いつ時点かを手元に残す）', async () => {
    const response = await app.request('/v1/dashboard/export/chome.csv')
    expect(response.headers.get('content-disposition')).toMatch(/imanouchi_chome_\d{4}-\d{2}-\d{2}\.csv/)
  })
})

describe('ナレッジからの出題（FR-04-2・#75）', () => {
  /*
   * ★ 既定は「切」である。審査中に本番の出題が勝手に変わらないようにしてある。
   * ここを緩めると、環境変数を1つ入れ忘れただけで文言が入れ替わる。
   */
  it('★ 既定では固定データのまま出す', async () => {
    const { token } = await loginOk()
    const spots = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    const spot = spots.spots[0]!

    const body = await json<QuizResponse>(
      await app.request(`/v1/spots/${spot.spotId}/quiz`, { headers: auth(token) }),
    )

    expect(body.quiz.generatedBy).toBe('fixture')
    expect(body.quiz.quizId.startsWith('kb-')).toBe(false)
  })

  it('ENABLE_AI_QUIZ を入れるとナレッジから出す', async () => {
    process.env['ENABLE_AI_QUIZ'] = 'true'
    delete process.env['ORCAROUTER_API_KEY']

    const { token } = await loginOk()
    const spots = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    const spot = spots.spots[0]!

    const body = await json<QuizResponse>(
      await app.request(`/v1/spots/${spot.spotId}/quiz`, { headers: auth(token) }),
    )
    delete process.env['ENABLE_AI_QUIZ']

    expect(body.quiz.quizId.startsWith('kb-')).toBe(true)
    expect(body.quiz.options.length).toBeGreaterThanOrEqual(3)
    // 鍵が無いので言い回しは素のまま。**それでも出題は成立する**
    expect(body.quiz.generatedBy).toBe('fixture')
  })

  /*
   * ★ 出題と採点は別のリクエストで、間に Lambda のインスタンスが入れ替わりうる。
   * ナレッジから作り直せるので、キャッシュが無くても採点できる。
   */
  it('★ ナレッジの出題を採点できる（正解はサーバーが持つ）', async () => {
    process.env['ENABLE_AI_QUIZ'] = 'true'
    delete process.env['ORCAROUTER_API_KEY']

    const { token } = await loginOk()
    const spots = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    const spot = spots.spots[0]!

    const quiz = await json<QuizResponse>(
      await app.request(`/v1/spots/${spot.spotId}/quiz`, { headers: auth(token) }),
    )

    // ★ 全選択肢を試し、ちょうど1つだけが正解であることを確かめる
    const results: boolean[] = []
    for (let index = 0; index < quiz.quiz.options.length; index += 1) {
      const answer = await json<QuizAnswerResponse>(
        await app.request(`/v1/spots/${spot.spotId}/quiz/answer`, {
          method: 'POST',
          headers: auth(token),
          body: JSON.stringify({ quizId: quiz.quiz.quizId, choiceIndex: index }),
        }),
      )
      results.push(answer.correct)
      expect(answer.explanation).not.toBe('')
    }
    delete process.env['ENABLE_AI_QUIZ']

    expect(results.filter(Boolean).length).toBe(1)
  })

  it('★ 正解を画面へ渡さない（配信された JavaScript から読めない）', async () => {
    process.env['ENABLE_AI_QUIZ'] = 'true'
    const { token } = await loginOk()
    const spots = await json<SpotsResponse>(await app.request('/v1/spots', { headers: auth(token) }))
    const spot = spots.spots[0]!

    const raw = await (
      await app.request(`/v1/spots/${spot.spotId}/quiz`, { headers: auth(token) })
    ).text()
    delete process.env['ENABLE_AI_QUIZ']

    expect(raw).not.toContain('answerIndex')
    expect(raw).not.toContain('explanation')
  })
})
