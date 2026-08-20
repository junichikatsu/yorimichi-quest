import type {
  AvatarUpdateResponse,
  CheckinResponse,
  ClientConfigResponse,
  EquipmentUpdateResponse,
  ErrorResponse,
  ExplorationResponse,
  ExplorationUpdateResponse,
  HealthResponse,
  CardsResponse,
  ItemsResponse,
  MeResponse,
  QuizAnswerResponse,
  QuizResponse,
  SpotsResponse,
} from '@map-checkin/shared'
import { tileOf } from '@map-checkin/core'
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

  it('探索エリアはヘッダが無ければ 401', async () => {
    const response = await app.request('/v1/exploration')
    expect(response.status).toBe(401)
  })
})

describe('GET /v1/client-config', () => {
  it('探索グリッドの寸法を返す（FE は環境変数を持たない）', async () => {
    const body = await json<ClientConfigResponse>(await app.request('/v1/client-config'))

    expect(body.exploration).toEqual({
      tileSizeM: 50,
      revealRadiusM: 40,
      areaRadiusM: 1500,
      maxPointsPerRequest: 200,
      // 開放の判定は FE でも先読みするため、閾値と緯度も渡す
      blockTiles: 6,
      unlockRatio: 0.25,
      latitude: 35.6785,
    })
  })
})

describe('探索済みエリア（歩いたところ）', () => {
  const HIBIYA = { lat: 35.6739, lng: 139.7568 }

  async function record(points: { lat: number; lng: number }[], userId = USER_ID) {
    return app.request('/v1/exploration', {
      method: 'POST',
      headers: headers(userId),
      body: JSON.stringify({ points }),
    })
  }

  it('初期状態は空', async () => {
    const body = await json<ExplorationResponse>(
      await app.request('/v1/exploration', { headers: headers() }),
    )

    expect(body.tiles).toHaveLength(0)
    expect(body.summary).toEqual({
      tileCount: 0,
      exploredAreaM2: 0,
      coveragePercent: 0,
      truncated: false,
    })
  })

  it('座標を送るとタイルが塗られ、次の GET にも残る', async () => {
    const response = await record([HIBIYA])
    expect(response.status).toBe(200)

    const posted = await json<ExplorationUpdateResponse>(response)
    expect(posted.newTileCount).toBe(1)
    expect(posted.tiles).toHaveLength(1)
    // 50m 四方のタイルは北緯 35 度で約 2,031m²（横幅が cos(緯度) 分だけ縮む）
    expect(posted.summary.exploredAreaM2).toBe(2031)

    const fetched = await json<ExplorationResponse>(
      await app.request('/v1/exploration', { headers: headers() }),
    )
    expect(fetched.tiles.map((tile) => tile.tileKey)).toEqual(
      posted.tiles.map((tile) => tile.tileKey),
    )
  })

  it('同じタイル内の座標をまとめて送っても 1 マスしか増えない', async () => {
    // 境界をまたがないよう、タイル中心から数 m ずらした 3 点を作る
    const center = tileOf(HIBIYA, 50).center
    const body = await json<ExplorationUpdateResponse>(
      await record([
        center,
        { lat: center.lat + 0.00002, lng: center.lng },
        { lat: center.lat, lng: center.lng + 0.00002 },
      ]),
    )

    expect(body.newTileCount).toBe(1)
    expect(body.summary.tileCount).toBe(1)
  })

  it('同じ場所を送り直しても新規タイルは増えない（書き込みが積み上がらない）', async () => {
    await record([HIBIYA])
    const again = await json<ExplorationUpdateResponse>(await record([HIBIYA]))

    expect(again.newTileCount).toBe(0)
    expect(again.summary.tileCount).toBe(1)
  })

  it('歩いた軌跡はタイル数ぶん塗られる', async () => {
    // 緯度 +0.0009 度 ≒ 100m。50m タイルなので 2〜3 マス進む
    const path = [0, 0.00045, 0.0009].map((offset) => ({ ...HIBIYA, lat: HIBIYA.lat + offset }))
    const body = await json<ExplorationUpdateResponse>(await record(path))

    expect(body.summary.tileCount).toBeGreaterThanOrEqual(2)
    expect(body.summary.coveragePercent).toBeGreaterThan(0)
  })

  it('探索エリアは他ユーザーに混ざらない', async () => {
    await record([HIBIYA])

    const other = await json<ExplorationResponse>(
      await app.request('/v1/exploration', { headers: headers(OTHER_USER_ID) }),
    )
    expect(other.tiles).toHaveLength(0)
  })

  it('座標が空なら 400', async () => {
    expect((await record([])).status).toBe(400)
  })

  it('上限を超える件数は 400（黙って切り捨てない）', async () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      lat: HIBIYA.lat + i * 0.0001,
      lng: HIBIYA.lng,
    }))
    expect((await record(tooMany)).status).toBe(400)
  })

  it('緯度経度が範囲外なら 400', async () => {
    expect((await record([{ lat: 999, lng: 139.7 }])).status).toBe(400)
  })
})

