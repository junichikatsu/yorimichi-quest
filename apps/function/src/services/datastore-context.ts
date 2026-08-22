import {
  createDataStoreContext,
  createFakeDataStore,
  type DataStoreContext,
  type FakeDataStore,
} from '@imanouchi/datastore'
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

let fake: FakeDataStore | undefined
let fakeSeeded = false

export function resetFakeDataStore(): void {
  fake = undefined
  fakeSeeded = false
}

export function getDataStoreContext(): DataStoreContext {
  if (!loadConfig().useFakeDataStore) return createDataStoreContext()
  if (!fake) fake = createFakeDataStore()
  return fake.ctx
}

/**
 * インメモリ実装の中身。**fake を使っていないときは undefined。**
 *
 * ★ 「書かれていないこと」を確かめるために要る。おためし（ゲスト）が
 * データストアへ書かないことは、レスポンスを見ても分からない。
 */
export function fakeDataStore(): FakeDataStore | undefined {
  return fake
}

/** fake 利用時のみ、初回アクセスでスポットを流し込む */
export async function ensureFakeSeeded(ctx: DataStoreContext): Promise<void> {
  const config = loadConfig()
  if (!config.useFakeDataStore || fakeSeeded) return
  fakeSeeded = true
  const spots = datasetSpots(config.area.areaId, new Date().toISOString())
  // インメモリ実装なので上限も速度も関係ない。全件入れる
  await seedSpots(ctx, spots, { offset: 0, count: spots.length, delayMs: 0 })
}
