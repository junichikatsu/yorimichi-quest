import type { AreaId, UserId } from '@imanouchi/shared'

/**
 * キー設計。
 *
 * データストアは JOIN・二次インデックス・集計を持たないため、アクセスパターン起点で決める。
 * メインキーの先頭に所有者（ユーザー / エリア）を含めるので、他人のデータを引こうとしても
 * メインキーが一致せず 0 件になる。**実装ミスが「情報漏洩」ではなく「見つからない」に着地する。**
 *
 * | テーブル       | メインキー    | サブキー    | 型     |
 * | -------------- | ------------- | ----------- | ------ |
 * | spots          | area#<areaId> | <spotId>    | 文字列 |
 * | users          | user#<userId> | 'profile'   | 文字列 |
 * | explored_tiles | user#<userId> | <row>:<col> | 文字列 |
 *
 * FR-03 以降で checkins・user_spot_state・explored_tiles などが増える。
 * **時系列のサブキーは必ず数値型にすること。** 文字列にすると範囲クエリが辞書順になり、
 * 桁上がりで並びが壊れる。
 */

export const SPOTS_MAIN_KEY = 'areaKey'
export const SPOTS_SUB_KEY = 'spotId'

export const USERS_MAIN_KEY = 'userKey'
export const USERS_SUB_KEY = 'recordKey'

/**
 * ユーザーの1レコード目。
 *
 * サブキーを固定値にしてあるのは、同じメインキーの下に将来別の種類の
 * レコード（設定、称号の履歴など）を並べられるようにするため。
 */
export const USER_PROFILE_RECORD_KEY = 'profile'

export const EXPLORED_TILES_MAIN_KEY = 'userKey'
/**
 * 歩いたタイル（FR-02-7）。
 *
 * ★ 他テーブルのサブキーと違い接頭辞を付けない。このテーブルはタイルしか持たず、
 * キー自体がグリッド座標（`row:col`）なので衝突しようがない。
 */
export const EXPLORED_TILES_SUB_KEY = 'tileKey'

export function areaKey(areaId: AreaId): string {
  return `area#${areaId}`
}

export function userKey(userId: UserId): string {
  return `user#${userId}`
}
