/**
 * 識別子。
 *
 * ブランド型にして、素の string を取り違えないようにする。
 * 生成はしない（外から来た値を検証して受け入れるだけ）。
 */

declare const brand: unique symbol

export type UserId = string & { readonly [brand]: 'UserId' }
export type SpotId = string & { readonly [brand]: 'SpotId' }
export type AreaId = string & { readonly [brand]: 'AreaId' }

/**
 * ★ ユーザーIDは LINE の userId（IDトークンの sub）そのものである。
 *
 * 自前で採番しない。LINE 側の値をそのまま主キーにすることで、
 * 「同じ人が二重に登録される」経路を原理的に作らない（FR-01-1）。
 *
 * 形式は `U` + 32 桁の 16 進数。LINE の仕様に合わせてここで固定する。
 */
export const USER_ID_PATTERN = /^U[0-9a-f]{32}$/
/** 取込スクリプトが `<出典>-<ハッシュ>` で作る（FR-10-2） */
export const SPOT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/
export const AREA_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/

export function isUserId(value: string): value is UserId {
  return USER_ID_PATTERN.test(value)
}

export function isSpotId(value: string): value is SpotId {
  return SPOT_ID_PATTERN.test(value)
}

export function isAreaId(value: string): value is AreaId {
  return AREA_ID_PATTERN.test(value)
}

export function asUserId(value: string): UserId {
  if (!isUserId(value)) throw new Error('invalid user id')
  return value
}

export function asSpotId(value: string): SpotId {
  if (!isSpotId(value)) throw new Error('invalid spot id')
  return value
}

export function asAreaId(value: string): AreaId {
  if (!isAreaId(value)) throw new Error('invalid area id')
  return value
}
