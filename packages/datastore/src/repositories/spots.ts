import type { AreaId, Spot, SpotCategory, SpotId, SurveyStats } from '@imanouchi/shared'
import { asAreaId, asSpotId, SURVEY_VALUES, allSurveyFields } from '@imanouchi/shared'
import type { DataStoreContext } from '../context.js'
import { areaKey, SPOTS_MAIN_KEY, SPOTS_SUB_KEY, surveyTallyColumn } from '../keys.js'
import { runGet, runOp } from '../run.js'

interface SpotItem extends Record<string, unknown> {
  areaKey: string
  spotId: string
  areaId: string
  name: string
  category: string
  lat: number
  lng: number
  address: string
  attributes: string[]
  source: string
  fetchedAt: string
  checkinCount: number
  updatedAt: string
}

/**
 * アンケートの集計を、**入れ子を作らず数値の列**として読み書きする（FR-12）。
 *
 * ★ データストアの値は文字列・数値・真偽値である（`DataStoreValue`）。
 * `{ ostomate: { yes: 3 } }` のような入れ子を入れると、SDK の実装や
 * テーブル定義に依存した壊れ方をする。**列名を平らにして数値だけを置く。**
 *
 * ★ 列名はデータ辞書から組み立てる。書き込み側と読み取り側で別々に綴ると、
 * 片方だけ直したときに**数えていたはずの回答が静かに 0 に戻る。**
 *
 * ★ 無い列は 0 として読む。既に入っているスポット 370 件はこの列を持たないので、
 * 読めないことが正常な初期状態である（入れ直しは不要）。
 */
function readSurveyStats(raw: Record<string, unknown>): SurveyStats {
  const stats: SurveyStats = {}

  for (const field of allSurveyFields()) {
    let seen = false
    const tally = { yes: 0, no: 0, unknown: 0 }

    for (const value of SURVEY_VALUES) {
      const count = raw[surveyTallyColumn(field.fieldKey, value)]
      if (typeof count !== 'number' || count <= 0) continue
      tally[value] = count
      seen = true
    }

    // ★ 0 件の項目は載せない。「まだ誰も答えていない」を空で表す（FR-12-2 の未取得）
    if (seen) stats[field.fieldKey] = tally
  }

  return stats
}

function writeSurveyStats(stats: SurveyStats): Record<string, number> {
  const columns: Record<string, number> = {}

  for (const field of allSurveyFields()) {
    const tally = stats[field.fieldKey]
    if (!tally) continue
    for (const value of SURVEY_VALUES) {
      if (tally[value] > 0) columns[surveyTallyColumn(field.fieldKey, value)] = tally[value]
    }
  }

  return columns
}

function toSpot(item: unknown): Spot | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Partial<SpotItem>
  if (
    typeof raw.spotId !== 'string' ||
    typeof raw.areaId !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.category !== 'string' ||
    typeof raw.lat !== 'number' ||
    typeof raw.lng !== 'number'
  ) {
    return undefined
  }

  return {
    spotId: asSpotId(raw.spotId),
    areaId: asAreaId(raw.areaId),
    name: raw.name,
    category: raw.category as SpotCategory,
    lat: raw.lat,
    lng: raw.lng,
    address: raw.address ?? '',
    attributes: Array.isArray(raw.attributes) ? raw.attributes : [],
    source: raw.source ?? 'unknown',
    fetchedAt: raw.fetchedAt ?? '',
    checkinCount: raw.checkinCount ?? 0,
    surveyStats: readSurveyStats(item as Record<string, unknown>),
    updatedAt: raw.updatedAt ?? '',
  }
}

function toItem(spot: Spot): SpotItem {
  return {
    [SPOTS_MAIN_KEY]: areaKey(spot.areaId),
    [SPOTS_SUB_KEY]: spot.spotId,
    areaId: spot.areaId,
    name: spot.name,
    category: spot.category,
    lat: spot.lat,
    lng: spot.lng,
    address: spot.address,
    attributes: spot.attributes,
    source: spot.source,
    fetchedAt: spot.fetchedAt,
    checkinCount: spot.checkinCount,
    updatedAt: spot.updatedAt,
    ...writeSurveyStats(spot.surveyStats),
  } as SpotItem
}

