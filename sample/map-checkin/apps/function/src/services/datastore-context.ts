import {
  createDataStoreContext,
  createFakeDataStore,
  type DataStoreContext,
} from '@map-checkin/datastore'
import { loadConfig } from '../config.js'
import { datasetSpots } from '../data/spot-dataset.js'
import { seedSpots } from './seed-service.js'

/**
 * リクエストごとにデータストアのコンテキストを作る。
 *
 * USE_FAKE_DATASTORE=true のときはプロセス内のインメモリ実装を使う。
 * データストアはローカルで代替できない（実行環境が接続情報を注入する）ため、
 * ローカル開発と統合テストはこの経路で通しの導線を確認する。
 */

let fake: DataStoreContext | undefined
let fakeSeeded = false

export function resetFakeDataStore(): void {
  fake = undefined
  fakeSeeded = false
}

export function getDataStoreContext(): DataStoreContext {
  if (!loadConfig().useFakeDataStore) return createDataStoreContext()
  if (!fake) fake = createFakeDataStore().ctx
  return fake
}

/** fake 利用時のみ、初回アクセスでスポットを流し込む（SEED_DATASET で実データ／サンプルを選ぶ） */
export async function ensureFakeSeeded(ctx: DataStoreContext): Promise<void> {
  const config = loadConfig()
  if (!config.useFakeDataStore || fakeSeeded) return
  fakeSeeded = true
  await seedSpots(ctx, datasetSpots(config.area.areaId, new Date().toISOString()))
}
