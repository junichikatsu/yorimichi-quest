import type { ItemKey, OwnedItem, UserId } from '@map-checkin/shared'
import { isItemKey } from '@map-checkin/shared'
import type { DataStoreContext } from '../context.js'
import { USER_ITEMS_MAIN_KEY, USER_ITEMS_SUB_KEY, userKey } from '../keys.js'
import { runGet, runOp } from '../run.js'

/**
 * 所持アイテム（FR-07-8）。
 *
 * メインキーを `user#<userId>` にしているため、一覧はユーザー単位の query 1 回で取れる。
 * アイテム種別は10件程度しかないので、ページングは設けていない。
 */

function toOwnedItem(item: unknown): OwnedItem | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>
  const key = raw['itemKey']
  // 定義から消したアイテムが残っていても表示側で落ちないよう、ここで弾く
  if (typeof key !== 'string' || !isItemKey(key)) return undefined

  return {
    itemKey: key,
    count: typeof raw['count'] === 'number' ? raw['count'] : 1,
    firstAcquiredAt: typeof raw['firstAcquiredAt'] === 'string' ? raw['firstAcquiredAt'] : '',
  }
}

export async function listUserItems(
  ctx: DataStoreContext,
  userId: UserId,
): Promise<OwnedItem[]> {
  const tableId = ctx.tableId('userItems')
  const result = await runOp('query', () =>
    ctx.client.query({
      tableId,
      expression: `#${USER_ITEMS_MAIN_KEY} = :${USER_ITEMS_MAIN_KEY}`,
      values: { [USER_ITEMS_MAIN_KEY]: userKey(userId) },
      order: false,
    }),
  )

  const items = result.params?.Items ?? []
  return items
    .map(toOwnedItem)
    .filter((item): item is OwnedItem => item !== undefined)
}

export async function getUserItem(
  ctx: DataStoreContext,
  userId: UserId,
  itemKey: ItemKey,
): Promise<OwnedItem | undefined> {
  const tableId = ctx.tableId('userItems')
  const result = await runGet(() =>
    ctx.client.getItem({
      tableId,
      key: {
        [USER_ITEMS_MAIN_KEY]: userKey(userId),
        [USER_ITEMS_SUB_KEY]: itemKey,
      },
    }),
  )
  if (!result) return undefined
  return toOwnedItem(result.params?.Item)
}

export async function putUserItem(
  ctx: DataStoreContext,
  userId: UserId,
  owned: OwnedItem,
): Promise<void> {
  const tableId = ctx.tableId('userItems')
  await runOp('putItem', () =>
    ctx.client.putItem({
      tableId,
      item: {
        [USER_ITEMS_MAIN_KEY]: userKey(userId),
        [USER_ITEMS_SUB_KEY]: owned.itemKey,
        count: owned.count,
        firstAcquiredAt: owned.firstAcquiredAt,
      },
    }),
  )
}

export interface AcquireItemResult {
  /** 今回はじめて手に入れたか。2 個目以降は false */
  isNew: boolean
  owned: OwnedItem
}

/**
 * アイテムを 1 つ獲得する。
 *
 * 既に持っていれば個数だけ増やす。初回獲得かどうかを返すのは、
 * 呼び出し側が「はじめて手に入れた」演出とスロットの自動装備を出し分けるため。
 */
export async function acquireItem(
  ctx: DataStoreContext,
  userId: UserId,
  itemKey: ItemKey,
  nowIso: string,
): Promise<AcquireItemResult> {
  const existing = await getUserItem(ctx, userId, itemKey)
  const owned: OwnedItem = existing
    ? { ...existing, count: existing.count + 1 }
    : { itemKey, count: 1, firstAcquiredAt: nowIso }

  await putUserItem(ctx, userId, owned)
  return { isNew: existing === undefined, owned }
}
