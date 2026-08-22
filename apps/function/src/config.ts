import { TABLE_ENV_KEYS } from '@imanouchi/datastore'
import { asAreaId, type AreaId, type AreaSummary } from '@imanouchi/shared'

/**
 * 設定の読み取りと不足検出。
 *
 * 方針:
 * - 環境変数は呼び出しのたびに読む（モジュール読み込み時に固めない）
 * - **設定不足で起動を止めない。** 全リクエストが 500 になると /v1/health すら返らず、
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
 * スポットの出どころ。
 *
 * `opendata` は取込スクリプトが生成した実データ（FR-10）。`sample` は動作確認用の
 * 少量の固定データ。**切り替え式にしているのは、架空データを実データとして
 * 見せないため**である。画面には出典が出るので、どちらで動いているかが常に分かる。
 */
export type SeedDataset = 'opendata' | 'sample'

export interface AppConfig {
  version: string
  useFakeDataStore: boolean
  seedDataset: SeedDataset
  area: AreaSummary
  /**
   * LIFF ID。フロントへ配る（FR-01-1）。
   *
   * ★ 形式は `<チャネルID>-<ランダム文字列>`。ミニアプリは内部チャネル
   * （開発用・審査用・本番用）ごとに**別の LIFF ID と別のチャネルID**を持つ。
   */
  liffId: string
  /**
   * チャネル ID。
   *
   * ★ IDトークン検証で **aud の照合**に使う。これが無いと、別のチャネル向けに
   * 発行されたトークンを受け入れてしまう。検証の要になる値である。
   *
   * ★ 内部チャネルごとに別の値である。LIFF ID の接頭辞と一致していなければ
   * 組み合わせが間違っている（下の checkConfigConsistency で検出する）。
   */
  lineChannelId: string
  /**
   * 自前トークンの署名鍵（FR-01）。
   *
   * IDトークンを毎回 LINE へ問い合わせると、リクエストごとに外部通信が入って
   * 遅くなり、LINE 側の障害でアプリ全体が止まる。ログイン時に1回だけ検証し、
   * 以降は自前の署名付きトークンをローカルで検証する。
   */
  sessionSecret: string
  sessionTtlHours: number
  mapboxToken: string
  adminKey: string
  maxSpotsPerRequest: number
  rateLimitPerMinute: number
  /**
   * デモ用の移動操作を許すか。
   *
   * ★ LINE アプリ内では画面側が必ず出さないが、**URL が漏れたときに
   * 止められる手段**を1つ持っておく。デプロイなしで切れる。
   */
  debugMoveEnabled: boolean
  /** 有事モードへの切替を出すか（FR-08-1）。デモ用 */
  emergencyDemoEnabled: boolean

  /* ---- 探索（FR-02-7） ---- */
  /** 記録の粒度（m 四方）。小さくすると軌跡は滑らかになるが書き込みが面積比で増える */
  exploreTileSizeM: number
  /** 地図上で霧を晴らす半径（m）。タイルより大きくしないと軌跡が途切れて見える */
  exploreRevealRadiusM: number
  /** 町丁目が開放される割合（0〜1）。暫定値、確定は Issue #7 */
  exploreUnlockRatio: number
  /** 開放に必要なタイル数の上限。町丁目の面積差が大きいため必要 */
  exploreUnlockMaxTiles: number
  /** 探索率の分母になる対象エリアの半径（m） */
  areaRadiusM: number
  maxExploredTilesPerRequest: number
}

/**
 * 千代田区・港区を1つのパーティションにまとめる（#6 決着、要件定義書 6.2）。
 * 区ごとに分けると /spots が2クエリになる。
 */
const DEFAULT_AREA_ID = 'chiyoda-minato'

export interface BuildInfo {
  version: string
  commit: string
  builtAt: string
}