describe('エリア開放（一定割合を歩くと区画全体が開く）', () => {
  /**
   * 既定は 6×6 タイル＝36 枚の区画で、25%（9 枚）歩けば全面が開く。
   * タイルは 50m 四方なので、東西へ 6 枚進むと隣の区画に入る。行方向へ折り返して埋める。
   */
  function pointsInBlock(count: number): { lat: number; lng: number }[] {
    const step = 50 / 111_320
    const base = { lat: 35.6785, lng: 139.7594 }
    return Array.from({ length: count }, (_, i) => ({
      lat: base.lat + Math.floor(i / 6) * step,
      lng: base.lng + (i % 6) * step,
    }))
  }

  async function record(points: { lat: number; lng: number }[]): Promise<ExplorationUpdateResponse> {
    return json<ExplorationUpdateResponse>(
      await app.request('/v1/exploration', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ points }),
      }),
    )
  }

  it('閾値に届かないうちは区画が開かない', async () => {
    const result = await record(pointsInBlock(8))

    expect(result.unlockedAreas).toHaveLength(0)
    expect(result.summary.tileCount).toBe(8)
  })

  it('25%（9枚）歩くと区画全体が開き、探索率も全面ぶんになる', async () => {
    const result = await record(pointsInBlock(9))

    expect(result.unlockedAreas).toHaveLength(1)
    // 歩いたのは 9 枚でも、開放されたので 36 枚ぶんとして数える
    expect(result.summary.tileCount).toBe(36)
  })

  it('開放後に GET で取り直しても同じ結果になる（FE と BE で判定がずれない）', async () => {
    await record(pointsInBlock(9))

    const fetched = await json<ExplorationResponse>(
      await app.request('/v1/exploration', { headers: headers() }),
    )
    expect(fetched.unlockedAreas).toHaveLength(1)
    expect(fetched.summary.tileCount).toBe(36)
    // 保存しているのは実際に歩いた分だけ。開放は都度計算する
    expect(fetched.tiles).toHaveLength(9)
  })

  it('開放は他ユーザーに影響しない', async () => {
    await record(pointsInBlock(9))

    const other = await json<ExplorationResponse>(
      await app.request('/v1/exploration', { headers: headers(OTHER_USER_ID) }),
    )
    expect(other.unlockedAreas).toHaveLength(0)
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

describe('クイズ（FR-04）', () => {
  const spotId = 'sample-hibiya-park'
  const position = { lat: 35.6739, lng: 139.7568 }

  async function getQuiz(): Promise<QuizResponse> {
    return json<QuizResponse>(
      await app.request(`/v1/spots/${spotId}/quiz`, { headers: headers() }),
    )
  }

  async function answer(quizId: string, choiceIndex: number): Promise<Response> {
    return app.request(`/v1/spots/${spotId}/quiz/answer`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ quizId, choiceIndex }),
    })
  }

  it('行動を問う設問が優先される（G-8：モノより先に行動）', async () => {
    const body = await getQuiz()

    // 避難所カテゴリには行動の設問（shelter-action-1）がある。
    // 備蓄や設備の設問しか出ないと「モノをそろえれば備えたことになる」逆の学習になる
    expect(body.quiz.quizId).toBe('shelter-action-1')
    expect(body.quiz.question).toContain('まず')
  })

  it('出題に正解は含まれない（配信物から答えが読めないこと）', async () => {
    const body = await getQuiz()
    expect(body.quiz.options.length).toBeGreaterThan(1)
    expect(body.alreadyCleared).toBe(false)
    expect(JSON.stringify(body)).not.toContain('answerIndex')
  })

  it('同じスポットでは毎回同じ問題が出る', async () => {
    const first = await getQuiz()
    const second = await getQuiz()
    expect(second.quiz.quizId).toBe(first.quiz.quizId)
  })

  it('不正解でもポイントは減らず、解説と再挑戦が返る（FR-04-6）', async () => {
    const quiz = await getQuiz()
    const wrongIndex = quiz.quiz.options.length - 1

    const result = await json<QuizAnswerResponse>(await answer(quiz.quiz.quizId, wrongIndex))
    expect(result.correct).toBe(false)
    expect(result.pointsEarned).toBe(0)
    expect(result.totalPoints).toBe(0)
    expect(result.explanation.length).toBeGreaterThan(0)
    expect(result.canRetry).toBe(true)
    expect(result.acquiredItem).toBeUndefined()
  })

  it('正解でポイントとアイテムを得る。2 回目は加点されない', async () => {
    const quiz = await getQuiz()

    const first = await json<QuizAnswerResponse>(await answer(quiz.quiz.quizId, 0))
    expect(first.correct).toBe(true)
    expect(first.pointsEarned).toBe(30)
    expect(first.acquiredItem).toBe('zukin')
    expect(first.canRetry).toBe(false)

    const second = await json<QuizAnswerResponse>(await answer(quiz.quiz.quizId, 0))
    expect(second.correct).toBe(true)
    expect(second.pointsEarned).toBe(0)
    expect(second.acquiredItem).toBeUndefined()
    expect(second.totalPoints).toBe(30)
  })

  it('別カテゴリのクイズIDを送っても報酬は得られない', async () => {
    const response = await answer('water-supply-1', 0)
    expect(response.status).toBe(400)
  })

  it('存在しないクイズIDは 404', async () => {
    const response = await answer('no-such-quiz', 0)
    expect(response.status).toBe(404)
  })

  it('チェックインでもカテゴリに応じたアイテムを得る（FR-07-8）', async () => {
    const checkin = await json<CheckinResponse>(
      await app.request(`/v1/spots/${spotId}/checkin`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(position),
      }),
    )
    expect(checkin.acquiredItem).toBe('helmet')
  })
})

