import { getUser, type DataStoreContext } from '@imanouchi/datastore'
import {
  asSpotId,
  avatarUpdateRequestSchema,
  consentRequestSchema,
  explorationRequestSchema,
  isSpotId,
  loginRequestSchema,
  purgeQuerySchema,
  seedQuerySchema,
  spotsQuerySchema,
  toUserView,
  type AdminConfigResponse,
  type ClientConfigResponse,
  type ExplorationResponse,
  type ExplorationUpdateResponse,
  type HealthResponse,
  type LoginResponse,
  MAX_EXPLORATION_POINTS,
  type MeResponse,
  type PurgeResponse,
  type SeedResponse,
  type SpotResponse,
  type SpotsResponse,
} from '@imanouchi/shared'
import { Hono } from 'hono'
import { buildInfo, loadConfig, missingConfigKeys } from '../config.js'
import { dataSourceCredits, datasetSpots } from '../data/spot-dataset.js'
import { AppError, badRequest, forbidden, notFound, unauthorized } from '../errors.js'
import { ADMIN_KEY_HEADER, matchesAdminKey, userGate } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { ensureFakeSeeded, getDataStoreContext } from '../services/datastore-context.js'
import { LineVerifyError, verifyLineIdToken } from '../services/line.js'
import { DEFAULT_SEED_DELAY_MS, purgeSpots, seedSpots } from '../services/seed-service.js'
import { issueSession } from '../services/session.js'
import { getExploration, recordExploration } from '../services/exploration-service.js'
import { findSpot, listSpots } from '../services/spot-service.js'
import { ensureUser, setAvatar, setLocationConsent } from '../services/user-service.js'
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
  /*
   * 端末機能の確認ページ（開発用）。
   *
   * 音・振動・画面点灯維持が LINE の WebView で使えるかは、仕様を読んでも分からず
   * 実機で確かめる以外にない。本体から導線は張っていない（URL を直接開く）。
   */
  routes.get('/caps.html', (c) => sendAsset(c, 'caps.html'))

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
      debugMoveEnabled: config.debugMoveEnabled,
      exploration: {
        tileSizeM: config.exploreTileSizeM,
        revealRadiusM: config.exploreRevealRadiusM,
        areaRadiusM: config.areaRadiusM,
        maxPointsPerRequest: MAX_EXPLORATION_POINTS,
        unlockRatio: config.exploreUnlockRatio,
        unlockMaxTiles: config.exploreUnlockMaxTiles,
        latitude: config.area.center.lat,
      },
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

        /*
         * ★ 期限切れだけ別のコードで返す。
         *
         * IDトークンは LIFF が保持したまま期限切れになる。クライアントは
         * **取り直せば復帰できる**ので、それが分かるコードを返す。
         * ここを UNAUTHORIZED にまとめると、クライアントは「もう開けない」と
         * 判断して行き止まりになる（実際にそうなった）。
         */
        if (err.reason === 'token expired') {
          throw new AppError('TOKEN_EXPIRED', 401, 'ログインの有効期限が切れました')
        }

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

  /** キャラクターの見た目（FR-01-6） */
  routes.put('/v1/me/avatar', async (c) => {
    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    // ★ 範囲外の番号を弾く。通すと描画側で存在しない髪型を引いて落ちる
    const avatar = avatarUpdateRequestSchema.parse(json)

    const ctx = await contextFor()
    const profile = await setAvatar(ctx, c.get('userId'), avatar, new Date())
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
    const { spots, truncated } = await listSpots(ctx, {
      areaId: config.area.areaId,
      position,
      limit: Math.min(query.limit ?? config.maxSpotsPerRequest, config.maxSpotsPerRequest),
    })

    if (truncated) {
      // 運用時に気づけるようにログへも出す。カテゴリが丸ごと消える形で影響が出る
      console.warn(`[spots] truncated at ${spots.length} (MAX_SPOTS_PER_REQUEST)`)
    }

    const response: SpotsResponse = { area: config.area, spots, truncated }
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

  /* ---------------- 管理：設定の確認 ---------------- */

  /**
   * 不足している設定キーの**名前**を返す（運用用）。
   *
   * ★ `/v1/health` は認証不要なので件数しか出せない。「1件足りない」と分かっても
   * 何が足りないか分からず、実行環境のログを見に行くしかなかった。
   * 管理キーで守った上で名前だけを返す。**値は返さない。**
   */
  routes.get('/v1/admin/config', (c) => {
    const config = loadConfig()
    if (config.adminKey === '') {
      throw new AppError('CONFIG_ERROR', 500, 'ADMIN_KEY が設定されていません')
    }
    if (!matchesAdminKey(c.req.header(ADMIN_KEY_HEADER), config.adminKey)) {
      throw forbidden('管理キーが一致しません')
    }

    const missing = missingConfigKeys(config)
    const response: AdminConfigResponse = {
      configOk: missing.length === 0,
      missing,
      area: config.area,
      seedDataset: config.seedDataset,
    }
    return c.json(response)
  })

  /* ---------------- 探索（FR-02-7） ---------------- */

  routes.get('/v1/exploration', async (c) => {
    const config = loadConfig()
    const ctx = await contextFor()

    const response: ExplorationResponse = await getExploration(ctx, {
      userId: c.get('userId'),
      tileSizeM: config.exploreTileSizeM,
      latitude: config.area.center.lat,
      areaRadiusM: config.areaRadiusM,
      maxTiles: config.maxExploredTilesPerRequest,
      unlockRatio: config.exploreUnlockRatio,
      unlockMaxTiles: config.exploreUnlockMaxTiles,
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
      unlockRatio: config.exploreUnlockRatio,
      unlockMaxTiles: config.exploreUnlockMaxTiles,
    })
    return c.json(response)
  })

  /* ---------------- 管理 ---------------- */

  /**
   * スポットの投入（FR-10-2）。
   *
   * ★ 件数ぶん putItem が走るので、管理キーを必須にしている。
   * ★ 既定では 50 件ずつ。全件入れるには nextOffset をたどって繰り返す。
   *   一息に入れるとタイムアウトし、やり直しのたびにアクセス数（月次上限）を消費する。
   */
  routes.post('/v1/admin/seed', async (c) => {
    const config = loadConfig()
    if (config.adminKey === '') {
      throw new AppError('CONFIG_ERROR', 500, 'ADMIN_KEY が設定されていません')
    }
    if (!matchesAdminKey(c.req.header(ADMIN_KEY_HEADER), config.adminKey)) {
      throw forbidden('管理キーが一致しません')
    }

    const query = seedQuerySchema.parse({
      offset: c.req.query('offset'),
      count: c.req.query('count'),
      delayMs: c.req.query('delayMs'),
    })

    const ctx = await contextFor()
    const result = await seedSpots(ctx, datasetSpots(config.area.areaId, new Date().toISOString()), {
      offset: query.offset ?? 0,
      count: query.count ?? 50,
      // ★ 既定を 0 にしない。速く書くと弾かれると実測で分かっている
      delayMs: query.delayMs ?? DEFAULT_SEED_DELAY_MS,
    })

    if (result.stoppedAt !== undefined) {
      console.warn(`[seed] stopped at ${result.stoppedAt} after ${result.inserted} inserted`)
    }
    if (result.retries > 0) {
      // 間隔が足りていない。次の呼び出しで delayMs を上げる判断に使う
      console.warn(`[seed] throttled: ${result.retries} retries, delay now ${result.delayMs}ms`)
    }

    const response: SeedResponse = { area: config.area, ...result }
    return c.json(response)
  })

  /**
   * スポットの削除（やり直しのため）。
   *
   * ★ 総数が数えられないので、`hasMore` が false になるまで繰り返す。
   * ★ 入れ直しのたびに全消しするなら、`AREA_ID` を変えてパーティションを分ける方が
   *   アクセス数（制約 E4）を消費しない。こちらは後戻りの手段として置いている。
   */
  routes.post('/v1/admin/purge', async (c) => {
    const config = loadConfig()
    if (config.adminKey === '') {
      throw new AppError('CONFIG_ERROR', 500, 'ADMIN_KEY が設定されていません')
    }
    if (!matchesAdminKey(c.req.header(ADMIN_KEY_HEADER), config.adminKey)) {
      throw forbidden('管理キーが一致しません')
    }

    const query = purgeQuerySchema.parse({
      count: c.req.query('count'),
      delayMs: c.req.query('delayMs'),
    })

    const ctx = await contextFor()
    const result = await purgeSpots(ctx, config.area.areaId, {
      count: query.count ?? 50,
      delayMs: query.delayMs ?? DEFAULT_SEED_DELAY_MS,
    })

    if (result.retries > 0) {
      console.warn(`[purge] throttled: ${result.retries} retries, delay now ${result.delayMs}ms`)
    }

    const response: PurgeResponse = { area: config.area, ...result }
    return c.json(response)
  })

  return routes
}