/** ローカル起動（tsx）では define が入らないので、存在を確認してから読む */
export function buildInfo(): BuildInfo {
  if (typeof __BUILD_INFO__ !== 'undefined') return __BUILD_INFO__
  return { version: '0.1.0-dev', commit: 'dev', builtAt: 'dev' }
}

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
    useFakeDataStore: readBoolean('USE_FAKE_DATASTORE', false),
    seedDataset: readString('SEED_DATASET') === 'sample' ? 'sample' : 'opendata',
    area: {
      areaId,
      name: readString('AREA_NAME') || '千代田区・港区',
      center: {
        // 両区の境界（新橋〜虎ノ門〜霞ヶ関）付近。撮影ルート確定後に合わせる（FR-10-5）
        lat: readNumber('AREA_CENTER_LAT', 35.669),
        lng: readNumber('AREA_CENTER_LNG', 139.753),
      },
      zoom: readNumber('AREA_ZOOM', 14),
    },
    liffId: readString('LIFF_ID'),
    lineChannelId: readString('LINE_CHANNEL_ID'),
    sessionSecret: readString('SESSION_SECRET'),
    sessionTtlHours: readNumber('SESSION_TTL_HOURS', 12),
    mapboxToken: readString('MAPBOX_ACCESS_TOKEN'),
    adminKey: readString('ADMIN_KEY'),
    maxSpotsPerRequest: readNumber('MAX_SPOTS_PER_REQUEST', 200),
    rateLimitPerMinute: readNumber('RATE_LIMIT_PER_MINUTE', 60),
    debugMoveEnabled: readBoolean('ENABLE_DEBUG_MOVE', true),
    // デモの導線に要るため既定で出す。実利用者へ配るときは false にする
    emergencyDemoEnabled: readBoolean('ENABLE_EMERGENCY_DEMO', true),

    exploreTileSizeM: readNumber('EXPLORE_TILE_SIZE_M', 50),
    // タイルより大きくする。同じ大きさだと隣り合うタイルの間に霧が残って軌跡が途切れる
    exploreRevealRadiusM: readNumber('EXPLORE_REVEAL_RADIUS_M', 40),
    // 中央値の町丁目は 35 タイルなので、25% は 9 枚。従来の 300m 区画と同じ体感になる
    exploreUnlockRatio: readNumber('EXPLORE_UNLOCK_RATIO', 0.25),
    // 町丁目は最大 1433 タイルあり、割合だけだと広い区画が一生開かない
    exploreUnlockMaxTiles: readNumber('EXPLORE_UNLOCK_MAX_TILES', 12),
    areaRadiusM: readNumber('AREA_RADIUS_M', 1500),
    maxExploredTilesPerRequest: readNumber('MAX_EXPLORED_TILES_PER_REQUEST', 2000),
  }
}

/**
 * LIFF ID とチャネルIDの組み合わせの検査。
 *
 * ★ ミニアプリは内部チャネルが3つあり、**LIFF ID もチャネルIDも内部チャネル
 * ごとに別**である。取り違えると IDトークンの aud が一致せず 401 になるが、
 * 期限切れトークンと区別がつかず原因が分かりにくい。
 *
 * LIFF ID は `<チャネルID>-<ランダム文字列>` という形なので、**接頭辞を見れば
 * 組み合わせの誤りを起動時に見つけられる**。実機で 401 を踏む前に気づける。
 *
 * 返り値は問題の識別子。**レスポンスには出さない**（キー名も値も出さない）。
 */
export function checkConfigConsistency(config: AppConfig): string[] {
  const issues: string[] = []

  if (config.liffId !== '' && config.lineChannelId !== '') {
    if (!config.liffId.startsWith(`${config.lineChannelId}-`)) {
      // 開発用の LIFF ID に本番用のチャネルIDを組み合わせた、などの取り違え
      issues.push('LIFF_ID_CHANNEL_MISMATCH')
    }
  }

  return issues
}

/**
 * 不足している設定キー。
 *
 * ★ 動作モードで必須項目が変わるのでコードで持つ。手作業のチェックリストにしない。
 */
export function missingConfigKeys(config: AppConfig): string[] {
  const missing: string[] = []

  if (config.liffId === '') missing.push('LIFF_ID')
  if (config.lineChannelId === '') missing.push('LINE_CHANNEL_ID')
  if (config.sessionSecret === '') missing.push('SESSION_SECRET')
  if (config.mapboxToken === '') missing.push('MAPBOX_ACCESS_TOKEN')
  if (config.adminKey === '') missing.push('ADMIN_KEY')

  // インメモリ実装のときはテーブルIDを要求しない
  if (!config.useFakeDataStore) {
    for (const envKey of Object.values(TABLE_ENV_KEYS)) {
      if (readString(envKey) === '') missing.push(envKey)
    }
  }

  // 組み合わせの誤りも「設定が正しくない」として同じ列に並べる。
  // health では件数だけを返すので、ここに混ぜても外へは漏れない。
  missing.push(...checkConfigConsistency(config))

  return missing
}

/** コールドスタート時に 1 回だけ。**キー名はここにしか出さない** */
export function logConfigIssues(): void {
  const config = loadConfig()
  const missing = missingConfigKeys(config)
  if (missing.length > 0) {
    console.warn(`[config] missing: ${missing.join(', ')}`)
  }
}