/**
 * エリア内のスポットを取得する。
 *
 * データストアに地理検索が無いため、エリアでパーティションを切って全件取得し、
 * 距離計算はアプリ層で行う（デモエリア限定なので件数が制御できている前提）。
 */
export async function listSpotsByArea(
  ctx: DataStoreContext,
  areaId: AreaId,
  limit: number,
): Promise<Spot[]> {
  const tableId = ctx.tableId('spots')
  const result = await runOp('query', () =>
    ctx.client.query({
      tableId,
      expression: `#${SPOTS_MAIN_KEY} = :${SPOTS_MAIN_KEY}`,
      values: { [SPOTS_MAIN_KEY]: areaKey(areaId) },
      limit,
      order: false,
    }),
  )

  const items = result.params?.Items ?? []
  return items.map(toSpot).filter((spot): spot is Spot => spot !== undefined)
}

export async function getSpot(
  ctx: DataStoreContext,
  areaId: AreaId,
  spotId: SpotId,
): Promise<Spot | undefined> {
  const tableId = ctx.tableId('spots')
  const result = await runGet(() =>
    ctx.client.getItem({
      tableId,
      key: { [SPOTS_MAIN_KEY]: areaKey(areaId), [SPOTS_SUB_KEY]: spotId },
    }),
  )
  if (!result) return undefined
  return toSpot(result.params?.Item)
}

export async function putSpot(ctx: DataStoreContext, spot: Spot): Promise<void> {
  const tableId = ctx.tableId('spots')
  await runOp('putItem', () => ctx.client.putItem({ tableId, item: toItem(spot) }))
}

/**
 * チェックイン回数を 1 増やす（FR-03-4）。
 *
 * ★ データストアに加算（atomic increment）は無いので、読んだ値に足して書き戻す。
 * 同時にチェックインされると取りこぼしうるが、**回数は表示と貢献度のための目安**で
 * あり、ポイントや制限の判定には使っていない。取りこぼしても不整合にならない側に
 * 寄せている。
 */
export async function incrementSpotCheckinCount(
  ctx: DataStoreContext,
  spot: Spot,
  updatedAt: string,
): Promise<Spot> {
  const next: Spot = { ...spot, checkinCount: spot.checkinCount + 1, updatedAt }
  await putSpot(ctx, next)
  return next
}

/**
 * アンケートの回答を集計へ足す（FR-12・FR-06-2）。
 *
 * ★ 加算（atomic increment）が無いので、読んだ値に足して書き戻す。同時に回答されると
 * 取りこぼしうるが、**取りこぼしは「まだ検証済みにならない」側に倒れる**。
 * 閾値へ届くのが遅れるだけで、届いていない項目を検証済みと見せることはない。
 * 安全側であることを確認したうえでこの形にしている。
 *
 * ★ 呼ぶ前に「この人が未回答であること」を確かめること。ここは数えるだけで、
 * 二重に数えない責任は呼び出し側（survey-service）にある。
 */
export async function addSurveyAnswers(
  ctx: DataStoreContext,
  spot: Spot,
  stats: SurveyStats,
  updatedAt: string,
): Promise<Spot> {
  const next: Spot = { ...spot, surveyStats: stats, updatedAt }
  await putSpot(ctx, next)
  return next
}

/**
 * スポットを1件消す（管理用）。
 *
 * ★ 一括削除は無いので1件ずつになる。**削除もアクセス数を消費する**（制約 E4）ため、
 * 入れ直しのたびに全消しするより、`areaId` を変えてパーティションを分ける方が安い。
 * それでも「消す」経路が無いと後戻りできないので用意しておく。
 */
export async function deleteSpot(
  ctx: DataStoreContext,
  areaId: AreaId,
  spotId: SpotId,
): Promise<void> {
  const tableId = ctx.tableId('spots')
  await runOp('deleteItem', () =>
    ctx.client.deleteItem({
      tableId,
      key: { [SPOTS_MAIN_KEY]: areaKey(areaId), [SPOTS_SUB_KEY]: spotId },
    }),
  )
}
