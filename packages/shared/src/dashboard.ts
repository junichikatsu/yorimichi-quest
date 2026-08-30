import { chomeRecordCounts, type ChomeRecordCount } from './chome.js'
import { SPOT_CATEGORIES, SPOT_CATEGORY_LABELS, type Spot, type SpotCategory } from './spot.js'
import { consensusOf, DEFAULT_SURVEY_CONSENSUS, intentOf, surveyFormFor } from './survey.js'

/**
 * 行政還元ダッシュボードの集計（FR-09・FR-12-5）。
 *
 * ★ **純関数だけで作る。** データストアもリクエストも知らない。ここに出る数字は
 * 提出物 2-4 とスライド3の主張そのものなので、「どう数えたか」をテストで固定
 * できる場所に置く必要がある。
 *
 * ★ **想定値を作らない。** 画面に出るのは取り込んだ実データと、実際に集まった
 * 回答だけである。まだ誰も答えていない項目は 0 のまま出す。0 を隠して見栄えを
 * 作ると「行政データにこれだけ穴がある」という主張自体が確かめられなくなる。
 * **穴の大きさがこの画面の主題である。**
 */

/* ------------------------------------------------------------------ *
 * 属性の空白（スライド3「まだ誰も埋めていない」の実測）
 * ------------------------------------------------------------------ */

/**
 * 設問1件ぶんの充填状況。**スポット単位で数える。**
 *
 * ★ `verified` と `verifiedFill` を分けているのは、二重に数えないためである。
 * 行政データに記載がある項目を市民が確かめた場合、それは「新しく埋まった」の
 * ではなく「確かめられた」である。充填率の分子に入れると 100% を超える。
 */
export interface FieldCoverage {
  fieldKey: string
  question: string
  /** 行政データに記載があるスポット数（＝現地で「確かめる」側） */
  coveredByOpenData: number
  /** 行政データが空のスポット数（＝現地で「埋める」側） */
  blank: number
  /** 市民の回答が閾値に達したスポット数（FR-06-2）。確かめる側も含む */
  verified: number
  /** うち、行政データが空だったもの。**充填率の分子はこちら** */
  verifiedFill: number
  /** 回答はあるが閾値未満。**まだ公開データにしない** */
  reported: number
}

export interface CategoryCoverage {
  category: SpotCategory
  label: string
  spotCount: number
  /**
   * 属性が1件も無いスポット数。
   *
   * ★ これが提出物の「ミクロデータが不足」の実測値である。行政データが名称と
   * 位置しか持たないスポットの数で、AED は取り込んだ全件がここに入る。
   */
  spotsWithNoAttributes: number
  /** 設問数 × スポット数。「埋めうる項目」の総数 */
  slotTotal: number
  /** そのうち行政データが埋めているもの */
  slotCoveredByOpenData: number
  /** そのうち市民の回答で新たに埋まったもの */
  slotVerified: number
  /** どちらでもない＝**まだ誰も埋めていない** */
  slotBlank: number
  fields: FieldCoverage[]
}

export interface CoverageSummary {
  spotCount: number
  /** 属性が1件も無いスポット数（全カテゴリ合計） */
  spotsWithNoAttributes: number
  slotTotal: number
  slotCoveredByOpenData: number
  slotVerified: number
  slotBlank: number
  categories: CategoryCoverage[]
}

/**
 * カテゴリごとの充填状況を数える（FR-12-5）。
 *
 * ★ 「スロット」は**スポット×設問**である。避難所72件に3問なら216スロット。
 * 件数だけで語ると「AED を224件も取り込んだ」に見えるが、中身は 672 スロット
 * すべてが空である。**この画面が見せたいのはそちらである。**
 */
export function coverageOf(
  spots: readonly Spot[],
  threshold: number = DEFAULT_SURVEY_CONSENSUS,
): CoverageSummary {
  const categories: CategoryCoverage[] = []

  for (const category of SPOT_CATEGORIES) {
    const inCategory = spots.filter((spot) => spot.category === category)
    const form = surveyFormFor(category)

    const fields: FieldCoverage[] = form.fields.map((field) => {
      let coveredByOpenData = 0
      let verified = 0
      let verifiedFill = 0
      let reported = 0

      for (const spot of inCategory) {
        const covered = intentOf(field, spot) === 'verify'
        if (covered) coveredByOpenData += 1

        const status = consensusOf(spot.surveyStats, field.fieldKey, threshold).status
        if (status === 'verified') {
          verified += 1
          if (!covered) verifiedFill += 1
        } else if (status === 'reported') {
          reported += 1
        }
      }

      return {
        fieldKey: field.fieldKey,
        question: field.question,
        coveredByOpenData,
        blank: inCategory.length - coveredByOpenData,
        verified,
        verifiedFill,
        reported,
      }
    })

    const slotTotal = inCategory.length * form.fields.length
    const slotCoveredByOpenData = fields.reduce((sum, f) => sum + f.coveredByOpenData, 0)
    const slotVerified = fields.reduce((sum, f) => sum + f.verifiedFill, 0)

    categories.push({
      category,
      label: SPOT_CATEGORY_LABELS[category],
      spotCount: inCategory.length,
      spotsWithNoAttributes: inCategory.filter((spot) => spot.attributes.length === 0).length,
      slotTotal,
      slotCoveredByOpenData,
      slotVerified,
      slotBlank: slotTotal - slotCoveredByOpenData - slotVerified,
      fields,
    })
  }

  const sum = (pick: (c: CategoryCoverage) => number): number =>
    categories.reduce((total, c) => total + pick(c), 0)

  return {
    spotCount: spots.length,
    spotsWithNoAttributes: sum((c) => c.spotsWithNoAttributes),
    slotTotal: sum((c) => c.slotTotal),
    slotCoveredByOpenData: sum((c) => c.slotCoveredByOpenData),
    slotVerified: sum((c) => c.slotVerified),
    slotBlank: sum((c) => c.slotBlank),
    categories,
  }
}

