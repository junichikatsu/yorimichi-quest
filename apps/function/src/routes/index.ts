import { getUser, type DataStoreContext } from '@imanouchi/datastore'
import {
  asSpotId,
  consentRequestSchema,
  isSpotId,
  loginRequestSchema,
  spotsQuerySchema,
  toUserView,
  type ClientConfigResponse,
  type HealthResponse,
  type LoginResponse,
  type MeResponse,
  type SpotResponse,
  type SpotsResponse,
} from '@imanouchi/shared'
import { Hono } from 'hono'
import { buildInfo, loadConfig, missingConfigKeys } from '../config.js'
import { dataSourceCredits, datasetSpots } from '../data/spot-dataset.js'
import { AppError, badRequest, forbidden, notFound, unauthorized } from '../errors.js'
import { ADMIN_KEY_HEADER, userGate } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { ensureFakeSeeded, getDataStoreContext } from '../services/datastore-context.js'
import { LineVerifyError, verifyLineIdToken } from '../services/line.js'
import { seedSpots } from '../services/seed-service.js'
import { issueSession } from '../services/session.js'
import { findSpot, listSpots } from '../services/spot-service.js'
import { ensureUser, setLocationConsent } from '../services/user-service.js'
import { assetVersion, sendAsset } from '../static.js'
import type { AppEnv } from '../types.js'

async function contextFor(): Promise<DataStoreContext> {
  const ctx = getDataStoreContext()
  await ensureFakeSeeded(ctx)
  return ctx
}

