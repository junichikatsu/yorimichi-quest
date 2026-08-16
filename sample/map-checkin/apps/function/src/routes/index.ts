import {
  getUser,
  listRecentCheckins,
  type DataStoreContext,
} from '@map-checkin/datastore'
import {
  asSpotId,
  checkinRequestSchema,
  isSpotId,
  spotsQuerySchema,
  type ClientConfigResponse,
  type HealthResponse,
  type MeResponse,
  type SeedResponse,
  type SpotResponse,
  type SpotsResponse,
} from '@map-checkin/shared'
import { Hono } from 'hono'
import { buildInfo, loadConfig, missingConfigKeys } from '../config.js'
import { sampleSpots } from '../data/sample-spots.js'
import { AppError, badRequest, forbidden, notFound } from '../errors.js'
import { ADMIN_KEY_HEADER } from '../middleware/auth.js'
import { userGate } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { performCheckin } from '../services/checkin-service.js'
import { ensureFakeSeeded, getDataStoreContext } from '../services/datastore-context.js'
import { seedSpots } from '../services/seed-service.js'
import { findSpot, listSpots } from '../services/spot-service.js'
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
    // /myapp のままだと href="styles.css" が /styles.css（トリガーの外）に解決されて 404 になる
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
      mockMode: config.mockMode,
      configOk: missing.length === 0,
      // ★ 件数のみ。認証不要のエンドポイントなのでキー名は出さない
      configMissing: missing.length,
      limits: {
        checkinRadiusM: config.checkinRadiusM,
        checkinCooldownHours: config.checkinCooldownHours,
        maxSpotsPerRequest: config.maxSpotsPerRequest,
        rateLimitPerMinute: config.rateLimitPerMinute,
      },
    }
    return c.json(response)
  })

  routes.get('/v1/client-config', (c) => {
    const config = loadConfig()
    const response: ClientConfigResponse = {
      mapboxToken: config.mapboxToken,
      area: config.area,
      checkinRadiusM: config.checkinRadiusM,
      checkinCooldownHours: config.checkinCooldownHours,
      assetVersion: assetVersion(),
      mockMode: config.mockMode,
    }
    return c.json(response)
  })

  /* ---------------- スポット ---------------- */

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

    const lat = c.req.query('lat')
    const lng = c.req.query('lng')
    const query = spotsQuerySchema.parse({ lat, lng })
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

  /* ---------------- チェックイン ---------------- */

  routes.post('/v1/spots/:spotId/checkin', async (c) => {
    const config = loadConfig()
    const spotIdRaw = c.req.param('spotId')
    if (!isSpotId(spotIdRaw)) throw badRequest('spotId の形式が不正です')

    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = checkinRequestSchema.parse(json)

    const ctx = await contextFor()
    const result = await performCheckin(ctx, {
      userId: c.get('userId'),
      areaId: config.area.areaId,
      spotId: asSpotId(spotIdRaw),
      position: body,
      now: Date.now(),
      radiusM: config.checkinRadiusM,
      cooldownHours: config.checkinCooldownHours,
    })

    return c.json(result)
  })

  /* ---------------- マイページ ---------------- */

  routes.get('/v1/me', async (c) => {
    const userId = c.get('userId')
    const ctx = await contextFor()

    const profile = await getUser(ctx, userId)
    const recent = await listRecentCheckins(ctx, userId, 20)

    const response: MeResponse = {
      user: {
        userId,
        displayName: profile?.displayName ?? 'サンプルプレイヤー',
        totalPoints: profile?.totalPoints ?? 0,
        checkinCount: profile?.checkinCount ?? 0,
        createdAt: profile?.createdAt ?? '',
      },
      recentCheckins: recent.map((record) => ({
        checkinAt: new Date(record.checkinAt).toISOString(),
        spotId: record.spotId,
        spotName: record.spotName,
        pointsEarned: record.pointsEarned,
      })),
    }
    return c.json(response)
  })

  /* ---------------- 管理（初期データ投入） ---------------- */

  routes.post('/v1/admin/seed', async (c) => {
    const config = loadConfig()
    if (config.adminKey === '') {
      throw new AppError('CONFIG_ERROR', 500, 'ADMIN_KEY が設定されていません')
    }
    if (c.req.header(ADMIN_KEY_HEADER) !== config.adminKey) {
      throw forbidden('管理キーが一致しません')
    }

    const ctx = await contextFor()
    const result = await seedSpots(ctx, sampleSpots(new Date().toISOString()))

    const response: SeedResponse = { area: config.area, ...result }
    return c.json(response)
  })

  return routes
}