/* ------------------------------------------------------------------ *
 * 集まり具合（実測のみ）
 * ------------------------------------------------------------------ */

export interface CollectionStatus {
  /** チェックインの延べ回数（スポット側の事前計算値の合計） */
  checkinCount: number
  /** アンケートの回答が1件でもあるスポット数 */
  spotsWithAnswers: number
  /** 回答の延べ件数（項目単位） */
  answerCount: number
  /** 閾値に達した項目の数（＝CSVに出せる項目の数） */
  verifiedFieldCount: number
  /** 回答はあるが閾値未満の項目の数 */
  reportedFieldCount: number
}

/**
 * いま実際に集まっているもの。
 *
 * ★ **参加者数は数えない。** スポット側に人の情報を持っていないので、ここから
 * 出せるのは行動の回数だけである。出せない数字を推定で埋めない。
 */
export function collectionStatusOf(
  spots: readonly Spot[],
  threshold: number = DEFAULT_SURVEY_CONSENSUS,
): CollectionStatus {
  let checkinCount = 0
  let spotsWithAnswers = 0
  let answerCount = 0
  let verifiedFieldCount = 0
  let reportedFieldCount = 0

  for (const spot of spots) {
    checkinCount += spot.checkinCount

    let hasAnswer = false
    for (const field of surveyFormFor(spot.category).fields) {
      const consensus = consensusOf(spot.surveyStats, field.fieldKey, threshold)
      const total = consensus.tally.yes + consensus.tally.no + consensus.tally.unknown
      if (total > 0) hasAnswer = true
      answerCount += total
      if (consensus.status === 'verified') verifiedFieldCount += 1
      else if (consensus.status === 'reported') reportedFieldCount += 1
    }
    if (hasAnswer) spotsWithAnswers += 1
  }

  return { checkinCount, spotsWithAnswers, answerCount, verifiedFieldCount, reportedFieldCount }
}

/* ------------------------------------------------------------------ *
 * 画面へ渡す一式
 * ------------------------------------------------------------------ */

/** 町丁目の1行（FR-09-8）。**危険度としては出さない** */
export interface ChomeRow {
  code: string
  ward: string
  name: string
  population: number
  total: number
  counts: Record<SpotCategory, number>
}

export interface DashboardSummary {
  /** 集計した時刻（ISO8601）。画面に「いつ時点か」を出すため */
  generatedAt: string
  areaName: string
  coverage: CoverageSummary
  collection: CollectionStatus
  /** 記録のある町丁目の数。**0件の町丁目は含めない**（FR-09-8） */
  chomeWithRecords: number
  /** 上位のみ。全件は CSV で出す */
  chomeTop: ChomeRow[]
  /** 合意の閾値（FR-06-2）。画面の断り書きに出す */
  consensusThreshold: number
}

export function chomeRowsOf(spots: readonly Spot[]): ChomeRow[] {
  return chomeRecordCounts(spots).map((entry: ChomeRecordCount) => ({
    code: entry.chome.code,
    ward: entry.chome.ward,
    name: entry.chome.name,
    population: entry.chome.population,
    total: entry.total,
    counts: entry.counts,
  }))
}

export function buildDashboardSummary(input: {
  spots: readonly Spot[]
  areaName: string
  generatedAt: string
  chomeTopLimit: number
  threshold?: number
}): DashboardSummary {
  const threshold = input.threshold ?? DEFAULT_SURVEY_CONSENSUS
  const chomeRows = chomeRowsOf(input.spots)

  return {
    generatedAt: input.generatedAt,
    areaName: input.areaName,
    coverage: coverageOf(input.spots, threshold),
    collection: collectionStatusOf(input.spots, threshold),
    chomeWithRecords: chomeRows.length,
    chomeTop: chomeRows.slice(0, input.chomeTopLimit),
    consensusThreshold: threshold,
  }
}
