import { listSpotsByArea, putSpot, type DataStoreContext } from '@map-checkin/datastore'
import type { Spot } from '@map-checkin/shared'

export interface SeedResult {
  inserted: number
  skipped: number
}

/**
 * スポットマスタの初期投入（FR-10）。
 *
 * データストアはローカルから触れないため、デプロイ後に管理エンドポイント経由で実行する。
 * 既存分は上書きしない（チェックイン数を巻き戻さないため）。
 */
export async function seedSpots(ctx: DataStoreContext, spots: Spot[]): Promise<SeedResult> {
  if (spots.length === 0) return { inserted: 0, skipped: 0 }

  const areaId = spots[0]!.areaId
  // 1 件ずつ getItem すると件数分のアクセスを消費するので、一覧を 1 回取って差分を取る
  const existing = await listSpotsByArea(ctx, areaId, 500)
  const existingIds = new Set(existing.map((spot) => spot.spotId))

  let inserted = 0
  let skipped = 0

  for (const spot of spots) {
    if (existingIds.has(spot.spotId)) {
      skipped += 1
      continue
    }
    await putSpot(ctx, spot)
    inserted += 1
  }

  return { inserted, skipped }
}
