import {
  getUser,
  listAchievedCards,
  listSpotsByArea,
  type AchievedCard,
  type DataStoreContext,
} from '@map-checkin/datastore'
import {
  CARD_KINDS,
  CARD_KIND_ORDER,
  EMPTY_EQUIPMENT,
  ITEM_DEFS,
  ITEM_ORDER,
  MISSION_DEFS,
  SPOT_CATEGORY_LABELS,
  parseCardId,
  sanitizeEquipment,
  toCardId,
  type AreaId,
  type CardCollectionSummary,
  type CardKind,
  type CardKindProgress,
  type CardView,
  type CardsResponse,
  type MissionDef,
  type SpotCategory,
  type UserId,
} from '@map-checkin/shared'
import { allQuizEntries } from '../data/quiz-bank.js'

/**
 * カードコレクション（FR-14）。
 *
 * 未達成のカードは保存していないため、**定義から全枚数を組み立てて、
 * 達成済みのレコードを重ねる**という作り方をする。
 * データストアへのアクセスは query 2 回（カード／スポット）＋ getItem 1 回（装備）で済む。
 */

interface CardSource {
  cardId: string
  kind: CardKind
  title: string
  condition: string
  /** 達成後にだけ見せる中身 */
  body: string
  /** 場所カードのカテゴリ。ミッションの絞り込みに使う */
  category?: SpotCategory
}

/**
 * 行動カード。
 *
 * ★ 見出しは `card.scene`（場面）で、`card.action`（行動）は中身に置く。
 * 行動を見出しにすると、未達成のカード一覧を見るだけで対応するクイズの答えが読めてしまう。
 */
function actionCards(): CardSource[] {
  return allQuizEntries().map((entry) => ({
    cardId: toCardId('action', entry.quizId),
    kind: 'action' as const,
    title: entry.card.scene,
    condition: 'このスポットのクイズに正解する',
    body: entry.card.action,
  }))
}

function toolCards(): CardSource[] {
  return ITEM_ORDER.map((key) => {
    const def = ITEM_DEFS[key]
    return {
      cardId: toCardId('tool', key),
      kind: 'tool' as const,
      title: def.name,
      condition:
        def.fromCategory === null
          ? '現地のクイズに正解して手に入れる'
          : `${SPOT_CATEGORY_LABELS[def.fromCategory]}でチェックインして手に入れる`,
      body: def.use,
    }
  })
}

function missionCards(): CardSource[] {
  return MISSION_DEFS.map((def: MissionDef) => ({
    cardId: toCardId('mission', def.missionKey),
    kind: 'mission' as const,
    title: def.title,
    condition: def.condition,
    body: def.body,
  }))
}

/**
 * ミッションの達成判定（FR-14-7）。
 *
 * **他のカードの達成枚数を数えるだけで済ませている。** 専用のカウンタを持たないので、
 * データが増えず、表示している枚数と判定が食い違うこともない。
 */
function isMissionAchieved(
  def: MissionDef,
  achievedIds: ReadonlySet<string>,
  categoryOfPlace: ReadonlyMap<string, SpotCategory>,
): boolean {
  const { kind, category, count } = def.requirement

  let matched = 0
  for (const cardId of achievedIds) {
    const parsed = parseCardId(cardId)
    if (!parsed || parsed.kind !== kind) continue
    if (category !== undefined && categoryOfPlace.get(cardId) !== category) continue
    matched += 1
  }

  return matched >= count
}

function emptyProgress(): Record<CardKind, CardKindProgress> {
  const byKind = {} as Record<CardKind, CardKindProgress>
  for (const kind of CARD_KINDS) byKind[kind] = { achieved: 0, total: 0 }
  return byKind
}

export interface BuildCardsInput {
  userId: UserId
  areaId: AreaId
  maxSpots: number
}

export async function buildCards(
  ctx: DataStoreContext,
  input: BuildCardsInput,
): Promise<CardsResponse> {
  const [achieved, spots, profile] = await Promise.all([
    listAchievedCards(ctx, input.userId),
    listSpotsByArea(ctx, input.areaId, input.maxSpots),
    getUser(ctx, input.userId),
  ])

  const achievedById = new Map<string, AchievedCard>(achieved.map((card) => [card.cardId, card]))
  const achievedIds = new Set(achievedById.keys())

  const placeCards: CardSource[] = spots.map((spot) => ({
    cardId: toCardId('place', spot.spotId),
    kind: 'place' as const,
    title: spot.name,
    condition: 'この場所でチェックインする',
    body: `${SPOT_CATEGORY_LABELS[spot.category]}／${spot.address}`,
    category: spot.category,
  }))

  // 場所カードのカテゴリ表。ミッションの絞り込み（避難所3枚など）に使う
  const categoryOfPlace = new Map(
    placeCards.map((card) => [card.cardId, card.category as SpotCategory]),
  )

  const sources = [...actionCards(), ...toolCards(), ...placeCards, ...missionCards()]

  const byKind = emptyProgress()
  const cards: CardView[] = sources.map((source) => {
    const record = achievedById.get(source.cardId)
    const isAchieved =
      source.kind === 'mission'
        ? isMissionAchieved(
            // missionKey から定義を引き直す（並びに依存しない）
            MISSION_DEFS.find((def) => toCardId('mission', def.missionKey) === source.cardId) ??
              MISSION_DEFS[0]!,
            achievedIds,
            categoryOfPlace,
          )
        : record !== undefined

    byKind[source.kind].total += 1
    if (isAchieved) byKind[source.kind].achieved += 1

    return {
      cardId: source.cardId,
      kind: source.kind,
      title: source.title,
      condition: source.condition,
      // ★ 未達成では中身をレスポンスに含めない（表示側で隠すのではなく、そもそも送らない）
      body: isAchieved ? source.body : undefined,
      achieved: isAchieved,
      achievedAt: record?.achievedAt,
    }
  })

  // 表示順は種類の並び（行動→道具→場所→ミッション）。G-8 により行動が先頭
  const kindRank = new Map(CARD_KIND_ORDER.map((kind, index) => [kind, index]))
  cards.sort((a, b) => (kindRank.get(a.kind) ?? 0) - (kindRank.get(b.kind) ?? 0))

  const summary: CardCollectionSummary = {
    achieved: Object.values(byKind).reduce((sum, p) => sum + p.achieved, 0),
    total: Object.values(byKind).reduce((sum, p) => sum + p.total, 0),
    byKind,
  }

  const ownedTools = new Set(
    achieved
      .map((card) => parseCardId(card.cardId))
      .filter((parsed) => parsed?.kind === 'tool')
      .map((parsed) => parsed!.key),
  )

  return {
    cards,
    summary,
    equipment: sanitizeEquipment(profile?.equipment ?? EMPTY_EQUIPMENT, ownedTools),
  }
}
