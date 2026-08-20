import { putSpot, type DataStoreContext } from '@imanouchi/datastore'
import type { Spot } from '@imanouchi/shared'

export interface SeedResult {
  inserted: number
}

/**
 * スポットの投入（FR-10-2）。
 *
 * ★ 1件ずつ putItem する。データストアに一括投入が無いため、件数ぶん
 * 書き込みが発生する。370件で数百回になるので、**リクエスト経由では
 * 管理キー必須の経路だけに限る。**
 */
export async function seedSpots(ctx: DataStoreContext, spots: Spot[]): Promise<SeedResult> {
  for (const spot of spots) {
    await putSpot(ctx, spot)
  }
  return { inserted: spots.length }
}
