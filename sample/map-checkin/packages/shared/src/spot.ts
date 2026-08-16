import type { AreaId, SpotId } from './ids.js'

/** 要件定義書 FR-02-1 のカテゴリ。サンプルでは4種のみ扱う。 */
export const SPOT_CATEGORIES = ['shelter', 'aed', 'accessible_toilet', 'water'] as const

export type SpotCategory = (typeof SPOT_CATEGORIES)[number]

export const SPOT_CATEGORY_LABELS: Record<SpotCategory, string> = {
  shelter: '避難所・避難場所',
  aed: 'AED',
  accessible_toilet: 'バリアフリートイレ',
  water: '給水スポット',
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
  updatedAt: string
}

export interface SpotWithDistance extends Spot {
  /** 現在地からの距離（m）。現在地未指定なら null */
  distanceM: number | null
  /** 未開拓ゾーン（FR-02-3） */
  unexplored: boolean
  /** ポイント倍率（FR-02-4） */
  pointMultiplier: number
}

export interface AreaSummary {
  areaId: AreaId
  name: string
  center: { lat: number; lng: number }
  zoom: number
}
