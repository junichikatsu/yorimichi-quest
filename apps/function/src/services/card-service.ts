import {
  achieveCard,
  listAchievedCards,
  listSpotsByArea,
  type DataStoreContext,
} from '@imanouchi/datastore'
import {
  CARD_KIND_LABELS,
  CARD_KINDS,
  CARD_KIND_ORDER,
  ITEM_DEFS,
  ITEM_ORDER,
  MISSION_DEFS,
  SPOT_CATEGORIES,
  SPOT_CATEGORY_LABELS,
  parseCardId,
  PIXEL_ART,
  pixelArtKeyOf,
  toCardId,
  type AreaId,
  type CardCollectionSummary,
  type CardKind,
  type CardKindProgress,
  type CardView,
  type CardsResponse,
  type MissionDef,
  type PlaceCardSummary,
  type Spot,
  type SpotCategory,
  type UserId,
} from '@imanouchi/shared'
import { allQuizEntries } from '../data/quiz-bank.js'

/**
 * カードコレクション（FR-14）。
 *
 * ★ **未達成のカードは保存していない。** 定義から全枚数を組み立てて、達成済みの
 * レコードを重ねるという作り方をする。保存すると書き込み回数が「歩いた量」ではなく
 * 「カードの総数」に比例してしまう（要件定義 6.2）。
 *
 * ★ 一覧のデータストアアクセスは query 2 回（カード／スポット）で済む。
 */

/** 一度に扱うカードの上限。到達しない値だが、無制限のクエリを投げない */
const MAX_CARDS = 1000

/**
 * 場所カードを数えるときに読むスポットの上限。
 *
 * ★ **`MAX_SPOTS_PER_REQUEST`（既定 200）を使ってはいけない。** あれは
 * 「1リクエストで画面へ返す件数」の上限であり、対象エリアには 370 件ある。
 * これで数えると **「AED 0/200」のように総数が嘘になる**（データストアの query は
 * サブキーの昇順で返すため、辞書順で先のカテゴリだけが残る）。
 * ここは返さずに数えるだけなので、全件読める値にしておく。
 */
const MAX_SPOT_SCAN = 1000

/** カード1枚の定義。達成状態を持たない「器」 */
export interface CardDefinition {
  cardId: string
  kind: CardKind
  title: string
  condition: string
  /** 達成後にだけ見せる中身 */
  body: string
  category?: SpotCategory
}

/**
 * 行動カードの定義（FR-14-5）。
 *
 * ★ 見出しは `card.scene`（場面）で、`card.action`（行動）は中身に置く。
 * 行動を見出しにすると、未達成のカード一覧を見るだけで対応するクイズの答えが読める。
 */
export function actionCardDefs(): CardDefinition[] {
  return allQuizEntries().map((entry) => ({
    cardId: toCardId('action', entry.quizId),
    kind: 'action',
    title: entry.card.scene,
    condition: 'このスポットのクイズに正解する',
    body: entry.card.action,
    category: entry.category,
  }))
}

