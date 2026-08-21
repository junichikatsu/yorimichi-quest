import { SPOT_CATEGORY_LABELS, type SpotCategory, type SpotWithDistance } from '@imanouchi/shared'

/**
 * 有事モード（FR-08）で出すライフラインの選び方。
 *
 * ★ 判定を純粋な関数に切り出してある。**「属性が空欄のスポットを非対応として
 * 扱わない」ことをテストで固定したい**ため。オープンデータの空欄は
 * 「設備が無い」ではなく「未記入」であり、ここを取り違えると
 * 「バリアフリー対応の避難所が無い」と誤って見せることになる。
 */

/**
 * 有事に見せるカテゴリの順番。
 *
 * ★ 距離順で全体を並べてはいけない。AED が 224 件あるため、近い順に並べると
 * 上位が AED で埋まり、**避難所が画面から消える**。まず身を寄せる場所、次に水、
 * という順で「カテゴリごとに近いもの」を出す。
 */
export const LIFELINE_ORDER: readonly SpotCategory[] = [
  'shelter',
  'water',
  'accessible_toilet',
  'aed',
]

/**
 * バリアフリーの記載があるか（FR-08-4）。
 *
 * ★ 記載が無いことを「非対応」と読まない。オープンデータの属性は未記入が多く
 * （4カテゴリ 370 件のうち 232 件が空欄）、空欄を非対応として弾くと
 * **実際には対応している施設まで消える**。この絞り込みは「記載があるものだけを見る」
 * という操作であって、対応・非対応の判定ではない。
 */
export function hasAccessibilityNote(spot: SpotWithDistance): boolean {
  return spot.attributes.some((attribute) => ACCESSIBILITY_HINTS.some((hint) => attribute.includes(hint)))
}

/** 取込済みデータに実在する表記から採っている（tools/ingest 由来） */
const ACCESSIBILITY_HINTS = [
  '車椅子',
  '車いす',
  'スロープ',
  'エレベーター',
  'バリアフリー',
  '点字',
  'オストメイト',
  '自動ドア',
]

export interface LifelineGroup {
  category: SpotCategory
  label: string
  spots: SpotWithDistance[]
  /** 絞り込みで隠れた件数。黙って減らさないために持つ */
  hiddenByFilter: number
}

export interface LifelineOptions {
  /** カテゴリごとに出す件数 */
  perCategory: number
  /** バリアフリーの記載があるものだけに絞るか（FR-08-4） */
  accessibleOnly: boolean
}

/**
 * カテゴリごとに近いスポットを集める。
 *
 * 距離が未計算（現在地が無い）ときも順番だけは保って返す。
 * 有事に「現在地が取れないから何も出ない」のは最悪の失敗である。
 */
export function lifelineGroups(
  spots: readonly SpotWithDistance[],
  options: LifelineOptions,
): LifelineGroup[] {
  return LIFELINE_ORDER.map((category) => {
    const inCategory = spots.filter((spot) => spot.category === category)
    const matched = options.accessibleOnly ? inCategory.filter(hasAccessibilityNote) : inCategory

    const sorted = [...matched].sort(
      (a, b) => (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY),
    )

    return {
      category,
      label: SPOT_CATEGORY_LABELS[category],
      spots: sorted.slice(0, options.perCategory),
      hiddenByFilter: inCategory.length - matched.length,
    }
  })
}
