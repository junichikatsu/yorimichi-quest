import { z } from 'zod'
import type { CardView } from './card.js'
import type { SpotId } from './ids.js'
import { SPOT_CATEGORIES, type Spot, type SpotCategory } from './spot.js'

/**
 * スポットの現地確認アンケート（FR-12）＝ **データ辞書**（FR-12-1）。
 *
 * ★ これがこのサービスの収集の実体である。チェックイン（FR-03）とクイズ（FR-04）は
 * どちらも**行政データを1件も増やさない**。要点 P-1（行政データの不足を補う）と
 * 競争優位 UA-1（超低コストのデータ収集）を名乗る根拠は、この設問群だけが持つ。
 *
 * ★ 設問は**行政オープンデータに無い項目**に限る（FR-12 の原則）。取込済み 370 件の
 * 属性を数えた結果が設計の根拠である：
 *
 * | カテゴリ | 件数 | 行政データの属性 | ここで問うこと |
 * | :--- | ---: | :--- | :--- |
 * | AED | 224 | **1件も無い** | 埋める（設置階・屋内外・入れる時間・目印） |
 * | 避難所 | 72 | オストメイト設備の記載は 10 件だけ | 残り 62 件は「無い」ではなく**不明** |
 * | バリアフリートイレ | 36 | オストメイト対応 32 件 | 記載を**現地で確かめる** |
 * | 給水スポット | 38 | 「設置場所：ホーム」止まり | 見つけ方まで絞り込む |
 *
 * ★ **選択肢は3値である（はい／いいえ／わからない）。真偽値にしてはいけない。**
 * 2値にすると「無い」と「見ていない」が同じ値に潰れる。オストメイト設備が
 * 「無い」という誤りが公開データに載れば、それを見た人が現地で行き詰まる。
 * 空欄は「設備が無い」ではなく「未記入」である、というこのサービスの前提
 * （画面の断り書きにも書いてある）を、収集側で壊さないための3値である。
 */

/* ------------------------------------------------------------------ *
 * 回答の値
 * ------------------------------------------------------------------ */

export const SURVEY_VALUES = ['yes', 'no', 'unknown'] as const

export type SurveyValue = (typeof SURVEY_VALUES)[number]

export function isSurveyValue(value: string): value is SurveyValue {
  return (SURVEY_VALUES as readonly string[]).includes(value)
}

/* ------------------------------------------------------------------ *
 * 設問の定義
 * ------------------------------------------------------------------ */

/**
 * 設問1件。
 *
 * ★ `yesLabel` / `noLabel` を持たせているのは、「はい／いいえ」では**何を答えたのか
 * 後から読めない**ため。「屋内」「屋外」のように現物の言葉で置くと、回答の記録
 * （オープンデータとして出す側）がそのまま読める。
 */
export interface SurveyField {
  /** 記録のキー。データストアの列名に混ぜるので `[a-z][a-z0-9_]*` に限る */
  fieldKey: string
  /** 現地で目を上げれば答えられる問い。歩きながら読める長さにする */
  question: string
  yesLabel: string
  noLabel: string
  /**
   * 行政データに同じ意味の記載があるかを見分ける手がかり。
   *
   * ★ ここに書いた語が `spot.attributes` に含まれていれば「台帳に記載あり」＝
   * **確かめる設問**、含まれなければ「未記入」＝**埋める設問**として扱う（FR-12-2）。
   * 空配列は「行政データにそもそも無い項目」で、常に埋める側になる。
   */
  attributeHints: readonly string[]
  /** なぜ聞くのか。画面に小さく添える。「答えさせられている」感を減らすため */
  why: string
}

export interface SurveyForm {
  category: SpotCategory
  /** 設問群の見出し */
  title: string
  fields: readonly SurveyField[]
  /** 自由記述の問い。**選択肢では拾えない「見つけ方」を受ける** */
  notePlaceholder: string
}

/**
 * 自由記述の上限（文字数）。
 *
 * ★ 短くしてある。長文は個人名・私見・苦情が混ざりやすく、**そのままでは
 * オープンデータとして出せない**（写真には FR-05-4／FR-05-6 の保留があるのに、
 * 自由文に同じ守りが無いのは穴である）。ここで受けるのは「改札を出て右」程度の
 * 見つけ方に限る、という意思を上限で表している。
 */
export const SURVEY_NOTE_MAX_LENGTH = 120

/**
 * データ辞書（FR-12-1）。#14 の一次確定ぶん。
 *
 * ★ 1カテゴリ3問に抑えている。現地で立ち止まって答えるものなので（FR-02-9 により
 * 歩行中は操作を止める）、**タップ3回＋任意の一言**で終わる量を超えさせない。
 */
