/**
 * ブランド型。
 *
 * リポジトリ層は生の string ではなくこれらの型だけを受け取る。
 * 文字列連結で組み立てたキーがコンパイルを通らなくなるため、
 * 「他人のデータに触れるキーを組み立ててしまう」実装ミスを型で防げる。
 */
declare const brand: unique symbol

export type Brand<T, B extends string> = T & { readonly [brand]: B }

export type AreaId = Brand<string, 'AreaId'>
export type SpotId = Brand<string, 'SpotId'>
export type UserId = Brand<string, 'UserId'>

export const AREA_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/
export const SPOT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/
/** ブラウザの crypto.randomUUID() が返す形式のみを受け付ける */
export const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isAreaId(value: string): value is AreaId {
  return AREA_ID_PATTERN.test(value)
}

export function isSpotId(value: string): value is SpotId {
  return SPOT_ID_PATTERN.test(value)
}

export function isUserId(value: string): value is UserId {
  return USER_ID_PATTERN.test(value)
}

/** 検証済みの文字列をブランド型へ持ち上げる。検証していない文字列に使わないこと。 */
export function asAreaId(value: string): AreaId {
  if (!isAreaId(value)) throw new Error('invalid area id')
  return value
}

export function asSpotId(value: string): SpotId {
  if (!isSpotId(value)) throw new Error('invalid spot id')
  return value
}

export function asUserId(value: string): UserId {
  if (!isUserId(value)) throw new Error('invalid user id')
  return value
}
