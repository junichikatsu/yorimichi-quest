import { z } from 'zod'
import type { SpotCategory } from './spot.js'

/**
 * 収集アイテム（FR-07-8）。
 *
 * モチーフはすべて実在の防災グッズにする。架空のアイテムにしないのは、
 * 現実のモチーフがそのまま説明の代わりになるためである（設計原則 G-4）。
 *
 * ★ `use` は**行動を主語にする**（設計原則 G-8）。
 * 「落下物から頭を守る」のようにモノの性質を書くと、備蓄品を並べただけの学習になる。
 * 発災直後に生死を分けるのは「まず身を守る」という行動で、備蓄が役に立つのはその後である。
 * 順序を取り違えると学習の順序も取り違えるため、「それを使って何をするか」を書く。
 */

/**
 * 道具の身につける場所。
 *
 * ★ 装備の機能（見た目に反映する）は今回のスコープ外（#66）。ここで持っているのは
 * **カードの絵と並び順を描き分けるため**である。頭・体・手・背中の順に並べると、
 * 「身につけるもの」から「持ち運ぶもの」へ自然に並ぶ。
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
  /** その道具を使って**何をするか**。行動を主語にする（G-8）。説明としてそのまま表示する */
  use: string
  /** 獲得できるスポットのカテゴリ。null はクイズ正解のみで手に入る */
  fromCategory: SpotCategory | null
}

export const ITEM_DEFS: Record<ItemKey, ItemDef> = {
  helmet: {
    itemKey: 'helmet',
    name: 'ヘルメット',
    slot: 'head',
    use: '揺れたらまず頭を守る。その行動を確実にする',
    fromCategory: 'shelter',
  },
  zukin: {
    itemKey: 'zukin',
    name: '防炎ずきん',
    slot: 'head',
    use: '火の粉が舞うなかを、頭と首を守って逃げる',
    fromCategory: null,
  },
  headlight: {
    itemKey: 'headlight',
    name: 'ヘッドライト',
    slot: 'head',
    use: '停電のなかを、両手を空けたまま安全に移動する',
    fromCategory: null,
  },
  raincoat: {
    itemKey: 'raincoat',
    name: 'レインコート',
    slot: 'body',
    use: '雨のなかを、体温を落とさずに移動する',
    fromCategory: null,
  },
  gloves: {
    itemKey: 'gloves',
    name: '軍手',
    slot: 'hand',
    use: 'がれきをよけて進むとき、手を切らない',
    fromCategory: 'aed',
  },
  tank: {
    itemKey: 'tank',
    name: '給水タンク',
    slot: 'hand',
    use: '給水拠点から水を運び、家で確保する',
    fromCategory: 'water',
  },
  book: {
    itemKey: 'book',
    name: 'ハザードマップ手帳',
    slot: 'hand',
    use: '危険な場所を避けて、通る道を選ぶ',
    fromCategory: null,
  },
  whistle: {
    itemKey: 'whistle',
    name: '防災ホイッスル',
    slot: 'back',
    use: '動けなくなったとき、声の代わりに居場所を知らせる',
    fromCategory: null,
  },
  potatoilet: {
    itemKey: 'potatoilet',
    name: '携帯トイレ',
    slot: 'back',
    use: '断水しても水分を控えずに済むよう、用を足す',
    fromCategory: 'accessible_toilet',
  },
  radio: {
    itemKey: 'radio',
    name: '防災ラジオ',
    slot: 'back',
    use: '通信が途絶えても、確かな情報を得て次の行動を決める',
    fromCategory: null,
  },
}

/**
 * 道具の色。
 *
 * ★ ドット絵の主色に使う。実物の印象に寄せる（ヘルメットは黄、軍手は白、
 * ラジオは黒など）。**カードの枠の色（茶）とは別物**で、こちらは絵の中の色である。
 */
export const ITEM_COLORS: Record<ItemKey, string> = {
  helmet: '#e8b93a',
  zukin: '#c8503f',
  headlight: '#4a5170',
  raincoat: '#3f7fbf',
  gloves: '#e6e0d2',
  tank: '#3fa9c8',
  book: '#2f9e6f',
  whistle: '#e0b24a',
  potatoilet: '#a9a2b5',
  radio: '#5a4b40',
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

/* ------------------------------------------------------------------ *
 * 装備（身につける）
 * ------------------------------------------------------------------ */

/**
 * 身につけている道具。スロットごとに1つ、無いときは null。
 *
 * ★ **数値の効果は持たせない。見た目だけである**（FR-14-11・#67）。
 * 「手に入れても見た目が変わらないと集めた実感が出ない」ことへの対処であり、
 * 強さの管理ではない。
 *
 * ★ どの要件にも書かれていない追加機能である（FR-01-5/-6 は見た目の保持と作成画面、
 * FR-07-8 はアイテムの付与と一覧まで）。
 */
export const equipmentSchema = z.object({
  head: z.enum(ITEM_KEYS).nullable(),
  body: z.enum(ITEM_KEYS).nullable(),
  hand: z.enum(ITEM_KEYS).nullable(),
  back: z.enum(ITEM_KEYS).nullable(),
})

export type Equipment = z.infer<typeof equipmentSchema>

export const EMPTY_EQUIPMENT: Equipment = { head: null, body: null, hand: null, back: null }

/**
 * 装備を整える。
 *
 * ★ **持っていない道具とスロット違いを外す。** クライアントの申告を信じると、
 * 手に入れていない道具を着た姿を保存できてしまう。読み出し側でも通すので、
 * 過去に不正な値が入っていても表示が壊れない。
 */
export function sanitizeEquipment(
  equipment: Equipment,
  owned: ReadonlySet<string>,
): Equipment {
  const result: Equipment = { ...EMPTY_EQUIPMENT }

  for (const slot of ITEM_SLOTS) {
    const key = equipment[slot]
    if (key === null) continue
    if (!owned.has(key)) continue
    // スロットの取り違え（頭の道具を手に持つ等）も外す
    if (ITEM_DEFS[key].slot !== slot) continue
    result[slot] = key
  }

  return result
}

/** 装備している道具のキーだけを取り出す（絵を重ねる順に使う） */
export function equippedKeys(equipment: Equipment): string[] {
  return ITEM_SLOTS.map((slot) => equipment[slot]).filter((key): key is ItemKey => key !== null)
}
