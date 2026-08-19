import { z } from 'zod'
import type { SpotCategory } from './spot.js'

/**
 * 収集アイテム（FR-07-8）。
 *
 * モチーフはすべて実在の防災グッズで、`use` にその道具の現実の役割を書く。
 * 架空のアイテムにしないのは、現実のモチーフがそのまま説明の代わりになるためで、
 * 集める行為が防災備蓄リストの学習になることを狙っている（設計原則 G-4）。
 */

export const ITEM_SLOTS = ['head', 'body', 'hand', 'back'] as const

export type ItemSlot = (typeof ITEM_SLOTS)[number]

export const ITEM_SLOT_LABELS: Record<ItemSlot, string> = {
  head: '頭',
  body: '体',
  hand: '手',
  back: '背中',
}

export const ITEM_KEYS = [
  'helmet',
  'zukin',
  'headlight',
  'raincoat',
  'gloves',
  'tank',
  'book',
  'whistle',
  'potatoilet',
  'radio',
] as const

export type ItemKey = (typeof ITEM_KEYS)[number]

export interface ItemDef {
  itemKey: ItemKey
  name: string
  slot: ItemSlot
  /** 現実でその道具が果たす役割。アイテム説明としてそのまま表示する */
  use: string
  /** 獲得できるスポットのカテゴリ。null はクイズ正解のみで手に入る */
  fromCategory: SpotCategory | null
}

export const ITEM_DEFS: Record<ItemKey, ItemDef> = {
  helmet: {
    itemKey: 'helmet',
    name: 'ヘルメット',
    slot: 'head',
    use: '落下物から頭を守る',
    fromCategory: 'shelter',
  },
  zukin: {
    itemKey: 'zukin',
    name: '防炎ずきん',
    slot: 'head',
    use: '火の粉と落下物から頭と首を守る',
    fromCategory: null,
  },
  headlight: {
    itemKey: 'headlight',
    name: 'ヘッドライト',
    slot: 'head',
    use: '停電時に両手を空けたまま灯りを確保する',
    fromCategory: null,
  },
  raincoat: {
    itemKey: 'raincoat',
    name: 'レインコート',
    slot: 'body',
    use: '雨と浸水から体を守る',
    fromCategory: null,
  },
  gloves: {
    itemKey: 'gloves',
    name: '軍手',
    slot: 'hand',
    use: '割れた物やがれきから手のけがを防ぐ',
    fromCategory: 'aed',
  },
  tank: {
    itemKey: 'tank',
    name: '給水タンク',
    slot: 'hand',
    use: '水を運び、家で蓄える',
    fromCategory: 'water',
  },
  book: {
    itemKey: 'book',
    name: 'ハザードマップ手帳',
    slot: 'hand',
    use: '危険な場所を事前に知っておく',
    fromCategory: null,
  },
  whistle: {
    itemKey: 'whistle',
    name: '防災ホイッスル',
    slot: 'back',
    use: 'がれきの下からでも居場所を知らせる',
    fromCategory: null,
  },
  potatoilet: {
    itemKey: 'potatoilet',
    name: '携帯トイレ',
    slot: 'back',
    use: '断水したときの衛生を保つ',
    fromCategory: 'accessible_toilet',
  },
  radio: {
    itemKey: 'radio',
    name: '防災ラジオ',
    slot: 'back',
    use: '通信が途絶えても正しい情報を受け取る',
    fromCategory: null,
  },
}

/** コレクション画面の並び順。スロット順に並べると見た目の対応が分かりやすい */
export const ITEM_ORDER: readonly ItemKey[] = ITEM_KEYS

export function isItemKey(value: string): value is ItemKey {
  return (ITEM_KEYS as readonly string[]).includes(value)
}

/** チェックインで獲得できるアイテム。カテゴリに紐づかないものはクイズ正解のみ */
export function checkinItemFor(category: SpotCategory): ItemKey | undefined {
  return ITEM_KEYS.find((key) => ITEM_DEFS[key].fromCategory === category)
}

export const equipmentSchema = z.object({
  head: z.enum(ITEM_KEYS).nullable(),
  body: z.enum(ITEM_KEYS).nullable(),
  hand: z.enum(ITEM_KEYS).nullable(),
  back: z.enum(ITEM_KEYS).nullable(),
})

export type Equipment = z.infer<typeof equipmentSchema>

export const EMPTY_EQUIPMENT: Equipment = { head: null, body: null, hand: null, back: null }

/**
 * 装備の妥当性を整える。
 *
 * 所持していないアイテムや、スロットの合わないアイテムが入っていたら外す。
 * 見た目の描画がそのまま装備状態を映すため、ここで弾いておかないと
 * 「持っていない装備を着たキャラ」が表示されてしまう。
 */
export function sanitizeEquipment(equipment: Equipment, owned: ReadonlySet<string>): Equipment {
  const result: Equipment = { ...EMPTY_EQUIPMENT }
  for (const slot of ITEM_SLOTS) {
    const key = equipment[slot]
    if (key === null) continue
    if (!owned.has(key)) continue
    if (ITEM_DEFS[key].slot !== slot) continue
    result[slot] = key
  }
  return result
}

export interface OwnedItem {
  itemKey: ItemKey
  count: number
  firstAcquiredAt: string
}