describe('アイテムとアバター（FR-07-8）', () => {
  it('初期状態は所持ゼロ、カタログは全件返る', async () => {
    const body = await json<ItemsResponse>(await app.request('/v1/items', { headers: headers() }))
    expect(body.owned).toHaveLength(0)
    expect(body.catalog).toHaveLength(10)
    expect(body.equipment).toEqual({ head: null, body: null, hand: null, back: null })
  })

  it('獲得したアイテムは空きスロットへ自動装備される', async () => {
    await app.request('/v1/spots/sample-hibiya-park/checkin', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ lat: 35.6739, lng: 139.7568 }),
    })

    const body = await json<ItemsResponse>(await app.request('/v1/items', { headers: headers() }))
    expect(body.owned.map((item) => item.itemKey)).toEqual(['helmet'])
    expect(body.equipment.head).toBe('helmet')
  })

  it('持っていないアイテムは装備できない（見た目と所持がずれない）', async () => {
    const response = await app.request('/v1/me/equipment', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ head: 'helmet', body: null, hand: null, back: null }),
    })

    const body = await json<EquipmentUpdateResponse>(response)
    expect(body.equipment.head).toBeNull()
  })

  it('アバターを保存するとマイページに反映される', async () => {
    const avatar = { hair: 2, cloth: 5, hairColor: 3, clothColor: 4, skin: 1, name: 'ヨリコ' }
    const saved = await json<AvatarUpdateResponse>(
      await app.request('/v1/me/avatar', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(avatar),
      }),
    )
    expect(saved.avatar).toEqual(avatar)

    const me = await json<MeResponse>(await app.request('/v1/me', { headers: headers() }))
    expect(me.user.avatar.name).toBe('ヨリコ')
    expect(me.user.avatar.hair).toBe(2)
  })

  it('範囲外のアバター値は 400', async () => {
    const response = await app.request('/v1/me/avatar', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ hair: 99, cloth: 0, hairColor: 0, clothColor: 0, skin: 0, name: 'x' }),
    })
    expect(response.status).toBe(400)
  })

  it('アイテムは他ユーザーに混ざらない', async () => {
    await app.request('/v1/spots/sample-hibiya-park/checkin', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ lat: 35.6739, lng: 139.7568 }),
    })

    const other = await json<ItemsResponse>(
      await app.request('/v1/items', { headers: headers(OTHER_USER_ID) }),
    )
    expect(other.owned).toHaveLength(0)
  })
})

