import { SPOT_CATEGORY_LABELS, type Spot } from './spot.js'
import {
  consensusOf,
  DEFAULT_SURVEY_CONSENSUS,
  intentOf,
  surveyFormFor,
  type SurveyField,
  type SurveyValue,
} from './survey.js'

/**
 * 行政へ返す CSV（FR-09-4）。
 *
 * ★ 提出物 2-3・2-5 とスライド8で「自治体標準オープンデータセット準拠の CSV で
 * 行政へ還元する」と書いた、その出力である。**言い切った以上、実際に落とせる
 * 必要がある。**
 *
 * ★ 列名の根拠は**取り込んだ側にある。** 千代田区の公衆便所一覧
 * （`131016_13public_toilet.csv`）は自治体標準オープンデータセット準拠で公開されて
 * おり、`名称` `所在地_市区町村` `所在地_連結表記` `緯度` `経度` という列名を持つ。
 * 取り込んだ列名をそのまま返す形にしてある。**仕様書を推測で写していない。**
 * （デジタル庁のデータ項目定義書との全列突合は未実施。opendata-sources.md の
 * 「列定義の突合」が未チェックのままであることと揃えてある）
 *
 * ★ **検証済みの値しか出さない**（FR-09-7）。1人の回答は出さない。行政が受け取った
 * ものをそのまま公開したときに、現地と食い違うことが最も避けたい失敗である。
 */

/* ------------------------------------------------------------------ *
 * CSV の組み立て
 * ------------------------------------------------------------------ */

/**
 * 1セルを CSV に落とす。
 *
 * ★ 引用符・カンマ・改行のどれかを含むなら囲む。自由記述（見つけ方）に読点も
 * 改行も入りうるので、囲まないと**列がずれた CSV を行政へ渡すことになる。**
 */
function cell(value: string | number): string {
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const lines = [header.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))]
  /*
   * ★ CRLF と BOM を付ける。
   *
   * 受け取るのは自治体の担当者で、開くのはたいてい Excel である。BOM が無いと
   * 施設名が文字化けし、**中身を見る前に「使えない」と判断される。**
   */
  return `\ufeff${lines.join('\r\n')}\r\n`
}

/** 回答の値を、設問の言葉に戻す。「はい／いいえ」のままでは後から読めない */
function labelOf(field: SurveyField, value: SurveyValue): string {
  if (value === 'yes') return field.yesLabel
  if (value === 'no') return field.noLabel
  return 'わからない'
}

/* ------------------------------------------------------------------ *
 * 検証済みデータ（FR-09-4）
 * ------------------------------------------------------------------ */

const VERIFIED_HEADER = [
  '名称',
  '種別',
  '所在地_市区町村',
  '所在地_連結表記',
  '緯度',
  '経度',
  '項目',
  '設問',
  '値',
  '検証状況',
  '賛成件数',
  '反対件数',
  '不明件数',
  '出典',
  '出典_取得日',
] as const

export interface CsvBuildOptions {
  threshold?: number
}

/**
 * 検証済みの項目だけを書き出す。
 *
 * ★ **1項目1行にしてある。** スポット1行に全項目を横へ並べる形にすると、
 * 検証済みの項目と未取得の項目が同じ行に混ざり、受け取った側が「空欄は設備が
 * 無いのか、まだ誰も見ていないのか」を判別できない。**このサービスが壊しては
 * いけない区別がそこにある**（FR-12-7 と同じ理由）。
 *
 * ★ 出典は市民の回答であることを明示する。行政データの値をそのまま返しては
 * いない（それは元から公開されている）。
 */
export function buildVerifiedCsv(spots: readonly Spot[], options: CsvBuildOptions = {}): string {
  const threshold = options.threshold ?? DEFAULT_SURVEY_CONSENSUS
  const rows: (string | number)[][] = []

  for (const spot of spots) {
    for (const field of surveyFormFor(spot.category).fields) {
      const consensus = consensusOf(spot.surveyStats, field.fieldKey, threshold)
      if (consensus.status !== 'verified' || consensus.value === undefined) continue

      rows.push([
        spot.name,
        SPOT_CATEGORY_LABELS[spot.category],
        wardOf(spot.address),
        spot.address,
        spot.lat,
        spot.lng,
        field.fieldKey,
        field.question,
        labelOf(field, consensus.value),
        `検証済み（${threshold}件以上の一致）`,
        consensus.tally.yes,
        consensus.tally.no,
        consensus.tally.unknown,
        '市民の現地確認アンケート（イマノウチ・ヨリミチ）',
        spot.updatedAt.slice(0, 10),
      ])
    }
  }

  return toCsv(VERIFIED_HEADER, rows)
}

