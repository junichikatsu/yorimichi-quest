import type { AreaId, SpotId, UserId } from '@imanouchi/shared'

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
 * ★ 以降の FR で増えるテーブルも、**名前と型をここで先に決めておく。**
 * 実装者が違っても同じキーになるようにするため。列名を後から変えると、
 * すでに入っているデータが読めなくなる。
 *
 * | テーブル        | メインキー    | サブキー      | 型     | 使う FR |
 * | --------------- | ------------- | ------------- | ------ | ------- |
 * | checkins        | user#<userId> | <epochMs>     | **数値** | FR-03 |
 * | user_spot_state | user#<userId> | spot#<spotId> | 文字列 | FR-03・FR-04 |
 * | user_cards      | user#<userId> | <種類>:<キー> | 文字列 | FR-07・FR-14 |
 *
 * **時系列のサブキーは必ず数値型にすること（`checkins` の `checkinAt`）。**
 * 文字列にすると範囲クエリが辞書順になり、桁が上がった時点で並びが壊れる。
 * 「新しい順に10件」が正しく取れなくなる。**作り直すしか直せない。**
 *
 * `user_spot_state` は FR-03 と FR-04 の両方が使う。1スポットにつき1レコードで、
 * 最終チェックイン時刻・訪問回数・クイズ正解時刻をまとめて持つ。
 * **クイズ用に別テーブルを作らない。** アイテム数を増やさないため（制約 E4）。
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

export const CHECKINS_MAIN_KEY = 'userKey'
/**
 * チェックイン履歴（FR-03）のサブキー。
 *
 * ★ **数値型で作る。** 文字列にすると範囲クエリが辞書順になり、桁が上がった
 * 時点で「新しい順に10件」が壊れる。作り直すしか直せない。
 */
export const CHECKINS_SUB_KEY = 'checkinAt'

export const USER_SPOT_STATE_MAIN_KEY = 'userKey'
export const USER_SPOT_STATE_SUB_KEY = 'spotKey'

export const USER_CARDS_MAIN_KEY = 'userKey'
/**
 * 達成したカード（FR-14）のサブキー。
 *
 * ★ 値は `<種類>:<キー>`（例 `place:aed-277fdb2594`）。**アイテム用のテーブルを
 * 流用し、サブキーを一般化してある**（要件定義 6.2）。カード用に別のテーブルを
 * 作らないので、アイテム数が増えない。
 */
export const USER_CARDS_SUB_KEY = 'itemKey'

export function areaKey(areaId: AreaId): string {
  return `area#${areaId}`
}

export function userKey(userId: UserId): string {
  return `user#${userId}`
}

/**
 * user_spot_state のサブキー。
 *
 * ★ 接頭辞を付ける。このテーブルは将来「そのスポットに対する別の状態」を
 * 並べる余地があり、素の spotId だけでは種類を見分けられない。
 */
export function spotStateKey(spotId: SpotId): string {
  return `spot#${spotId}`
}
