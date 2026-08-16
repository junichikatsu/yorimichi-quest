import { TABLE_ENV_KEYS } from '@yorimichi-sample/datastore'
import { asAreaId, type AreaId, type AreaSummary } from '@yorimichi-sample/shared'

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

export interface AppConfig {
  version: string
  mockMode: boolean
  useFakeDataStore: boolean
  logLevel: string
  area: AreaSummary
  checkinRadiusM: number
  checkinCooldownHours: number
  maxSpotsPerRequest: number
  rateLimitPerMinute: number
  mapboxToken: string
  adminKey: string
}

const DEFAULT_AREA_ID = 'chiyoda'

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
    area: {
      areaId,
      name: readString('AREA_NAME') || '千代田区周辺（サンプルエリア）',
      center: {
        lat: readNumber('AREA_CENTER_LAT', 35.6785),
        lng: readNumber('AREA_CENTER_LNG', 139.7594),
      },
      zoom: readNumber('AREA_ZOOM', 14),
    },
    // 暫定値。確定は Issue #7「ゲームパラメータの確定」で行う
    checkinRadiusM: readNumber('CHECKIN_RADIUS_M', 100),
    checkinCooldownHours: readNumber('CHECKIN_COOLDOWN_HOURS', 24),
    maxSpotsPerRequest: readNumber('MAX_SPOTS_PER_REQUEST', 200),
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