/* ------------------------------------------------------------------ *
 * 未取得項目の一覧（現地調査の割り当てに使う）
 * ------------------------------------------------------------------ */

const GAP_HEADER = [
  '名称',
  '種別',
  '所在地_市区町村',
  '所在地_連結表記',
  '緯度',
  '経度',
  '項目',
  '設問',
  '状態',
  '行政データの記載',
  'これまでの回答件数',
] as const

/**
 * まだ埋まっていない項目を書き出す。
 *
 * ★ **こちらが現時点の主要な成果物である。** 検証済みは収集が始まるまで 0 行に
 * なるが、未取得の一覧はいまこの瞬間に意味がある。「どこに何が足りないか」を
 * 行政がそのまま現地調査の割り当てに使える形にしてある（FR-09-3）。
 *
 * ★ 状態は3つに分ける。**「未取得」と「回答はあるが未確定」を潰さない。**
 * 潰すと、あと1件で確定する項目と誰も見ていない項目が同じに見える。
 */
export function buildGapCsv(spots: readonly Spot[], options: CsvBuildOptions = {}): string {
  const threshold = options.threshold ?? DEFAULT_SURVEY_CONSENSUS
  const rows: (string | number)[][] = []

  for (const spot of spots) {
    for (const field of surveyFormFor(spot.category).fields) {
      const consensus = consensusOf(spot.surveyStats, field.fieldKey, threshold)
      if (consensus.status === 'verified') continue

      const tally = consensus.tally
      rows.push([
        spot.name,
        SPOT_CATEGORY_LABELS[spot.category],
        wardOf(spot.address),
        spot.address,
        spot.lat,
        spot.lng,
        field.fieldKey,
        field.question,
        consensus.status === 'reported'
          ? `回答はあるが未確定（あと${Math.max(1, threshold - Math.max(tally.yes, tally.no))}件で確定）`
          : '未取得',
        intentOf(field, spot) === 'verify' ? '記載あり（確かめる）' : '記載なし（埋める）',
        tally.yes + tally.no + tally.unknown,
      ])
    }
  }

  return toCsv(GAP_HEADER, rows)
}

/* ------------------------------------------------------------------ *
 * 町丁目ごとの記録件数（FR-09-8）
 * ------------------------------------------------------------------ */

const CHOME_HEADER = [
  '小地域コード',
  '市区町村',
  '町丁目',
  '人口',
  '記録件数',
  '避難所',
  'AED',
  'バリアフリートイレ',
  '給水スポット',
] as const

/**
 * 町丁目ごとの記録件数。
 *
 * ★ **人口あたりの比を計算した列は作らない**（FR-09-8）。列にすると受け取った側が
 * そのまま地図に塗る。件数の少なさは設備の少なさではなく、**まだ歩かれていない
 * ことを表しているだけ**である。並べ替えの材料までを渡し、解釈は渡さない。
 */
export function buildChomeCsv(
  rows: readonly {
    code: string
    ward: string
    name: string
    population: number
    total: number
    counts: Record<string, number>
  }[],
): string {
  return toCsv(
    CHOME_HEADER,
    rows.map((row) => [
      row.code,
      row.ward,
      row.name,
      row.population,
      row.total,
      row.counts.shelter ?? 0,
      row.counts.aed ?? 0,
      row.counts.accessible_toilet ?? 0,
      row.counts.water ?? 0,
    ]),
  )
}

/* ------------------------------------------------------------------ *
 * 補助
 * ------------------------------------------------------------------ */

/**
 * 住所から市区町村を切り出す。
 *
 * ★ 取り込んだ住所の表記は出典ごとに違い（「東京都港区…」と「港区…」が混在する）、
 * スポット側に市区町村の列を持っていない。**取れなければ空にする。**
 * 推測で埋めると、間違った自治体の名前が付いた行を行政へ渡すことになる。
 */
export function wardOf(address: string): string {
  const match = /([^\s都道府県]+?[区市町村])/.exec(address.replace(/^東京都/, ''))
  return match?.[1] ?? ''
}