describe('カードコレクション（FR-14）', () => {
  const spotId = 'sample-hibiya-park'
  const position = { lat: 35.6739, lng: 139.7568 }

  async function cards(userId = USER_ID): Promise<CardsResponse> {
    return json<CardsResponse>(await app.request('/v1/cards', { headers: headers(userId) }))
  }

  async function checkin(): Promise<void> {
    await app.request(`/v1/spots/${spotId}/checkin`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(position),
    })
  }

  async function answerQuizCorrectly(): Promise<string> {
    const quiz = await json<QuizResponse>(
      await app.request(`/v1/spots/${spotId}/quiz`, { headers: headers() }),
    )
    await app.request(`/v1/spots/${spotId}/quiz/answer`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ quizId: quiz.quiz.quizId, choiceIndex: 0 }),
    })
    return quiz.quiz.quizId
  }

  it('4種のカードが未達成の枠として並ぶ', async () => {
    const body = await cards()

    expect(body.summary.achieved).toBe(0)
    expect(body.summary.total).toBeGreaterThan(20)
    for (const kind of ['action', 'tool', 'place', 'mission'] as const) {
      expect(body.summary.byKind[kind].total).toBeGreaterThan(0)
      expect(body.summary.byKind[kind].achieved).toBe(0)
    }
  })

  it('未達成カードの中身はレスポンスに含まれない（表示側で隠すのではなく送らない）', async () => {
    const body = await cards()

    expect(body.cards.every((card) => card.body === undefined)).toBe(true)
    // 達成条件は未達成でも見せる
    expect(body.cards.every((card) => card.condition.length > 0)).toBe(true)
  })

  it('行動カードの見出しは「場面」で、行動そのものは達成まで見えない', async () => {
    const body = await cards()
    const action = body.cards.find((card) => card.cardId === 'action:shelter-action-1')

    expect(action?.title).toBe('大きな地震の直後')
    // 答えになる行動が未達成で漏れていないこと
    expect(JSON.stringify(body)).not.toContain('頭を守って身を低くし')
  })

  it('チェックインで場所カードと道具カードが達成される', async () => {
    await checkin()
    const body = await cards()

    const place = body.cards.find((card) => card.cardId === `place:${spotId}`)
    expect(place?.achieved).toBe(true)
    expect(place?.body).toContain('避難所')
    expect(body.summary.byKind.tool.achieved).toBe(1)
  })

  it('クイズ正解で行動カードが達成され、中身が届く', async () => {
    const quizId = await answerQuizCorrectly()
    const body = await cards()

    const action = body.cards.find((card) => card.cardId === `action:${quizId}`)
    expect(action?.achieved).toBe(true)
    expect(action?.body).toContain('頭を守って')
  })

  it('ミッションは他のカードの枚数で達成される（専用カウンタを持たない）', async () => {
    await answerQuizCorrectly()
    const body = await cards()

    // 行動カード1枚で「まず身を守る」が達成される
    const mission = body.cards.find((card) => card.cardId === 'mission:first-action')
    expect(mission?.achieved).toBe(true)
    expect(mission?.body).toContain('生き延びた')

    // 避難所3枚のミッションはまだ未達成
    expect(body.cards.find((card) => card.cardId === 'mission:shelter-3')?.achieved).toBe(false)
  })

  it('カードは他ユーザーに混ざらない', async () => {
    await checkin()
    const other = await cards(OTHER_USER_ID)

    expect(other.summary.achieved).toBe(0)
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
    'DS_TABLE_EXPLORED_TILES',
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
