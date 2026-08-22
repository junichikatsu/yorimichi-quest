import type { AreaId, SpotId } from './ids.js'
import type { SurveyStats } from './survey.js'

/** FR-02-1 のカテゴリ。取込対象（FR-10-1）に合わせて4種を扱う。 */
export const SPOT_CATEGORIES = ['shelter', 'aed', 'accessible_toilet', 'water'] as const

export type SpotCategory = (typeof SPOT_CATEGORIES)[number]

export const SPOT_CATEGORY_LABELS: Record<SpotCategory, string> = {
  shelter: '避難所・避難場所',
  aed: 'AED',
  accessible_toilet: 'バリアフリートイレ',
  water: '給水スポット',
}

/** 地図マーカーと一覧で共有する配色。片方だけ変えると対応が崩れるので1か所に置く */
export const SPOT_CATEGORY_COLORS: Record<SpotCategory, string> = {
  shelter: '#2f6f3e',
  aed: '#c0392b',
  accessible_toilet: '#2d6ca2',
  water: '#1f8a8a',
}

/**
 * マーカーに描く1文字。
 *
 * 絵文字ではなく漢字にしているのは、環境による字形の差が出にくく、
 * シニアでも意味が取れるため（NFR-08）。
 */
export const SPOT_CATEGORY_GLYPHS: Record<SpotCategory, string> = {
  shelter: '避',
  aed: '＋',
  accessible_toilet: 'WC',
  water: '水',
}

export interface Spot {
  spotId: SpotId
  areaId: AreaId
  name: string
  category: SpotCategory
  lat: number
  lng: number
  address: string
  /** バリアフリー属性などのタグ。サンプルでは固定値（AI 解析は対象外） */
  attributes: string[]
  /** 出典。サンプルデータは 'sample-fixture' */
  source: string
  /** 出典の取得日（FR-10-2） */
  fetchedAt: string
  /** 集計機能が無いため書き込み時に事前計算する（E2 対応） */
  checkinCount: number
  /**
   * 現地確認アンケートの集計（FR-12・FR-06-2）。
   *
   * ★ `checkinCount` と同じく**書き込み時に事前計算する**（制約 E2：データストアに
   * 集計関数が無い）。回答のたびに全員ぶんを数え直すことはできない。
   *
   * ★ 個々の回答者は入れない。ここに置くのは項目ごとの件数だけである
   * （誰がどう答えたかは `user_spot_state` の本人の行にしか無い）。
   */
  surveyStats: SurveyStats
  updatedAt: string
}

export interface SpotWithDistance extends Spot {
  /** 現在地からの距離（m）。現在地未指定なら null */
  distanceM: number | null
}

export interface AreaSummary {
  areaId: AreaId
  name: string
  center: { lat: number; lng: number }
  zoom: number
}
