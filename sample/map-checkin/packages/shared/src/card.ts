import type { ItemKey } from './item.js'
import type { SpotCategory } from './spot.js'

/**
 * カードコレクション（FR-14）。
 *
 * 出題・道具・スポット・ミッションを**すべて「カード」という一つの器**で扱う。
 * 状態は **達成／未達成** の2つだけで、中間は設けない。
 *
 * 未達成は「持っていない」ではなく「**まだ自分のものになっていない**」として見せる。
 * 枠は最初から並んでおり、何が残っているかが常に見えている状態にする。
 */

export const CARD_KINDS = ['action', 'tool', 'place', 'mission'] as const

export type CardKind = (typeof CARD_KINDS)[number]

/**
 * 表示順。**行動を先頭に置くのは設計原則 G-8 の具体化である。**
 * 道具より先に行動が並ぶことで、「モノをそろえれば備えたことになる」という
 * 逆の学習を、分類そのもので防ぐ。
 */
export const CARD_KIND_ORDER: readonly CardKind[] = CARD_KINDS

export const CARD_KIND_LABELS: Record<CardKind, string> = {
  action: '行動',
  tool: '道具',
  place: '場所',
  mission: 'ミッション',
}

/** カードの識別子。データストアのサブキーにそのまま使う（`<種類>:<キー>`） */
export function toCardId(kind: CardKind, key: string): string {
  return `${kind}:${key}`
}

export function parseCardId(cardId: string): { kind: CardKind; key: string } | undefined {
  const index = cardId.indexOf(':')
  if (index <= 0) return undefined

  const kind = cardId.slice(0, index)
  const key = cardId.slice(index + 1)
  if (key === '' || !(CARD_KINDS as readonly string[]).includes(kind)) return undefined

  return { kind: kind as CardKind, key }
}

/**
 * クライアントへ返すカード1枚。
 *
 * ★ `body`（達成後にだけ見せる中身）は、**未達成なら undefined にしてレスポンスから落とす**。
 * 「隠す」を表示側の責務にすると、配信されたデータを見れば読めてしまう。
 * クイズの正解をサーバー側に置いているのと同じ理由（`quiz.ts` 参照）。
 */
export interface CardView {
  cardId: string
  kind: CardKind
  /**
   * 未達成でも見せる見出し。
   *
   * 行動カードは**行動そのものではなく「場面」**を入れる（例：「大きな地震の直後」）。
   * 行動を見出しにすると、対応するクイズの答えが未達成のまま読めてしまう。
   */
  title: string
  /** 未達成でも見せる：どうすれば達成できるか */
  condition: string
  /** 達成後にだけ見せる中身。未達成では undefined */
  body: string | undefined
  achieved: boolean
  achievedAt: string | undefined
  /**
   * 絵と色分けに使うカテゴリ。
   * 場所カードはそのスポット、行動カードは対応する出題のカテゴリ。道具とミッションは undefined。
   * いずれも地図で見える情報なので、未達成でも伏せる必要はない。
   */
  category: SpotCategory | undefined
  /** ミッションカードの進捗（達成した枚数／必要枚数）。他の種類では undefined */
  progress: { current: number; total: number } | undefined
}

export interface CardKindProgress {
  achieved: number
  total: number
}

export interface CardCollectionSummary {
  achieved: number
  total: number
  byKind: Record<CardKind, CardKindProgress>
}

/* ------------------------------------------------------------------ *
 * ミッションカード
 * ------------------------------------------------------------------ */

/**
 * ミッションの達成条件。
 *
 * **他のカードの達成枚数を数えるだけで判定できる形に限定している**（FR-14-7）。
 * 専用のカウンタを持たないので、データが増えず、判定もぶれない。
 */
export interface MissionRequirement {
  kind: CardKind
  /** 場所カードを数えるときのカテゴリ絞り込み。未指定なら種類の全件 */
  category?: SpotCategory
  count: number
}

export interface MissionDef {
  missionKey: string
  /** 未達成でも見せる見出し */
  title: string
  /** 未達成でも見せる達成条件の文 */
  condition: string
  /** 達成後にだけ見せる中身 */
  body: string
  requirement: MissionRequirement
}

/**
 * MVPで用要するミッション（FR-14）。
 *
 * 要件定義書は4つ目に「だれかの投稿を確かめる（相互検証1回）」を挙げているが、
 * **相互検証はこのサンプルのスコープ外**（Issue #8）のため、道具を集める条件に差し替えている。
 */
export const MISSION_DEFS: readonly MissionDef[] = [
  {
    missionKey: 'first-action',
    title: 'まず身を守る',
    condition: '行動カードを1枚そろえる',
    body: '備蓄が役に立つのは、最初の数十秒を生き延びたあとです。まず身を守る行動から覚えます。',
    requirement: { kind: 'action', count: 1 },
  },
  {
    missionKey: 'shelter-3',
    title: '避難所を3か所たずねる',
    condition: '避難所の場所カードを3枚そろえる',
    body: '避難所は1か所だけ知っていても、その日に開いているとは限りません。複数の候補を持っておきます。',
    requirement: { kind: 'place', category: 'shelter', count: 3 },
  },
  {
    missionKey: 'aed-2',
    title: 'AEDを2か所見つける',
    condition: 'AEDの場所カードを2枚そろえる',
    body: '店内のAEDは営業時間外に使えません。24時間使える場所を含めて複数把握しておきます。',
    requirement: { kind: 'place', category: 'aed', count: 2 },
  },
  {
    missionKey: 'backpack-3',
    title: '防災リュックをそろえる',
    condition: '道具カードを3枚そろえる',
    body: '道具はそれぞれ「何をするため」のものです。集めた3つの使い道を言えれば十分です。',
    requirement: { kind: 'tool', count: 3 },
  },
]

/** 道具カードのキーはアイテムキーと同じ */
export type ToolCardKey = ItemKey
