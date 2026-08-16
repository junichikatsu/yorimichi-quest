import {
  createDataStoreContext,
  createFakeDataStore,
  type DataStoreContext,
} from '@yorimichi-sample/datastore'
import { loadConfig } from '../config.js'
import { sampleSpots } from '../data/sample-spots.js'
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

/** fake 利用時のみ、初回アクセスでサンプルスポットを流し込む */
export async function ensureFakeSeeded(ctx: DataStoreContext): Promise<void> {
  if (!loadConfig().useFakeDataStore || fakeSeeded) return
  fakeSeeded = true
  await seedSpots(ctx, sampleSpots(new Date().toISOString()))
}
