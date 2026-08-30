import { getUser, type DataStoreContext } from '@imanouchi/datastore'
import {
  asSpotId,
  asUserId,
  avatarUpdateRequestSchema,
  checkinRequestSchema,
  consentRequestSchema,
  equipmentUpdateRequestSchema,
  explorationRequestSchema,
  FALLBACK_AVATAR,
  FALLBACK_EQUIPMENT,
  isSpotId,
  loginRequestSchema,
  purgeQuerySchema,
  seedQuerySchema,
  spotsQuerySchema,
  toUserView,
  type AdminConfigResponse,
  type CardsResponse,
  type CheckinResponse,
  type ClientConfigResponse,
  type ExplorationResponse,
  type ExplorationUpdateResponse,
  type GuestLoginResponse,
  type HealthResponse,
  type LoginResponse,
  MAX_EXPLORATION_POINTS,
  type MeResponse,
  MAX_PROGRESS_ENTRIES,
  type ProgressResponse,
  type PurgeResponse,
  quizAnswerRequestSchema,
  type QuizAnswerResponse,
  type QuizResponse,
  type SeedResponse,
  type SpotResponse,
  type SpotsResponse,
  surveyAnswerRequestSchema,
  type SurveyAnswerResponse,
  type SurveyResponse,
  type UserId,
} from '@imanouchi/shared'
import { Hono } from 'hono'
import { buildInfo, loadConfig, missingConfigKeys, type AppConfig } from '../config.js'
import { dataSourceCredits, datasetSpots } from '../data/spot-dataset.js'
import { AppError, badRequest, forbidden, notFound, unauthorized } from '../errors.js'
import { actorOf, ADMIN_KEY_HEADER, matchesAdminKey, userGate } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { ensureFakeSeeded, getDataStoreContext } from '../services/datastore-context.js'
import { LineVerifyError, verifyLineIdToken } from '../services/line.js'
import { DEFAULT_SEED_DELAY_MS, purgeSpots, seedSpots } from '../services/seed-service.js'
import { issueSession, newGuestId } from '../services/session.js'
import { buildCards, buildCatalog } from '../services/card-service.js'
import { getProgress, performCheckin } from '../services/checkin-service.js'
import { getExploration, recordExploration } from '../services/exploration-service.js'
import { answerQuiz, getQuiz } from '../services/quiz-service.js'
import {
  buildCsv,
  getDashboardData,
  type CsvKind,
  type DashboardData,
} from '../services/dashboard-service.js'
import { findSpot, listSpots } from '../services/spot-service.js'
import { getSurvey, submitSurvey, type SurveyPointRules } from '../services/survey-service.js'
import {
  ensureUser,
  setAvatar,
  setEquipment,
  setLocationConsent,
} from '../services/user-service.js'
import { assetVersion, sendAsset } from '../static.js'
import type { AppEnv } from '../types.js'

async function contextFor(): Promise<DataStoreContext> {
  const ctx = getDataStoreContext()
  await ensureFakeSeeded(ctx)
  return ctx
}

/**
 * アンケートの点数と閾値（FR-12-4・FR-06-2）。
 *
 * ★ 取得と送信の両方で使う。**片方だけ違う値を渡すと、画面に出した点数と実際の
 * 加点が食い違う。** 組み立てを1か所に置く。
 */
function surveyRules(config: AppConfig): SurveyPointRules {
  return {
    base: config.surveyBasePoints,
    fillBonus: config.surveyFillBonusPoints,
    consensus: config.surveyConsensusCount,
  }
}

/**
 * ダッシュボードの読み出し（FR-09）。
 *
 * ★ 集計と CSV の両方から呼ぶ。**上限と閾値の組み立てを1か所に置く。**
 * 別々に書くと、画面に出た件数と CSV の行数が食い違う。
 */
