import type { UserId } from '@imanouchi/shared'
import type { DataStoreContext } from '../context.js'
import { EXPLORED_TILES_MAIN_KEY, EXPLORED_TILES_SUB_KEY, userKey } from '../keys.js'
import { runOp } from '../run.js'

/**
 * 探索済みタイル（歩いたところ）。
 *
 * 1 タイル = 1 アイテム。同じ場所を何度歩いてもキーが同じなので putItem が上書きになり、
 * 件数は歩いた**面積**にしか比例しない（歩いた**時間**には比例しない）。
 * このため件数を増やさない書き込みでも安全に putItem を投げられる。
 */
export interface ExploredTileRecord {
  /** グリッド座標（"row:col"）。サブキーそのもの */
  tileKey: string
  /** タイル中心の座標 */
  lat: number
  lng: number
  /** 最初に通過した時刻（epoch ms） */
  firstSeenAt: number
}

function toRecord(item: unknown): ExploredTileRecord | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>
  if (
    typeof raw[EXPLORED_TILES_SUB_KEY] !== 'string' ||
    typeof raw['lat'] !== 'number' ||
    typeof raw['lng'] !== 'number'
  ) {
    return undefined
  }

  return {
    tileKey: raw[EXPLORED_TILES_SUB_KEY],
    lat: raw['lat'],
    lng: raw['lng'],
    firstSeenAt: typeof raw['firstSeenAt'] === 'number' ? raw['firstSeenAt'] : 0,
  }
}

export async function putExploredTile(
  ctx: DataStoreContext,
  userId: UserId,
  record: ExploredTileRecord,
): Promise<void> {
  const tableId = ctx.tableId('exploredTiles')
  await runOp('putItem', () =>
    ctx.client.putItem({
      tableId,
      item: {
        [EXPLORED_TILES_MAIN_KEY]: userKey(userId),
        [EXPLORED_TILES_SUB_KEY]: record.tileKey,
        lat: record.lat,
        lng: record.lng,
        firstSeenAt: record.firstSeenAt,
      },
    }),
  )
}

/**
 * ユーザーの探索済みタイルを取得する。
 *
 * 地図の描画にも重複判定にも全件が要るので 1 回の query で読む。
 * 上限に達したかどうかは呼び出し側が件数で判断する（打ち切りを黙って隠さない）。
 */
export async function listExploredTiles(
  ctx: DataStoreContext,
  userId: UserId,
  limit: number,
): Promise<ExploredTileRecord[]> {
  const tableId = ctx.tableId('exploredTiles')
  const result = await runOp('query', () =>
    ctx.client.query({
      tableId,
      expression: `#${EXPLORED_TILES_MAIN_KEY} = :${EXPLORED_TILES_MAIN_KEY}`,
      values: { [EXPLORED_TILES_MAIN_KEY]: userKey(userId) },
      limit,
      order: false,
    }),
  )

  const items = result.params?.Items ?? []
  return items.map(toRecord).filter((record): record is ExploredTileRecord => record !== undefined)
}
