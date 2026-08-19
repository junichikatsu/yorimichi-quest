import {
  getUser,
  listRecentCheckins,
  type DataStoreContext,
} from '@map-checkin/datastore'
import {
  asSpotId,
  avatarUpdateRequestSchema,
  checkinRequestSchema,
  equipmentUpdateRequestSchema,
  explorationRequestSchema,
  isSpotId,
  quizAnswerRequestSchema,
  spotsQuerySchema,
  DEFAULT_AVATAR,
  EMPTY_EQUIPMENT,
  MAX_EXPLORATION_POINTS,
  type AvatarUpdateResponse,
  type ClientConfigResponse,
  type EquipmentUpdateResponse,
  type ExplorationResponse,
  type ExplorationUpdateResponse,
  type HealthResponse,
  type ItemsResponse,
  type MeResponse,
  type QuizAnswerResponse,
  type QuizResponse,
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
import {
  answerQuiz,
  getQuiz,
  listItems,
  updateAvatar,
  updateEquipment,
} from '../services/game-service.js'
import { ensureFakeSeeded, getDataStoreContext } from '../services/datastore-context.js'
import { getExploration, recordExploration } from '../services/exploration-service.js'
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
        exploreTileSizeM: config.exploreTileSizeM,
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
      exploration: {
        tileSizeM: config.exploreTileSizeM,
        revealRadiusM: config.exploreRevealRadiusM,
        areaRadiusM: config.areaRadiusM,
        maxPointsPerRequest: MAX_EXPLORATION_POINTS,
        blockTiles: config.exploreBlockTiles,
        unlockRatio: config.exploreUnlockRatio,
        latitude: config.area.center.lat,
      },
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

  /* ---------------- 探索済みエリア（歩いたところ） ---------------- */

  routes.get('/v1/exploration', async (c) => {
    const config = loadConfig()
    const ctx = await contextFor()

    const response: ExplorationResponse = await getExploration(ctx, {
      userId: c.get('userId'),
      tileSizeM: config.exploreTileSizeM,
      latitude: config.area.center.lat,
      areaRadiusM: config.areaRadiusM,
      maxTiles: config.maxExploredTilesPerRequest,
      blockTiles: config.exploreBlockTiles,
      unlockRatio: config.exploreUnlockRatio,
    })
    return c.json(response)
  })

  routes.post('/v1/exploration', async (c) => {
    const config = loadConfig()
    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = explorationRequestSchema.parse(json)

    const ctx = await contextFor()
    const response: ExplorationUpdateResponse = await recordExploration(ctx, {
      userId: c.get('userId'),
      points: body.points,
      now: Date.now(),
      tileSizeM: config.exploreTileSizeM,
      latitude: config.area.center.lat,
      areaRadiusM: config.areaRadiusM,
      maxTiles: config.maxExploredTilesPerRequest,
      blockTiles: config.exploreBlockTiles,
      unlockRatio: config.exploreUnlockRatio,
    })
    return c.json(response)
  })

  /* ---------------- クイズ（FR-04） ---------------- */

  routes.get('/v1/spots/:spotId/quiz', async (c) => {
    const config = loadConfig()
    const spotIdRaw = c.req.param('spotId')
    if (!isSpotId(spotIdRaw)) throw badRequest('spotId の形式が不正です')

    const ctx = await contextFor()
    const response: QuizResponse = await getQuiz(ctx, {
      userId: c.get('userId'),
      areaId: config.area.areaId,
      spotId: asSpotId(spotIdRaw),
    })
    return c.json(response)
  })

  routes.post('/v1/spots/:spotId/quiz/answer', async (c) => {
    const config = loadConfig()
    const spotIdRaw = c.req.param('spotId')
    if (!isSpotId(spotIdRaw)) throw badRequest('spotId の形式が不正です')

    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = quizAnswerRequestSchema.parse(json)

    const ctx = await contextFor()
    const response: QuizAnswerResponse = await answerQuiz(ctx, {
      userId: c.get('userId'),
      areaId: config.area.areaId,
      spotId: asSpotId(spotIdRaw),
      quizId: body.quizId,
      choiceIndex: body.choiceIndex,
      now: Date.now(),
      correctPoints: config.quizCorrectPoints,
    })
    return c.json(response)
  })

  /* ---------------- アイテム・アバター（FR-07-8） ---------------- */

  routes.get('/v1/items', async (c) => {
    const ctx = await contextFor()
    const response: ItemsResponse = await listItems(ctx, c.get('userId'))
    return c.json(response)
  })

  routes.put('/v1/me/avatar', async (c) => {
    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = avatarUpdateRequestSchema.parse(json)

    const ctx = await contextFor()
    const avatar = await updateAvatar(ctx, c.get('userId'), body, Date.now())

    const response: AvatarUpdateResponse = { avatar }
    return c.json(response)
  })

  routes.put('/v1/me/equipment', async (c) => {
    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = equipmentUpdateRequestSchema.parse(json)

    const ctx = await contextFor()
    const equipment = await updateEquipment(ctx, c.get('userId'), body, Date.now())

    const response: EquipmentUpdateResponse = { equipment }
    return c.json(response)
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
        avatar: profile?.avatar ?? DEFAULT_AVATAR,
        equipment: profile?.equipment ?? EMPTY_EQUIPMENT,
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