export const SURVEY_FORMS: Record<SpotCategory, SurveyForm> = {
  aed: {
    category: 'aed',
    title: 'このAEDの「行き方」を教えてください',
    /*
     * ★ AED は取込済み 224 件すべてで属性が空である。行政データは設置場所の
     * 住所しか持たず、**駆け込んだ人が実際に手に取れるかどうかが分からない。**
     * 3問すべてが「埋める」側になる。
     */
    fields: [
      {
        fieldKey: 'indoor',
        question: 'AEDは建物の中にありますか？',
        yesLabel: '建物の中',
        noLabel: '屋外・外から取れる',
        attributeHints: [],
        why: '屋外なら夜中でも取りに行けます',
      },
      {
        fieldKey: 'always_open',
        question: 'いつでも入れる場所ですか？',
        yesLabel: 'いつでも入れる',
        noLabel: '閉まる時間がある',
        attributeHints: [],
        why: '倒れた人が出るのは日中だけではありません',
      },
      {
        fieldKey: 'visible_from_entrance',
        question: '入口から見える場所にありますか？',
        yesLabel: '入口から見える',
        noLabel: '奥・見えない',
        attributeHints: [],
        why: '探す時間がそのまま助かる確率を下げます',
      },
    ],
    notePlaceholder: '目印になるもの（例：受付の右手、自販機の隣）',
  },

  shelter: {
    category: 'shelter',
    title: 'この避難所について教えてください',
    fields: [
      {
        fieldKey: 'step_free',
        question: '入口まで段差なしで入れますか？',
        yesLabel: '段差なしで入れる',
        noLabel: '段差がある',
        // 台帳に「スロープ等」の記載がある避難所は 46 件。あれば確かめる設問になる
        attributeHints: ['スロープ'],
        why: '車いす・ベビーカーが入れるかが分かります',
      },
      {
        fieldKey: 'ostomate',
        question: 'オストメイト対応の設備がありますか？',
        yesLabel: 'ある',
        noLabel: '見当たらない',
        // 記載は 72 件中 10 件だけ。残りは「無い」ではなく**不明**である
        attributeHints: ['オストメイト'],
        why: '記載が無い施設が62件あり、有無が誰にも分かっていません',
      },
      {
        fieldKey: 'pet_ok',
        question: 'ペット同伴について掲示がありますか？',
        yesLabel: '掲示がある',
        noLabel: '掲示は無い',
        // 行政データに項目そのものが無い。常に埋める側
        attributeHints: [],
        why: 'ペットを置いて避難できず、家に留まる人がいます',
      },
    ],
    notePlaceholder: '気づいたこと（例：入口は北側だけ開いている）',
  },

  accessible_toilet: {
    category: 'accessible_toilet',
    title: 'このトイレの中を教えてください',
    fields: [
      {
        fieldKey: 'ostomate',
        question: 'オストメイト設備は実際に使えますか？',
        yesLabel: '使える状態',
        noLabel: '無い・使えない',
        // 36 件中 32 件に記載がある。ここは「確かめる」側の代表
        attributeHints: ['オストメイト'],
        why: '台帳にある設備が、いま使える状態かは別の話です',
      },
      {
        fieldKey: 'wheelchair_turn',
        question: '車いすで向きを変えられる広さがありますか？',
        yesLabel: '向きを変えられる',
        noLabel: 'せまい',
        // 「バリアフリートイレ」という記載はあるが、広さの項目は行政データに無い
        attributeHints: [],
        why: '「バリアフリー」の表示だけでは、入れても出られません',
      },
      {
        fieldKey: 'handrail',
        question: '手すりがありますか？',
        yesLabel: 'ある',
        noLabel: '無い',
        attributeHints: [],
        why: '立ち座りができるかで、使えるかどうかが変わります',
      },
    ],
    notePlaceholder: '気づいたこと（例：入口の扉が手動で重い）',
  },

  water: {
    category: 'water',
    title: 'この給水スポットの使い方を教えてください',
    fields: [
      {
        fieldKey: 'bottle_fill',
        question: 'ボトルに直接入れられますか？',
        yesLabel: '入れられる',
        noLabel: '飲み口だけ',
        // 「ボトルディスペンサー型」の記載は 38 件中 4 件。残りは飲み口型の記載のみ
        attributeHints: ['ボトルディスペンサー'],
        why: '持ち帰れるかどうかで、断水時の使い方が変わります',
      },
      {
        fieldKey: 'reachable_seated',
        question: '座ったままの高さで使えますか？',
        yesLabel: '座ったまま使える',
        noLabel: '立たないと届かない',
        attributeHints: [],
        why: '車いすの人と子どもが使えるかが分かります',
      },
      {
        fieldKey: 'always_open',
        question: 'いつでも入れる場所ですか？',
        yesLabel: 'いつでも入れる',
        noLabel: '閉まる時間がある',
        attributeHints: [],
        why: '改札の内側だと、入場しないと使えません',
      },
    ],
    // 行政データは「設置場所：ホーム」止まりで、どのホームのどこかが分からない
    notePlaceholder: '見つけ方（例：改札を出て右、ホーム中央の柱）',
  },
}