/** 道具カードの定義（FR-14-6）。説明は**行動を主語**にしてある（G-8） */
export function toolCardDefs(): CardDefinition[] {
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

export function missionCardDefs(): CardDefinition[] {
  return MISSION_DEFS.map((def: MissionDef) => ({
    cardId: toCardId('mission', def.missionKey),
    kind: 'mission' as const,
    title: def.title,
    condition: def.condition,
    body: def.body,
  }))
}

/** 場所カードの定義（FR-14-4）。スポット1件につき1枚 */
export function placeCardDef(spot: Pick<Spot, 'spotId' | 'name' | 'category'>): CardDefinition {
  return {
    cardId: toCardId('place', spot.spotId),
    kind: 'place',
    title: spot.name,
    condition: 'この場所でチェックインする',
    body: `${SPOT_CATEGORY_LABELS[spot.category]}として現地を確かめました。`,
    category: spot.category,
  }
}

function toView(def: CardDefinition, achievedAt: string | undefined): CardView {
  const achieved = achievedAt !== undefined
  return {
    cardId: def.cardId,
    kind: def.kind,
    title: def.title,
    condition: def.condition,
    // ★ 未達成では中身を落とす（FR-14-3）。表示側で隠すと、配信データを見れば読める
    body: achieved ? def.body : undefined,
    achieved,
    achievedAt,
    category: def.category,
    progress: undefined,
  }
}

/**
 * ミッションの達成判定（FR-14-7）。
 *
 * ★ **他のカードの達成枚数を数えるだけで済ませている。** 専用のカウンタを持たない
 * ので、データが増えず、表示している枚数と判定が食い違うこともない。
 */
function missionProgress(
  def: MissionDef,
  achievedAt: ReadonlyMap<string, string>,
  categoryOfCard: ReadonlyMap<string, SpotCategory>,
): { current: number; total: number } {
  const { kind, category, count } = def.requirement

  let matched = 0
  for (const cardId of achievedAt.keys()) {
    const parsed = parseCardId(cardId)
    if (!parsed || parsed.kind !== kind) continue
    if (category !== undefined && categoryOfCard.get(cardId) !== category) continue
    matched += 1
  }

  // 進捗の表示に使うので必要枚数で頭打ちにする（3/3 を超えて 5/3 とは出さない）
  return { current: Math.min(matched, count), total: count }
}

function emptyByKind(): Record<CardKind, CardKindProgress> {
  const byKind = {} as Record<CardKind, CardKindProgress>
  for (const kind of CARD_KINDS) byKind[kind] = { achieved: 0, total: 0 }
  return byKind
}

export interface BuildCardsInput {
  userId: UserId
  areaId: AreaId
}

export async function buildCards(
  ctx: DataStoreContext,
  input: BuildCardsInput,
): Promise<CardsResponse> {
  const [achieved, spots] = await Promise.all([
    listAchievedCards(ctx, input.userId, MAX_CARDS),
    listSpotsByArea(ctx, input.areaId, MAX_SPOT_SCAN),
  ])

  const achievedAt = new Map(achieved.map((card) => [card.cardId, card.achievedAt]))

  /*
   * ★ 場所カードは**達成した分だけ**並べる。
   *
   * 対象エリアのスポットは 371 件あり、未達成をすべて並べると一覧が使えない
   * （仮想スクロールが必要になり、演出も重くなる）。「何が残っているかが常に
   * 見えている」という要求は、カテゴリ別の件数（`places`）で満たす。
   */
  const placeDefs: CardDefinition[] = []
  const categoryOfCard = new Map<string, SpotCategory>()
  const placeTotals = new Map<SpotCategory, number>()
  const placeAchieved = new Map<SpotCategory, number>()

  for (const spot of spots) {
    const def = placeCardDef(spot)
    categoryOfCard.set(def.cardId, spot.category)
    placeTotals.set(spot.category, (placeTotals.get(spot.category) ?? 0) + 1)

    if (achievedAt.has(def.cardId)) {
      placeDefs.push(def)
      placeAchieved.set(spot.category, (placeAchieved.get(spot.category) ?? 0) + 1)
    }
  }

  // 行動カードのカテゴリもミッションの絞り込みに使えるよう記録しておく
  const actionDefs = actionCardDefs()
  for (const def of actionDefs) {
    if (def.category) categoryOfCard.set(def.cardId, def.category)
  }

  const byKind = emptyByKind()
  const cards: CardView[] = []

  for (const kind of CARD_KIND_ORDER) {
    const defs =
      kind === 'action'
        ? actionDefs
        : kind === 'tool'
          ? toolCardDefs()
          : kind === 'place'
            ? placeDefs
            : missionCardDefs()

    for (const def of defs) {
      const view = toView(def, achievedAt.get(def.cardId))

      if (kind === 'mission') {
        const mission = MISSION_DEFS.find((m) => toCardId('mission', m.missionKey) === def.cardId)
        if (mission) view.progress = missionProgress(mission, achievedAt, categoryOfCard)
      }

      cards.push(view)
      byKind[kind].total += 1
      if (view.achieved) byKind[kind].achieved += 1
    }
  }

  /*
   * ★ 場所カードの総数は「並べた枚数」ではなくスポットの件数にする。
   * 達成分だけ並べているので、そのまま数えると常に 100% になってしまう。
   */
  byKind.place.total = spots.length

  const places: PlaceCardSummary[] = SPOT_CATEGORIES.filter(
    (category) => (placeTotals.get(category) ?? 0) > 0,
  ).map((category) => ({
    category,
    label: SPOT_CATEGORY_LABELS[category],
    achieved: placeAchieved.get(category) ?? 0,
    total: placeTotals.get(category) ?? 0,
  }))

  const summary: CardCollectionSummary = {
    achieved: CARD_KINDS.reduce((sum, kind) => sum + byKind[kind].achieved, 0),
    total: CARD_KINDS.reduce((sum, kind) => sum + byKind[kind].total, 0),
    byKind,
  }

  return { cards, places, summary }
}

/* ------------------------------------------------------------------ *
 * 達成させる
 * ------------------------------------------------------------------ */

/**
 * カードを達成させ、**今回はじめて達成したぶんだけ**を返す。
 *
 * ★ 「今回の新規」をサーバーが決めるのが要点である。画面側が前回の一覧と比べる
 * 作りにすると、再読み込みで演出が消えたり二重に出たりする。
 */
export async function grantCards(
  ctx: DataStoreContext,
  userId: UserId,
  defs: readonly CardDefinition[],
  nowIso: string,
): Promise<CardView[]> {
  const acquired: CardView[] = []

  for (const def of defs) {
    const result = await achieveCard(ctx, userId, def.cardId, nowIso)
    if (result.isNew) acquired.push(toView(def, result.achievedAt))
  }

  return acquired
}

/**
 * 達成したカードの枚数を見て、条件を満たしたミッションを達成させる（FR-14-7）。
 *
 * ★ **何かが新しく達成されたときだけ呼ぶこと。** 枚数が変わらないのに毎回数え直すと、
 * チェックインごとに query が1回増える（制約 E4：アクセス数に月次上限がある）。
 */
export async function grantMissions(
  ctx: DataStoreContext,
  userId: UserId,
  areaId: AreaId,
  nowIso: string,
): Promise<CardView[]> {
  const [achieved, spots] = await Promise.all([
    listAchievedCards(ctx, userId, MAX_CARDS),
    listSpotsByArea(ctx, areaId, MAX_SPOT_SCAN),
  ])

  const achievedAt = new Map(achieved.map((card) => [card.cardId, card.achievedAt]))
  const categoryOfCard = new Map<string, SpotCategory>()
  for (const spot of spots) categoryOfCard.set(toCardId('place', spot.spotId), spot.category)
  for (const def of actionCardDefs()) {
    if (def.category) categoryOfCard.set(def.cardId, def.category)
  }

  const met: CardDefinition[] = []
  for (const mission of MISSION_DEFS) {
    const cardId = toCardId('mission', mission.missionKey)
    if (achievedAt.has(cardId)) continue

    const progress = missionProgress(mission, achievedAt, categoryOfCard)
    if (progress.current < progress.total) continue

    met.push({
      cardId,
      kind: 'mission',
      title: mission.title,
      condition: mission.condition,
      body: mission.body,
    })
  }

  if (met.length === 0) return []
  return grantCards(ctx, userId, met, nowIso)
}

/* ------------------------------------------------------------------ *
 * カードの一覧（開発用）
 * ------------------------------------------------------------------ */

export interface CardCatalogGroup {
  kind: CardKind
  label: string
  /** この種類の総数。場所は対象エリアのスポット件数 */
  total: number
  /** 達成条件の説明（種類ごと） */
  howTo: string
  /** カードの定義。場所は見本だけ（全件はスポット数と同じになる） */
  cards: CardDefinition[]
}

export interface CardCatalog {
  groups: CardCatalogGroup[]
  places: PlaceCardSummary[]
  total: number
  /**
   * ドット絵そのもの（開発用の一覧ページが描くために渡す）。
   *
   * ★ ページ側に書き写さない。絵を直したときに一覧だけ古いまま残る。
   */
  art: Record<string, string[]>
  /** カードIDごとの絵の名前 */
  artKeys: Record<string, string>
}

/**
 * カードの定義を全部返す（**開発用**）。
 *
 * ★ 種類と中身を見比べるための一覧である。**中身（達成後にだけ見せる文）も返す**
 * ため、本番へ出してはいけない。ルート側でインメモリ実装のときだけ生やしている。
 *
 * ★ 画面に書き写さず、ここから引く。書き写すと、出題やアイテムを増やしたときに
 * 一覧だけ古いまま残る。
 */
export async function buildCatalog(
  ctx: DataStoreContext,
  areaId: AreaId,
  placeSamples: number,
): Promise<CardCatalog> {
  const spots = await listSpotsByArea(ctx, areaId, MAX_SPOT_SCAN)

  const placeTotals = new Map<SpotCategory, number>()
  for (const spot of spots) {
    placeTotals.set(spot.category, (placeTotals.get(spot.category) ?? 0) + 1)
  }

  const groups: CardCatalogGroup[] = [
    {
      kind: 'action',
      label: CARD_KIND_LABELS.action,
      total: actionCardDefs().length,
      howTo: '対応するクイズに正解すると達成する（FR-14-5）。見出しは「場面」で、行動そのものは達成後にだけ見える。',
      cards: actionCardDefs(),
    },
    {
      kind: 'tool',
      label: CARD_KIND_LABELS.tool,
      total: toolCardDefs().length,
      howTo: 'チェックイン、またはクイズ正解で手に入る（FR-14-6）。説明は「それを使って何をするか」を主語にしている（G-8）。',
      cards: toolCardDefs(),
    },
    {
      kind: 'place',
      label: CARD_KIND_LABELS.place,
      total: spots.length,
      howTo: 'その場所でチェックインすると達成する（FR-14-4）。スポット1件につき1枚。',
      cards: spots.slice(0, placeSamples).map(placeCardDef),
    },
    {
      kind: 'mission',
      label: CARD_KIND_LABELS.mission,
      total: missionCardDefs().length,
      howTo: '他のカードの達成枚数だけで判定する（FR-14-7）。専用のカウンタを持たない。',
      cards: missionCardDefs(),
    },
  ]

  const places: PlaceCardSummary[] = SPOT_CATEGORIES.filter(
    (category) => (placeTotals.get(category) ?? 0) > 0,
  ).map((category) => ({
    category,
    label: SPOT_CATEGORY_LABELS[category],
    achieved: 0,
    total: placeTotals.get(category) ?? 0,
  }))

  const artKeys: Record<string, string> = {}
  for (const group of groups) {
    for (const card of group.cards) {
      const parsed = parseCardId(card.cardId)
      artKeys[card.cardId] = pixelArtKeyOf({
        kind: parsed?.kind ?? group.kind,
        key: parsed?.key ?? '',
        category: card.category,
      })
    }
  }

  return {
    groups,
    places,
    total: groups.reduce((sum, group) => sum + group.total, 0),
    art: PIXEL_ART,
    artKeys,
  }
}
