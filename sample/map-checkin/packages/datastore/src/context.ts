import { CloudDataStoreClient } from '@uhuru/enebular-sdk'
import { DataStoreConfigError, DataStoreConnectionError } from './errors.js'
import type { DataStoreClient } from './types.js'

export const TABLE_ENV_KEYS = {
  spots: 'DS_TABLE_SPOTS',
  users: 'DS_TABLE_USERS',
  checkins: 'DS_TABLE_CHECKINS',
  userSpotState: 'DS_TABLE_USER_SPOT_STATE',
  exploredTiles: 'DS_TABLE_EXPLORED_TILES',
  userCards: 'DS_TABLE_USER_ITEMS',
} as const

export type TableName = keyof typeof TABLE_ENV_KEYS

/** .env.example の雛形の値は「未設定」と同じ扱いにする */
const PLACEHOLDER_VALUES = new Set(['', '00000000-0000-0000-0000-000000000000', 'change-me'])

export function isPlaceholder(value: string | undefined): boolean {
  return value === undefined || PLACEHOLDER_VALUES.has(value.trim())
}

let injected: DataStoreClient | undefined
let cached: DataStoreClient | undefined

/** テスト・ローカル開発でインメモリ実装へ差し替える */
export function setDataStoreClient(client: DataStoreClient | undefined): void {
  injected = client
  cached = undefined
}

export function getDataStoreClient(): DataStoreClient {
  if (injected) return injected
  if (cached) return cached
  // ★ 生成は初回アクセス時まで遅らせる。コンストラクタは ENEBULAR_DS_JWT /
  //   ENEBULAR_DS_PROXY_ARN が無いと throw するため、モジュール読み込み時に作ると
  //   /v1/health すら返らなくなる。
  try {
    cached = new CloudDataStoreClient() as DataStoreClient
  } catch (err) {
    // 生メッセージは持ち出さない（接続情報が含まれうる）
    throw new DataStoreConnectionError(err instanceof Error ? err.name : 'UnknownError')
  }
  return cached
}

export interface DataStoreContext {
  client: DataStoreClient
  /** 未設定ならリクエスト単位のエラー（起動は止めない） */
  tableId(name: TableName): string
}

export function createDataStoreContext(client: DataStoreClient = getDataStoreClient()): DataStoreContext {
  return {
    client,
    tableId(name) {
      const envKey = TABLE_ENV_KEYS[name]
      // 環境変数は呼び出しのたびに読む（モジュール読み込み時に固めない）
      const value = process.env[envKey]?.trim()
      if (value === undefined || isPlaceholder(value)) throw new DataStoreConfigError(envKey)
      return value
    },
  }
}