export function surveyFormFor(category: SpotCategory): SurveyForm {
  return SURVEY_FORMS[category]
}

/** 全カテゴリぶんの設問（一覧・テスト用） */
export function allSurveyFields(): SurveyField[] {
  return SPOT_CATEGORIES.flatMap((category) => [...SURVEY_FORMS[category].fields])
}

/* ------------------------------------------------------------------ *
 * 充填状況の判定（FR-12-2）
 * ------------------------------------------------------------------ */

/**
 * その項目が、行政データで既に埋まっているか。
 *
 * ★ `attributeHints` が空なら常に「未記入」。行政データにその項目自体が無いので、
 * どんな属性が入っていても埋まったことにはならない。
 */
export function isCoveredByOpenData(field: SurveyField, spot: Pick<Spot, 'attributes'>): boolean {
  if (field.attributeHints.length === 0) return false
  return spot.attributes.some((attribute) =>
    field.attributeHints.some((hint) => attribute.includes(hint)),
  )
}

/**
 * 設問の役割（FR-12-2・FR-12-3）。
 *
 * - `fill`: 行政データが空。**埋めると新しい情報になる**
 * - `verify`: 行政データに記載がある。**現地で確かめる**（UA-2 の相互検証と同じ役割）
 */
export type SurveyIntent = 'fill' | 'verify'

export function intentOf(field: SurveyField, spot: Pick<Spot, 'attributes'>): SurveyIntent {
  return isCoveredByOpenData(field, spot) ? 'verify' : 'fill'
}

/** このスポットで「埋める」側になる設問の数。ポイント倍率に使う（FR-12-4） */
export function fillFieldCount(spot: Pick<Spot, 'attributes' | 'category'>): number {
  return surveyFormFor(spot.category).fields.filter((field) => intentOf(field, spot) === 'fill')
    .length
}

/* ------------------------------------------------------------------ *
 * 集計と合意（FR-06-2）
 * ------------------------------------------------------------------ */

/** 1項目ぶんの回答の集計。**「わからない」も数える**（不明であることも情報である） */
export interface SurveyTally {
  yes: number
  no: number
  unknown: number
}

/**
 * スポットに貯まった回答の集計。
 *
 * ★ **書き込み時に事前計算する**（`checkinCount` と同じ扱い・制約 E2）。
 * データストアに集計関数が無いため、回答のたびに数え直すことはできない。
 */
export type SurveyStats = Record<string, SurveyTally>

export const EMPTY_TALLY: SurveyTally = { yes: 0, no: 0, unknown: 0 }

export function tallyOf(stats: SurveyStats, fieldKey: string): SurveyTally {
  return stats[fieldKey] ?? EMPTY_TALLY
}

/**
 * 合意の既定値（FR-06-2 の「例：賛成2件」）。
 *
 * ★ **1人の回答を確定にしない。** 報酬つきのアンケートは必ず「適当に答えて報酬」を
 * 生む。同じ答えが独立して2人から出たときに初めて確定させる。これが競争優位 UA-2
 * （AI×群集心理の相互クイズ）の実体でもある。
 */
export const DEFAULT_SURVEY_CONSENSUS = 2

/**
 * 項目ごとの検証状況（FR-12-2 の「未取得／ユーザー確定／検証済み」）。
 *
 * - `empty`: 誰も答えていない
 * - `reported`: 回答はあるが閾値に届いていない。**まだ公開データにしない**
 * - `verified`: 閾値に達した。`value` が合意された答え
 */
export interface SurveyConsensus {
  status: 'empty' | 'reported' | 'verified'
  /** 合意された答え。`verified` 以外では undefined */
  value: SurveyValue | undefined
  tally: SurveyTally
}

/**
 * 合意を判定する。
 *
 * ★ 「わからない」では確定させない。**多数が「分からない」ことは、
 * 有無が確定したことではない。** 分かれたまま（`reported`）にして、
 * 次の人に答えてもらうほうが正しい。
 */
