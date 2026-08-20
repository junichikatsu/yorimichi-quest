import type { UserId } from '@map-checkin/shared'
import { parseCardId } from '@map-checkin/shared'
import type { DataStoreContext } from '../context.js'
import { USER_CARDS_MAIN_KEY, USER_CARDS_SUB_KEY, userKey } from '../keys.js'
import { runGet, runOp } from '../run.js'

/**
 * 達成したカード（FR-14）。
 *
 * メインキーを `user#<userId>` にしているため、一覧はユーザー単位の query 1 回で取れる。
 *
 * ★ **未達成のカードは保存しない。** 定義から導出して表示する。
 * 保存すると書き込み回数が「歩いた量」ではなく「カードの総数」に比例してしまう。
 *
 * ★ テーブルは所持アイテム用のものを流用している（サブキーの列名が `itemKey` のまま）。
 * 名前と中身がずれるが、enebular コンソールでのテーブル追加を避けるほうを選んだ。
 */

export interface AchievedCard {
  /** `<種類>:<キー>` 形式。例 'tool:helmet' / 'place:sample-hibiya-park' */
  cardId: string
  /** 同じカードを重ねて得た回数。道具の個数表示に使う */
  count: number
  achievedAt: string
}

function toAchievedCard(item: unknown): AchievedCard | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>
  const cardId = raw[USER_CARDS_SUB_KEY]
  // 形式の壊れたキーが残っていても表示側で落ちないよう、ここで弾く
  if (typeof cardId !== 'string' || parseCardId(cardId) === undefined) return undefined

  return {
    cardId,
    count: typeof raw['count'] === 'number' ? raw['count'] : 1,
    achievedAt: typeof raw['achievedAt'] === 'string' ? raw['achievedAt'] : '',
  }
}

export async function listAchievedCards(
  ctx: DataStoreContext,
  userId: UserId,
): Promise<AchievedCard[]> {
  const tableId = ctx.tableId('userCards')
  const result = await runOp('query', () =>
    ctx.client.query({
      tableId,
      expression: `#${USER_CARDS_MAIN_KEY} = :${USER_CARDS_MAIN_KEY}`,
      values: { [USER_CARDS_MAIN_KEY]: userKey(userId) },
      order: false,
    }),
  )

  const items = result.params?.Items ?? []
  return items
    .map(toAchievedCard)
    .filter((card): card is AchievedCard => card !== undefined)
}

export async function getAchievedCard(
  ctx: DataStoreContext,
  userId: UserId,
  cardId: string,
): Promise<AchievedCard | undefined> {
  const tableId = ctx.tableId('userCards')
  const result = await runGet(() =>
    ctx.client.getItem({
      tableId,
      key: {
        [USER_CARDS_MAIN_KEY]: userKey(userId),
        [USER_CARDS_SUB_KEY]: cardId,
      },
    }),
  )
  if (!result) return undefined
  return toAchievedCard(result.params?.Item)
}

export interface AchieveCardResult {
  /** 今回はじめて達成したか。2回目以降は false */
  isNew: boolean
  card: AchievedCard
}

/**
 * カードを達成状態にする。
 *
 * 既に達成済みなら回数だけ増やす。初回かどうかを返すのは、呼び出し側が
 * 「はじめて達成した」演出と道具の自動装備を出し分けるため。
 */
export async function achieveCard(
  ctx: DataStoreContext,
  userId: UserId,
  cardId: string,
  nowIso: string,
): Promise<AchieveCardResult> {
  const existing = await getAchievedCard(ctx, userId, cardId)
  const card: AchievedCard = existing
    ? { ...existing, count: existing.count + 1 }
    : { cardId, count: 1, achievedAt: nowIso }

  const tableId = ctx.tableId('userCards')
  await runOp('putItem', () =>
    ctx.client.putItem({
      tableId,
      item: {
        [USER_CARDS_MAIN_KEY]: userKey(userId),
        [USER_CARDS_SUB_KEY]: card.cardId,
        count: card.count,
        achievedAt: card.achievedAt,
      },
    }),
  )

  return { isNew: existing === undefined, card }
}
