import { z } from 'zod'

/**
 * アバター（キャラメイク）の定義。
 *
 * 見た目のパラメータは「配列のインデックス」で保持する。
 * 色コードや名称をそのまま保存すると、後からパレットを差し替えたときに
 * 保存済みデータが古い色のまま取り残される。
 */

export const HAIR_COLORS = [
  '#2b2730',
  '#5a3b25',
  '#c8912f',
  '#e6ddc9',
  '#8a3f3f',
  '#3f6f8a',
  '#7a4f8a',
  '#d2694a',
] as const

export const CLOTH_COLORS = [
  '#c8503f',
  '#3f7fbf',
  '#2f9e6f',
  '#e0b24a',
  '#8a5fbf',
  '#dd8fae',
  '#4a5170',
  '#e6e0d2',
] as const

export const SKIN_COLORS = ['#f6d2ab', '#e7b487', '#c88f5f', '#96633f'] as const

/**
 * 髪型。
 *
 * ★ **絵が描けるものだけを並べる。** 16×20 のドット絵では髪に使える面積が
 * 頭の上4行しかなく、「スパイキー」「くるくる」のような細かい差は表現できない。
 * 選べるのに見た目が変わらない選択肢は、あるだけで不信を招く。
 * 絵は `avatar-art.ts` の `AVATAR_HAIR` と**この順番で対応する**。
 */
export const HAIR_NAMES = [
  'ショート',
  'ロング',
  'ツインテール',
  'ボブ',
  'キャップ',
  'はちまき',
] as const

/**
 * 服。
 *
 * ★ 髪型と同じ理由で、**胴の4行で差が出るものだけ**にしてある。
 * 絵は `avatar-art.ts` の `AVATAR_CLOTH` と**この順番で対応する**。
 */
export const CLOTH_NAMES = [
  'Tシャツ',
  '縞シャツ',
  'パーカー',
  'レインコート',
  '防災ベスト',
  'ワンピース',
] as const

export const AVATAR_NAME_MAX_LENGTH = 12

export interface Avatar {
  /** HAIR_NAMES のインデックス */
  hair: number
  /** CLOTH_NAMES のインデックス */
  cloth: number
  /** HAIR_COLORS のインデックス */
  hairColor: number
  /** CLOTH_COLORS のインデックス */
  clothColor: number
  /** SKIN_COLORS のインデックス */
  skin: number
  name: string
}

export const DEFAULT_AVATAR: Avatar = {
  hair: 0,
  cloth: 1,
  hairColor: 0,
  clothColor: 1,
  skin: 0,
  name: 'ヨリ',
}

export const avatarSchema = z.object({
  hair: z.number().int().min(0).max(HAIR_NAMES.length - 1),
  cloth: z.number().int().min(0).max(CLOTH_NAMES.length - 1),
  hairColor: z.number().int().min(0).max(HAIR_COLORS.length - 1),
  clothColor: z.number().int().min(0).max(CLOTH_COLORS.length - 1),
  skin: z.number().int().min(0).max(SKIN_COLORS.length - 1),
  name: z.string().trim().min(1).max(AVATAR_NAME_MAX_LENGTH),
})

/**
 * 保存済みの値を安全側へ寄せる。
 *
 * パレットを縮めた場合など、範囲外のインデックスが残っていても
 * 描画時に undefined を掴んで落ちないようにするための保険。
 */
export function normalizeAvatar(value: unknown): Avatar {
  const parsed = avatarSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_AVATAR
}