export function consensusOf(
  stats: SurveyStats,
  fieldKey: string,
  threshold: number = DEFAULT_SURVEY_CONSENSUS,
): SurveyConsensus {
  const tally = tallyOf(stats, fieldKey)
  const total = tally.yes + tally.no + tally.unknown
  if (total === 0) return { status: 'empty', value: undefined, tally }

  if (tally.yes >= threshold && tally.yes > tally.no) {
    return { status: 'verified', value: 'yes', tally }
  }
  if (tally.no >= threshold && tally.no > tally.yes) {
    return { status: 'verified', value: 'no', tally }
  }
  return { status: 'reported', value: undefined, tally }
}

/**
 * 回答を1件足した集計を返す（**元の値は変えない**）。
 *
 * ★ 純関数にしてあるのは、「同じ人が二重に数えられない」ことと「わからないも
 * 数える」ことをテストで固定したいため。データストアに atomic increment が
 * 無いので、読んだ値に足して書き戻す形になる。
 */
export function applyAnswers(
  stats: SurveyStats,
  answers: Readonly<Record<string, SurveyValue>>,
): SurveyStats {
  const next: SurveyStats = {}
  for (const [fieldKey, tally] of Object.entries(stats)) next[fieldKey] = { ...tally }

  for (const [fieldKey, value] of Object.entries(answers)) {
    const current = next[fieldKey] ?? { ...EMPTY_TALLY }
    next[fieldKey] = { ...current, [value]: current[value] + 1 }
  }

  return next
}

/* ------------------------------------------------------------------ *
 * HTTP の入出力
 * ------------------------------------------------------------------ */

/**
 * 回答の送信。
 *
 * ★ ポイントはサーバーが決める（NFR-04）。クライアントから点数や倍率を
 * 受け取ってはいけない。
 *
 * ★ `answers` は**部分回答を許す**。スキップできる設計（答えないと進めない形に
 * すると、歩行中モード・高齢者の利用で詰まる）なので、1問だけ答えて送ることも
 * ありうる。空でも受ける（「見たが分からなかった」は記録しない、という選択）。
 */
export const surveyAnswerRequestSchema = z.object({
  answers: z
    .record(
      z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
      z.enum(SURVEY_VALUES),
    )
    // 1スポットの設問数を超える数を送らせない
    .refine((value) => Object.keys(value).length <= 16, {
      message: '回答の数が多すぎます',
    }),
  /** 自由記述。空文字は「書かなかった」 */
  note: z.string().max(SURVEY_NOTE_MAX_LENGTH).optional(),
})

export type SurveyAnswerRequest = z.infer<typeof surveyAnswerRequestSchema>

/** 画面に出す設問1件（役割と、これまでの集計つき） */
export interface SurveyFieldView {
  fieldKey: string
  question: string
  yesLabel: string
  noLabel: string
  why: string
  /** 埋める設問か、確かめる設問か（FR-12-2） */
  intent: SurveyIntent
  /** これまでの合意状況。**回答の中身ではなく件数だけを出す** */
  consensus: SurveyConsensus
}

export interface SurveyResponse {
  spotId: SpotId
  spotName: string
  title: string
  fields: SurveyFieldView[]
  notePlaceholder: string
  noteMaxLength: number
  /**
   * すでに回答済みか。
   *
   * ★ 回答済みなら送信できない（1人1スポット1回）。同じ人が答え直せる形にすると、
   * 集計を差し引く処理が必要になり、**そこが報酬とスコアの操作口になる。**
   * 施設の変化は「別の人が答える」ことで追う（FR-06 の相互検証と同じ考え方）。
   */
  alreadyAnswered: boolean
  /** 自分の前回の回答（回答済みのときだけ）。読み取り専用で見せる */
  myAnswers: Record<string, SurveyValue>
  /** この回答で得られるポイント。**答えの中身では変わらない**（下の注記を参照） */
  pointsIfAnswered: number
}

export interface SurveyAnswerResponse {
  /**
   * 付与ポイント。
   *
   * ★ **答えの中身では変わらない。** 「はい／いいえ」に加点して「わからない」に
   * 加点しない形にすると、分からないのに断定する動機を作る。それは公開データの
   * 精度をそのまま落とす。倍率はスポット側の欠損数（FR-12-4）だけで決める。
   */
  pointsEarned: number
  totalPoints: number
  /** 何項目ぶん記録したか。画面の言葉（「3件の情報が増えました」）に使う */
  recordedCount: number
  /** この回答で新たに閾値へ達した項目のキー（FR-06-2）。演出に使う */
  verifiedFieldKeys: string[]
  /** 今回はじめて達成したカード（FR-14） */
  acquiredCards: CardView[]
  /** サーバーが保存したか。おためし（ゲスト）では false */
  saved: boolean
}