export function createRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>()

  /* ---------------- 静的ファイル（同一オリジン配信） ---------------- */

  routes.get('/', (c) => {
    const path = c.req.path
    // 末尾スラッシュが無いと href="styles.css" がトリガーの外に解決されて 404 になる
    if (!path.endsWith('/')) return c.redirect(`${path}/`, 302)
    return sendAsset(c, 'index.html')
  })
  routes.get('/index.html', (c) => sendAsset(c, 'index.html'))
  routes.get('/styles.css', (c) => sendAsset(c, 'styles.css'))
  routes.get('/app.js', (c) => sendAsset(c, 'app.js'))
  routes.get('/app.css', (c) => sendAsset(c, 'app.css'))

  /* ---------------- ミドルウェア（1 箇所でまとめて適用） ---------------- */

  routes.use('/v1/*', userGate())
  routes.use('/v1/*', rateLimit())

  /* ---------------- 認証不要 ---------------- */

  routes.get('/v1/health', (c) => {
    const config = loadConfig()
    const info = buildInfo()
    const missing = missingConfigKeys(config)

    const response: HealthResponse = {
      status: 'ok',
      version: info.version,
      commit: info.commit,
      builtAt: info.builtAt,
      configOk: missing.length === 0,
      // ★ 件数のみ。認証不要のエンドポイントなのでキー名は出さない
      configMissing: missing.length,
    }
    return c.json(response)
  })

  routes.get('/v1/client-config', (c) => {
    const config = loadConfig()
    const response: ClientConfigResponse = {
      liffId: config.liffId,
      mapboxToken: config.mapboxToken,
      area: config.area,
      dataSources: dataSourceCredits(),
      usesSampleData: config.seedDataset === 'sample',
      assetVersion: assetVersion(),
    }
    return c.json(response)
  })

  /**
   * ログイン（FR-01-1・FR-01-2）。
   *
   * ★ 受け取るのは IDトークンだけ。userId も表示名もトークンから取り出す。
   * クライアントの申告を信じたら、他人を名乗れてしまう。
   */
  routes.post('/v1/auth/login', async (c) => {
    const config = loadConfig()
    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = loginRequestSchema.parse(json)

    if (config.sessionSecret === '') {
      throw new AppError('CONFIG_ERROR', 500, 'サーバー設定が不足しています')
    }

    let identity
    try {
      identity = await verifyLineIdToken(body.idToken, config.lineChannelId)
    } catch (err) {
      if (err instanceof LineVerifyError) {
        /*
         * ★ 理由をサーバーログに出す。**レスポンスには出さない。**
         *
         * これが無いと、チャネルIDの設定ミス（audience mismatch）と
         * 期限切れトークンが同じ 401 に見え、設定を直せない。
         * reason は 'audience mismatch' のような固定文で、トークンの中身は含まない。
         */
        console.warn(`[auth] line verify failed: ${err.reason}`)

        // 401 は「トークンが不正」、502 は「LINE 側に届かない」。混ぜると切り分けできない
        if (err.status === 401) throw unauthorized('ログインに失敗しました')
        if (err.status === 500) throw new AppError('CONFIG_ERROR', 500, 'サーバー設定が不足しています')
        throw new AppError('UPSTREAM_ERROR', 502, 'LINE の認証サーバーに接続できませんでした')
      }
      throw err
    }

    const ctx = await contextFor()
    const { profile, registered } = await ensureUser(ctx, identity, new Date())
    const session = issueSession(profile.userId, config.sessionSecret, config.sessionTtlHours)

    const response: LoginResponse = {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: toUserView(profile),
      registered,
    }
    return c.json(response)
  })

  /* ---------------- ユーザー ---------------- */

  routes.get('/v1/me', async (c) => {
    const ctx = await contextFor()
    const profile = await getUser(ctx, c.get('userId'))
    // トークンは有効だがレコードが無い＝データストア側の不整合。作り直さず気づけるようにする
    if (!profile) throw notFound('ユーザーが見つかりません')

    const response: MeResponse = { user: toUserView(profile) }
    return c.json(response)
  })

  /** 位置情報の同意（FR-01-4） */
  routes.post('/v1/me/location-consent', async (c) => {
    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = consentRequestSchema.parse(json)

    const ctx = await contextFor()
    const profile = await setLocationConsent(ctx, c.get('userId'), body.granted, new Date())
    if (!profile) throw notFound('ユーザーが見つかりません')

    const response: MeResponse = { user: toUserView(profile) }
    return c.json(response)
  })

  /* ---------------- スポット（FR-02） ---------------- */

  routes.get('/v1/spots', async (c) => {
    const config = loadConfig()
    const query = spotsQuerySchema.parse({
      lat: c.req.query('lat'),
      lng: c.req.query('lng'),
      limit: c.req.query('limit'),
    })

    const position =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : undefined

    const ctx = await contextFor()
    const spots = await listSpots(ctx, {
      areaId: config.area.areaId,
      position,
      limit: Math.min(query.limit ?? config.maxSpotsPerRequest, config.maxSpotsPerRequest),
    })

    const response: SpotsResponse = { area: config.area, spots }
    return c.json(response)
  })

  routes.get('/v1/spots/:spotId', async (c) => {
    const config = loadConfig()
    const spotIdRaw = c.req.param('spotId')
    if (!isSpotId(spotIdRaw)) throw badRequest('spotId の形式が不正です')

    const query = spotsQuerySchema.parse({ lat: c.req.query('lat'), lng: c.req.query('lng') })
    const position =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng }
        : undefined

    const ctx = await contextFor()
    const spot = await findSpot(ctx, config.area.areaId, asSpotId(spotIdRaw), position)
    if (!spot) throw notFound('スポットが見つかりません')

    const response: SpotResponse = { spot }
    return c.json(response)
  })

  /* ---------------- 管理 ---------------- */

  /**
   * スポットの投入（FR-10-2）。
   *
   * ★ 件数ぶん putItem が走るので、管理キーを必須にしている。
   */
  routes.post('/v1/admin/seed', async (c) => {
    const config = loadConfig()
    if (config.adminKey === '') {
      throw new AppError('CONFIG_ERROR', 500, 'ADMIN_KEY が設定されていません')
    }
    if (c.req.header(ADMIN_KEY_HEADER) !== config.adminKey) {
      throw forbidden('管理キーが一致しません')
    }

    const ctx = await contextFor()
    const result = await seedSpots(ctx, datasetSpots(config.area.areaId, new Date().toISOString()))
    return c.json({ area: config.area, ...result })
  })

  return routes
}
