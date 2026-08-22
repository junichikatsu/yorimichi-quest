import type { UserId } from '@imanouchi/shared'
import type { DataStoreContext } from '../context.js'
import { USER_CARDS_MAIN_KEY, USER_CARDS_SUB_KEY, userKey } from '../keys.js'
import { runGet, runOp } from '../run.js'

/**
 * 達成したカード（FR-14）。
 *
 * ★ **達成したものだけを保存する。** 未達成は定義から導出して表示する。
 * 保存すると書き込み回数が「歩いた量」ではなく「カードの総数」に比例してしまう
 * （要件定義 6.2 の方針）。
 *
 * ★ テーブルはアイテム用のものを流用し、サブキーをカードの識別子
 * （`<種類>:<キー>`）へ一般化してある。**カード用に新しいテーブルを作らない。**
 */
export interface AchievedCard {
  cardId: string
  achievedAt: string
}

function toCard(item: unknown): AchievedCard | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>
  const cardId = raw[USER_CARDS_SUB_KEY]
  if (typeof cardId !== 'string' || cardId === '') return undefined

  return {
    cardId,
    achievedAt: typeof raw['achievedAt'] === 'string' ? raw['achievedAt'] : '',
  }
}

export interface AchieveResult {
  /** 今回はじめて達成したか。演出を出すかどうかの判断に使う */
  isNew: boolean
  achievedAt: string
}

/**
 * カードを達成させる。
 *
 * ★ **すでに達成しているものは上書きしない。** 達成日時は「はじめて達成した日時」で
 * あり、二度目のチェックインで塗り替わると記録として意味を失う。
 *
 * ★ 戻り値の `isNew` が演出の合図になる。ここで判定しておかないと、画面側が
 * 前回の一覧と比べる必要が出て、再読み込みで演出が消える。
 */
export async function achieveCard(
  ctx: DataStoreContext,
  userId: UserId,
  cardId: string,
  nowIso: string,
): Promise<AchieveResult> {
  const tableId = ctx.tableId('userCards')
  const key = { [USER_CARDS_MAIN_KEY]: userKey(userId), [USER_CARDS_SUB_KEY]: cardId }

  const existing = await runGet(() => ctx.client.getItem({ tableId, key }))
  const current = existing ? toCard(existing.params?.Item) : undefined
  if (current) return { isNew: false, achievedAt: current.achievedAt }

  await runOp('putItem', () =>
    ctx.client.putItem({ tableId, item: { ...key, achievedAt: nowIso } }),
  )
  return { isNew: true, achievedAt: nowIso }
}

/**
 * 達成したカードを全部取る。
 *
 * ★ **1回の query で済む。** メインキーが `user#<userId>` なので、サブキーを
 * 指定しなければその人の行が全部返る。カードごとに getItem すると枚数だけ
 * アクセスが増える（制約 E4）。
 */
export async function listAchievedCards(
  ctx: DataStoreContext,
  userId: UserId,
  limit: number,
): Promise<AchievedCard[]> {
  const tableId = ctx.tableId('userCards')
  const result = await runOp('query', () =>
    ctx.client.query({
      tableId,
      expression: `#${USER_CARDS_MAIN_KEY} = :${USER_CARDS_MAIN_KEY}`,
      values: { [USER_CARDS_MAIN_KEY]: userKey(userId) },
      limit,
      order: false,
    }),
  )

  const items = result.params?.Items ?? []
  return items.map(toCard).filter((card): card is AchievedCard => card !== undefined)
}
