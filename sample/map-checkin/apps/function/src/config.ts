import { TABLE_ENV_KEYS } from '@map-checkin/datastore'
import { asAreaId, type AreaId, type AreaSummary } from '@map-checkin/shared'

/**
 * 設定の読み取りと不足検出。
 *
 * 方針:
 * - 環境変数は呼び出しのたびに読む（モジュール読み込み時に固めない）
 * - 動作モードで必須項目が変わるのでコードで持つ（手作業のチェックリストにしない）
 * - **設定不足で起動を止めない**。全リクエストが 500 になると /v1/health すら返らず、
 *   「関数は動いているのに何も応答しない」という最も切り分けにくい状態になる
 * - 不足キー名はレスポンスに出さない。起動時ログにのみ出す。値はどこにも出さない
 */

const PLACEHOLDERS = new Set(['', '00000000-0000-0000-0000-000000000000', 'change-me'])

function readString(key: string): string {
  const value = process.env[key]?.trim()
  if (value === undefined || PLACEHOLDERS.has(value)) return ''
  return value
}

function readNumber(key: string, fallback: number): number {
  const raw = readString(key)
  if (raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = readString(key).toLowerCase()
  if (raw === '') return fallback
  return raw === 'true' || raw === '1' || raw === 'yes'
}

/**
 * 投入するスポットの出どころ。
 *
 * `opendata` は取込スクリプトが生成した実データ（FR-10）。`sample` は架空の固定データで、
 * テストと、実データを持ち込みたくない検証用に残している。
 */
export type SeedDataset = 'opendata' | 'sample'

export interface AppConfig {
  version: string
  mockMode: boolean
  useFakeDataStore: boolean
  logLevel: string
  seedDataset: SeedDataset
  area: AreaSummary
  checkinRadiusM: number
  checkinCooldownHours: number
  /** クイズ正解時のボーナス（FR-04-3）。暫定値、確定は Issue #7 */
  quizCorrectPoints: number
  exploreTileSizeM: number
  exploreRevealRadiusM: number
  /** エリア開放の区画サイズ（タイル数）と閾値。暫定値、確定は Issue #7 */
  exploreBlockTiles: number
  exploreUnlockRatio: number
  areaRadiusM: number
  maxSpotsPerRequest: number
  maxExploredTilesPerRequest: number
  rateLimitPerMinute: number
  mapboxToken: string
  adminKey: string
}

/**
 * 千代田区・港区を1つのパーティションにまとめる（#6 決着、要件定義書 6.2）。
 * 区ごとに分けると /spots が2クエリになり、探索率の分母も区ごとに割れる。
 */
const DEFAULT_AREA_ID = 'chiyoda-minato'

export function loadConfig(): AppConfig {
  const areaIdRaw = readString('AREA_ID') || DEFAULT_AREA_ID
  let areaId: AreaId
  try {
    areaId = asAreaId(areaIdRaw)
  } catch {
    areaId = asAreaId(DEFAULT_AREA_ID)
  }

  return {
    version: buildInfo().version,
    mockMode: readBoolean('MOCK_MODE', false),
    useFakeDataStore: readBoolean('USE_FAKE_DATASTORE', false),
    logLevel: readString('LOG_LEVEL') || 'INFO',
    seedDataset: readString('SEED_DATASET') === 'sample' ? 'sample' : 'opendata',
    area: {
      areaId,
      name: readString('AREA_NAME') || '千代田区・港区',
      center: {
        // 両区の境界（新橋〜虎ノ門〜霞ヶ関）付近。撮影ルート確定後に合わせる（FR-10-5）
        lat: readNumber('AREA_CENTER_LAT', 35.6690),
        lng: readNumber('AREA_CENTER_LNG', 139.7530),
      },
      zoom: readNumber('AREA_ZOOM', 14),
    },
    // 暫定値。確定は Issue #7「ゲームパラメータの確定」で行う
    checkinRadiusM: readNumber('CHECKIN_RADIUS_M', 100),
    checkinCooldownHours: readNumber('CHECKIN_COOLDOWN_HOURS', 24),
    quizCorrectPoints: readNumber('QUIZ_CORRECT_POINTS', 30),
    // 記録の粒度。小さくすると軌跡は滑らかになるが、書き込み回数が面積比で増える
    exploreTileSizeM: readNumber('EXPLORE_TILE_SIZE_M', 50),
    // 6 タイル＝300m 四方を 1 区画とし、その 25%（9 タイル）を歩けば全面が開く
    exploreBlockTiles: readNumber('EXPLORE_BLOCK_TILES', 6),
    exploreUnlockRatio: readNumber('EXPLORE_UNLOCK_RATIO', 0.25),
    // タイルより大きくしないと、隣り合うタイルの間に霧が残って軌跡が途切れて見える
    exploreRevealRadiusM: readNumber('EXPLORE_REVEAL_RADIUS_M', 40),
    // 探索率の分母。エリア中心からこの半径の円を「探索の対象範囲」とみなす
    areaRadiusM: readNumber('AREA_RADIUS_M', 1500),
    maxSpotsPerRequest: readNumber('MAX_SPOTS_PER_REQUEST', 200),
    maxExploredTilesPerRequest: readNumber('MAX_EXPLORED_TILES_PER_REQUEST', 2000),
    rateLimitPerMinute: readNumber('RATE_LIMIT_PER_MINUTE', 60),
    mapboxToken: readString('MAPBOX_ACCESS_TOKEN'),
    adminKey: readString('ADMIN_KEY'),
  }
}

export interface BuildInfo {
  version: string
  commit: string
  builtAt: string
}

export function buildInfo(): BuildInfo {
  if (typeof __BUILD_INFO__ !== 'undefined') return __BUILD_INFO__
  return { version: '0.1.0-dev', commit: 'dev', builtAt: 'dev' }
}

/**
 * 不足している環境変数のキー名。
 *
 * 動作モードによって必須項目が変わる:
 * - MOCK_MODE でなければ Mapbox のアクセストークンが必須
 * - fake データストアでなければテーブル ID が必須
 */
export function missingConfigKeys(config: AppConfig = loadConfig()): string[] {
  const missing: string[] = []

  if (!config.mockMode && config.mapboxToken === '') missing.push('MAPBOX_ACCESS_TOKEN')
  if (config.adminKey === '') missing.push('ADMIN_KEY')

  if (!config.useFakeDataStore) {
    for (const envKey of Object.values(TABLE_ENV_KEYS)) {
      if (readString(envKey) === '') missing.push(envKey)
    }
  }

  return missing
}

/** コールドスタート時に 1 回だけ呼ぶ。キー名がログに出るのはここだけ。 */
export function logConfigIssues(): void {
  const missing = missingConfigKeys()
  if (missing.length === 0) return
  // 値は出さない。キー名のみ。
  console.warn(`[config] missing environment variables: ${missing.join(', ')}`)
}