async function dashboardDataFor(
  ctx: DataStoreContext,
  config: AppConfig,
): Promise<DashboardData> {
  return getDashboardData(ctx, {
    areaId: config.area.areaId,
    areaName: config.area.name,
    limit: config.dashboardMaxSpots,
    threshold: config.surveyConsensusCount,
    chomeTopLimit: 8,
    now: new Date(),
  })
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
  /*
   * カードの種類と中身の一覧（開発用・FR-14）。
   *
   * ★ 中身はサーバー（/v1/dev/card-catalog）から引く。ページに書き写さないので、
   * 出題やアイテムを増やせば一覧も追随する。**カードを足したときの確認に使う。**
   * 本体から導線は張っていない（URL を直接開く）。
   *
   * ★ **本番では 404 にし、ZIP にも入れない。** 中身を返す API が開発用なので、
   * 本番に置いても何も出ない「壊れたページ」になる。ローカルは public/ を
   * ディスクから読むのでそのまま開ける。
   */
  routes.get('/card-catalog.html', (c) => {
    const config = loadConfig()
    if (!config.devLoginEnabled || !config.useFakeDataStore) throw notFound('見つかりません')
    return sendAsset(c, 'card-catalog.html')
  })

  /*
   * 行政還元ダッシュボードの画面（FR-09）。
   *
   * ★ **公開する。** 提出物と資料から「実際に開ける画面」として参照するため。
   * 中身は静的で、API も地図ライブラリも呼ばない（トークンも要らない）。
   *
   * ★ 認証は付けない。要件どおり閲覧専用のデモである（FR-09-5）。
   * 書き込む経路が無いので、公開しても壊せるものが無い。
   */
  routes.get('/dashboard.html', (c) => sendAsset(c, 'dashboard.html'))

  /**
   * カードの定義を全部返す（**開発用**）。
   *
   * ★ **中身（達成後にだけ見せる文）も返すため、本番に出してはいけない。**
   * 行動カードの中身はクイズの答えそのものである。開発用ログインと同じ条件
   * （インメモリ実装のとき）でしか通らないようにしてある。
   *
   * ★ 一覧のページがここから引く。HTML に書き写すと、出題やアイテムを増やした
   * ときに一覧だけ古いまま残る。
   */
  routes.get('/v1/dev/card-catalog', async (c) => {
    const config = loadConfig()
    if (!config.devLoginEnabled || !config.useFakeDataStore) throw notFound('見つかりません')

    const ctx = await contextFor()
    return c.json(await buildCatalog(ctx, config.area.areaId, 6))
  })

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
      emergencyDemoEnabled: config.emergencyDemoEnabled,
      guestModeEnabled: config.guestModeEnabled,
      // ★ 経路が生えているかどうかをそのまま配る（画面は入口を出すかだけを決める）
      devLoginEnabled: config.devLoginEnabled && config.useFakeDataStore,
      // ★ 判定はサーバー側。ここで配るのはボタンの出し方のためだけ（FR-03-1）
      checkinRadiusM: config.checkinRadiusM,
      checkinCooldownHours: config.checkinCooldownHours,
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
    const session = issueSession(
      { kind: 'line', userId: profile.userId },
      config.sessionSecret,
      config.sessionTtlHours,
    )

    const response: LoginResponse = {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: toUserView(profile),
      registered,
    }
    return c.json(response)
  })

  /**
   * 開発用ログイン（ローカルの動作確認専用）。
   *
   * ★ **本番には経路そのものが生えない。** 登録の条件に `useFakeDataStore` を
   * 入れてあり、本番は `USE_FAKE_DATASTORE` を設定しない運用なので、
   * 環境変数が紛れ込んでもこの `if` を通らない。
   *
   * ★ これが必要な理由：LIFF はエンドポイント URL に公開URLを登録した状態で
   * LINE アプリから開く必要があるため、**ローカルでは LINE ログインが完走しない。**
   * ログインが要る機能（チェックインの保存・カード）を手元で確かめる手段が無く、
   * 実装したものを実機へ上げるまで見られない状態になっていた。
   *
   * ★ 発行するのは LINE ログインと**同じ形のセッション**である。おためしのような
   * 読み取り専用ではないので、データストア（インメモリ）に書き込みが起きる。
   */
  routes.post('/v1/auth/dev', async (c) => {
    const config = loadConfig()

    /*
     * ★ 判定はリクエストのたびに行う（登録時に固めない）。
     *
     * 環境変数はモジュール読み込みの順序に左右される。ルートを作るかどうかで
     * 分けると、**設定してあるのに経路が無い**（あるいはその逆）という、
     * 一番切り分けにくい形の食い違いが起きる。設定の読み取りと同じ場所で決める。
     *
     * 経路が無いのと同じ 404 を返す。本番では `USE_FAKE_DATASTORE` を設定しない
     * 運用なので、常にここで止まる。
     */
    if (!config.devLoginEnabled || !config.useFakeDataStore) {
      throw notFound('見つかりません')
    }

    if (config.sessionSecret === '') {
      throw new AppError('CONFIG_ERROR', 500, 'サーバー設定が不足しています')
    }

    const ctx = await contextFor()
    const { profile, registered } = await ensureUser(
      ctx,
      {
        // LINE の userId と同じ形（U + 16進32桁）にする。取り違えを型で防いでいるため
        userId: asUserId('Udeadbeefdeadbeefdeadbeefdeadbeef'),
        displayName: '開発用ユーザー',
        pictureUrl: '',
      },
      new Date(),
    )

    const session = issueSession(
      { kind: 'line', userId: profile.userId },
      config.sessionSecret,
      config.sessionTtlHours,
    )

    const response: LoginResponse = {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: toUserView(profile),
      registered,
    }
    return c.json(response)
  })

  /**
   * おためし利用の開始（LINE ログインなし）。
   *
   * LINE を持っていない人・LINE の外で開いた人にも、地図とスポットまでは触れるようにする。
   *
   * ★ **データストアには一切触れない。** ユーザーを作らず、読み取り専用の
   * セッションだけを発行する。使えるパスは許可制で絞っている（middleware/auth.ts）。
   *
   * ★ 返すユーザーは**保存されていない**。画面にキャラクターと名前を出すための
   * 仮の値である。おためしの記録（歩いた跡・同意・見た目）は端末の中だけに置く。
   */
  routes.post('/v1/auth/guest', (c) => {
    const config = loadConfig()
    if (!config.guestModeEnabled) {
      throw forbidden('おためし利用は無効になっています')
    }
    if (config.sessionSecret === '') {
      throw new AppError('CONFIG_ERROR', 500, 'サーバー設定が不足しています')
    }

    const guestId = newGuestId()
    const session = issueSession(
      { kind: 'guest', guestId },
      config.sessionSecret,
      config.sessionTtlHours,
    )

    const response: GuestLoginResponse = {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        // ★ 画面に出すためだけの値。データストアには存在しない
        userId: guestId as unknown as UserId,
        displayName: 'おためし',
        pictureUrl: '',
        avatar: FALLBACK_AVATAR,
        equipment: FALLBACK_EQUIPMENT,
        totalPoints: 0,
        titles: [],
        // 同意は端末の中だけで持つ（サーバーへ送れない）
        locationConsentGiven: false,
        createdAt: new Date().toISOString(),
      },
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

  /**
   * 身につけている道具の更新（FR-07-8）。
   *
   * ★ **持っていない道具は保存しない。** サーバーが達成した道具カードと突き合わせて
   * 外す。クライアントの申告を信じると、手に入れていない道具を着た姿を保存できる。
   */
  routes.put('/v1/me/equipment', async (c) => {
    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = equipmentUpdateRequestSchema.parse(json)

    const ctx = await contextFor()
    const profile = await setEquipment(ctx, c.get('userId'), body, new Date())
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

  /* ---------------- チェックイン（FR-03） ---------------- */

  /**
   * チェックイン。
   *
   * ★ 受け取るのは申告位置だけである。距離・ポイント・再チェックイン制限は
   * すべてサーバーで決める（NFR-04）。「圏内である」という申告を信じたら、
   * 家から全スポットにチェックインできてしまう。
   */
  routes.post('/v1/spots/:spotId/checkin', async (c) => {
    const config = loadConfig()
    const spotIdRaw = c.req.param('spotId')
    if (!isSpotId(spotIdRaw)) throw badRequest('spotId の形式が不正です')

    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = checkinRequestSchema.parse(json)

    const ctx = await contextFor()
    const response: CheckinResponse = await performCheckin(ctx, {
      actor: actorOf(c),
      areaId: config.area.areaId,
      spotId: asSpotId(spotIdRaw),
      position: { lat: body.lat, lng: body.lng },
      now: Date.now(),
      radiusM: config.checkinRadiusM,
      cooldownHours: config.checkinCooldownHours,
    })

    return c.json(response)
  })

  /**
   * 進み具合（FR-03・FR-04）。
   *
   * ★ 起動時に1回だけ引く。**これが無いと、再読み込み後はチェックイン済みの
   * 場所でもボタンが押せる状態に見え、押してから 409 で断られる。**
   * おためし（ゲスト）は端末の記録を使うので、この経路は通らない（403）。
   */
  routes.get('/v1/progress', async (c) => {
    const config = loadConfig()
    const ctx = await contextFor()

    const response: ProgressResponse = await getProgress(ctx, {
      userId: c.get('userId'),
      cooldownHours: config.checkinCooldownHours,
      limit: MAX_PROGRESS_ENTRIES,
    })

    return c.json(response)
  })

  /**
   * カードコレクション（FR-14）。
   *
   * ★ おためし（ゲスト）は通らない（403）。達成状態をサーバーが持たないと、
   * **未達成カードの中身を隠す仕組み（FR-14-3）が成立しない。**
   */
  routes.get('/v1/cards', async (c) => {
    const config = loadConfig()
    const ctx = await contextFor()

    const response: CardsResponse = await buildCards(ctx, {
      userId: c.get('userId'),
      areaId: config.area.areaId,
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
      actor: actorOf(c),
      areaId: config.area.areaId,
      spotId: asSpotId(spotIdRaw),
    })

    return c.json(response)
  })

  /**
   * 回答（FR-04-3・FR-04-6）。
   *
   * ★ 採点はサーバーで行う。正解をクライアントへ配ると、配信された
   * JavaScript を読むだけで答えが分かる。
   */
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
      actor: actorOf(c),
      areaId: config.area.areaId,
      spotId: asSpotId(spotIdRaw),
      quizId: body.quizId,
      choiceIndex: body.choiceIndex,
      now: Date.now(),
      correctPoints: config.quizCorrectPoints,
    })

    return c.json(response)
  })

  /* ---------------- 現地確認アンケート（FR-12） ---------------- */

  /**
   * このスポットで答えてほしいこと（FR-12-3）。
   *
   * ★ 設問は**カテゴリごとのデータ辞書**（FR-12-1）から出し、行政データに記載が
   * あるかどうかで「埋める／確かめる」を切り替える（FR-12-2）。これまでの回答は
   * **件数だけ**返す（誰がどう答えたかは返さない。見せれば同調して答える動機になる）。
   */
  routes.get('/v1/spots/:spotId/survey', async (c) => {
    const config = loadConfig()
    const spotIdRaw = c.req.param('spotId')
    if (!isSpotId(spotIdRaw)) throw badRequest('spotId の形式が不正です')

    const ctx = await contextFor()
    const response: SurveyResponse = await getSurvey(ctx, {
      actor: actorOf(c),
      areaId: config.area.areaId,
      spotId: asSpotId(spotIdRaw),
      rules: surveyRules(config),
    })

    return c.json(response)
  })

  /**
   * 回答（FR-12・FR-06-2）。
   *
   * ★ ポイントはサーバーが決める（NFR-04）。倍率も点数もクライアントから
   * 受け取らない。**答えの中身では変わらない**（分からないのに断定する動機を
   * 作らないため）。
   *
   * ★ 1人1スポット1回。二重に送られると1人で検証済みの閾値を越えられる。
   */
  routes.post('/v1/spots/:spotId/survey', async (c) => {
    const config = loadConfig()
    const spotIdRaw = c.req.param('spotId')
    if (!isSpotId(spotIdRaw)) throw badRequest('spotId の形式が不正です')

    const json: unknown = await c.req.json().catch(() => {
      throw badRequest('リクエストボディが JSON ではありません')
    })
    const body = surveyAnswerRequestSchema.parse(json)

    const ctx = await contextFor()
    const response: SurveyAnswerResponse = await submitSurvey(ctx, {
      actor: actorOf(c),
      areaId: config.area.areaId,
      spotId: asSpotId(spotIdRaw),
      answers: body.answers,
      note: body.note ?? '',
      now: Date.now(),
      rules: surveyRules(config),
    })

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

  /* ---------------- 行政還元ダッシュボード（FR-09） ---------------- */

  /**
   * 集計（FR-09-1・FR-09-8・FR-12-5）。**認証なしの閲覧専用**（FR-09-5）。
   *
   * ★ 返すのは**実測だけ**である。まだ誰も答えていなければ 0 を返す。画面側で
   * 想定値に差し替えてはいけない。0 を隠すと「行政データにこれだけ穴がある」と
   * いう主張そのものが確かめられなくなる。
   */
  routes.get('/v1/dashboard/summary', async (c) => {
    const config = loadConfig()
    const ctx = await contextFor()
    const data = await dashboardDataFor(ctx, config)

    return c.json({ ...data.summary, truncated: data.truncated })
  })

  /**
   * CSV での書き出し（FR-09-4）。
   *
   * ★ 提出物 2-3・2-5 とスライド8で言い切った出力である。**実際に落とせること**が
   * 主張の裏づけになる。
   *
   * ★ `Content-Disposition` を付けてダウンロードにする。ブラウザで開くと BOM が
   * 見えるだけで、受け取った側が Excel へ持っていく手間が増える。
   */
  for (const [path, kind] of [
    ['/v1/dashboard/export/verified.csv', 'verified'],
    ['/v1/dashboard/export/gaps.csv', 'gaps'],
    ['/v1/dashboard/export/chome.csv', 'chome'],
  ] as const satisfies readonly (readonly [string, CsvKind])[]) {
    routes.get(path, async (c) => {
      const config = loadConfig()
      const ctx = await contextFor()
      const data = await dashboardDataFor(ctx, config)
      const csv = buildCsv(kind, data, config.surveyConsensusCount)

      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', `attachment; filename="${csv.filename}"`)
      return c.body(csv.body)
    })
  }

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
