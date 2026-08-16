import type { AreaId, SpotId, UserId } from '@yorimichi-sample/shared'

/**
 * キー設計。
 *
 * データストアは JOIN・二次インデックス・集計を持たないため、アクセスパターン起点で決める。
 * メインキーの先頭に所有者（ユーザー / エリア）を含めるので、他人のデータを引こうとしても
 * メインキーが一致せず 0 件になる。実装ミスが「情報漏洩」ではなく「見つからない」に着地する。
 *
 * | テーブル        | メインキー        | サブキー              | 型     |
 * | --------------- | ----------------- | --------------------- | ------ |
 * | spots           | area#<areaId>     | <spotId>              | 文字列 |
 * | users           | user#<userId>     | 'profile'             | 文字列 |
 * | checkins        | user#<userId>     | <epochMs>             | 数値   |
 * | user_spot_state | user#<userId>     | spot#<spotId>         | 文字列 |
 */

export const SPOTS_MAIN_KEY = 'areaKey'
export const SPOTS_SUB_KEY = 'spotId'
export const USERS_MAIN_KEY = 'userKey'
export const USERS_SUB_KEY = 'recordKey'
export const CHECKINS_MAIN_KEY = 'userKey'
/** ★ 時系列サブキーは必ず数値型。文字列にすると範囲クエリが辞書順になり桁上がりで壊れる */
export const CHECKINS_SUB_KEY = 'checkinAt'
export const USER_SPOT_STATE_MAIN_KEY = 'userKey'
export const USER_SPOT_STATE_SUB_KEY = 'spotKey'

export const USER_PROFILE_RECORD_KEY = 'profile'

export function areaKey(areaId: AreaId): string {
  return `area#${areaId}`
}

export function userKey(userId: UserId): string {
  return `user#${userId}`
}

export function spotStateKey(spotId: SpotId): string {
  return `spot#${spotId}`
}
