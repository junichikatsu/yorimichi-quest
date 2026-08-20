# データモデル（enebular データストア）

データストアは **メインキー + サブキー** の JSON アイテムストアで、
**JOIN・二次インデックス・集計（COUNT/AVG/GROUP BY）が無い**。
そのためリレーショナル設計は使わず、アクセスパターンからキーを決める。

## テーブル一覧

コンソールで 6 つ作成し、テーブル ID（UUID）を環境変数へ設定する。

| # | 用途 | 環境変数 | メインキー名 | サブキー名 | サブキー型 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | スポットマスタ | `DS_TABLE_SPOTS` | `areaKey` | `spotId` | 文字列 |
| 2 | ユーザー | `DS_TABLE_USERS` | `userKey` | `recordKey` | 文字列 |
| 3 | チェックイン履歴 | `DS_TABLE_CHECKINS` | `userKey` | `checkinAt` | **数値** |
| 4 | ユーザー×スポットの状態 | `DS_TABLE_USER_SPOT_STATE` | `userKey` | `spotKey` | 文字列 |
| 5 | 探索済みタイル（歩いたところ） | `DS_TABLE_EXPLORED_TILES` | `userKey` | `tileKey` | 文字列 |
| 6 | **達成したカード** | `DS_TABLE_USER_ITEMS` | `userKey` | `itemKey` | 文字列 |

> **時系列サブキーは必ず数値型で作る。** 文字列で作ると範囲クエリが辞書順になり、桁が変わった時点で壊れる。

## キーの形

```
spots            areaKey = "area#chiyoda"                spotId  = "sample-hibiya-park"
users            userKey = "user#<uuid>"                 recordKey = "profile"
checkins         userKey = "user#<uuid>"                 checkinAt = 1755300000000
user_spot_state  userKey = "user#<uuid>"                 spotKey = "spot#sample-hibiya-park"
explored_tiles   userKey = "user#<uuid>"                 tileKey = "79423:252775"
user_cards       userKey = "user#<uuid>"                 itemKey = "tool:helmet"
                                                        itemKey = "place:sample-hibiya-park"
                                                        itemKey = "action:shelter-action-1"
                                                        itemKey = "mission:first-action"
```

> テーブルは所持アイテム用に作ったものを流用しており、**サブキーの列名が `itemKey` のまま
> カードの識別子を持つ**。名前と中身がずれるが、enebular コンソールでのテーブル追加を
> 避けるほうを選んだ（FR-14）。
>
> **未達成のカードは保存しない。** 保存すると書き込み回数が「歩いた量」ではなく
> 「カードの総数」に比例してしまう。

> `user_items` のサブキーには `item#` の接頭辞を付けない。`explored_tiles` と同じく、
> このテーブルはアイテムしか持たずサブキー自体が定義済みのキーなので衝突しないうえ、
> 接頭辞を付けるとレコード内の `itemKey` 列と名前が重複してしまう。

`explored_tiles` のサブキーだけ接頭辞を付けていない。このテーブルはタイルしか持たず、
キー自体がグリッド座標（`<row>:<col>`）なので、他の種類のレコードと衝突しようがないため。

**メインキーの先頭に所有者（ユーザー／エリア）を含める。** 他人のデータを引こうとしても
メインキーが一致せず 0 件になるため、実装ミスが「情報漏洩」ではなく「見つからない」に着地する。
アプリ層のフィルタリングには頼らない。

リポジトリ層は生の `string` ではなくブランド型（`UserId` / `SpotId` / `AreaId`）だけを受け取るので、
文字列連結でキーを組み立てるコードはコンパイルを通らない。

## アイテムの中身

### spots

```jsonc
{
  "areaKey": "area#chiyoda",
  "spotId": "sample-hibiya-park",
  "areaId": "chiyoda",
  "name": "日比谷公園（サンプル避難場所）",
  "category": "shelter",              // shelter | aed | accessible_toilet | water
  "lat": 35.6739,
  "lng": 139.7568,
  "address": "…",
  "attributes": ["広域避難場所", "車いす対応"],
  "source": "sample-fixture",         // 出典（FR-10-2）
  "fetchedAt": "2026-08-16",          // 取得日（FR-10-2）
  "checkinCount": 3,                  // ★ 集計機能が無いため書き込み時に事前計算する
  "updatedAt": "2026-08-16T12:00:00.000Z"
}
```

### users / checkins / user_spot_state

```jsonc
// users
{ "userKey": "user#…", "recordKey": "profile", "userId": "…",
  "displayName": "…", "totalPoints": 50, "checkinCount": 1,
  "createdAt": "…", "lastActiveAt": "…" }

// checkins（サブキーは数値の epoch ms）
{ "userKey": "user#…", "checkinAt": 1755300000000, "spotId": "…",
  "spotName": "…", "pointsEarned": 50, "lat": 35.6, "lng": 139.7 }

// user_spot_state（再チェックイン制限とクイズ報酬の判定用）
// quizClearedAt は 0 が「未クリア」。データストアに undefined を書けないため
{ "userKey": "user#…", "spotKey": "spot#…", "lastCheckinAt": 1755300000000,
  "visitCount": 1, "quizClearedAt": 0 }
```

`users` の `avatar` と `equipment` は入れ子のオブジェクトを素直に扱えないため **JSON 文字列**で持つ。
読み出し側では必ず検証を通し、壊れていたら既定値へ落とす。

```jsonc
{ "userKey": "user#…", "recordKey": "profile", …,
  "avatar": "{\"hair\":0,\"cloth\":3,\"hairColor\":0,\"clothColor\":1,\"skin\":0,\"name\":\"ヨリ\"}",
  "equipment": "{\"head\":\"helmet\",\"body\":null,\"hand\":null,\"back\":null}" }
```

装備を所持アイテムとは別テーブルにせずプロフィールへ入れているのは、
見た目の描画とマイページ表示のたびに `user_items` を読み直すと getItem が増えるため。

### user_cards

```jsonc
{ "userKey": "user#…", "itemKey": "tool:helmet", "count": 1, "achievedAt": "…" }
```

### explored_tiles

歩いた場所を**固定グリッド**へ量子化して 1 タイル 1 アイテムで持つ。
`lat` / `lng` はタイルの中心（送られてきた生の座標ではない）。

```jsonc
{ "userKey": "user#…", "tileKey": "79424:311154",
  "lat": 35.673957, "lng": 139.756782, "firstSeenAt": 1755300000000 }
```

**生の GPS 軌跡は保存しない。** そのまま貯めると件数が滞在時間に比例して増え続けるうえ、
「いつどこにいたか」の精度が高すぎる。タイルへ丸めることで件数は**歩いた面積**にしか比例せず、
同じ道を何度歩いても `putItem` が同じキーへの上書きになるので書き込みも積み上がらない。

グリッドは緯度経度の原点に固定されているため、端末にも表示倍率にも依存せず、
同じ場所は必ず同じ `tileKey` になる（`packages/core/src/exploration.ts`）。

刻み幅は**緯度方向・経度方向とも同じ度数**（`EXPLORE_TILE_SIZE_M / 111320` 度）。
1 タイルは縦 50m ちょうど、横は 50m × cos(緯度) ＝ 日本付近で約 41m の長方形になる。

> **経度の刻みを緯度ごとに計算し直してはいけない。** 「経度 1 度の距離は緯度で変わるのだから
> 行ごとに幅を求めるほうが正確」に見えるが、わずかな幅の差に 30 万前後の列番号が掛かるため
> 列の境界が行ごとに大きくずれる。実測では**真北へ 100m 進むごとに軌跡が約 40m 東へ流れた**。
> 等間隔なら行同士が必ず揃うので、この破綻は原理的に起きない。

## アクセスパターンとコスト

データストアのアクセス数には月次上限（フリー 10,000 回）があるため、1 操作あたりの回数を意識する。

| 操作 | 内訳 | 回数 |
| :--- | :--- | :--- |
| スポット一覧 | `query`（エリア単位） | 1 |
| スポット詳細 | `getItem` | 1 |
| マイページ | `getItem`（users）＋ `query`（checkins） | 2 |
| **チェックイン** | `getItem` × 3（spot / user_spot_state / users）＋ `putItem` × 4（checkins / user_spot_state / users / spots） | **7** |
| 探索エリア取得 | `query`（ユーザー単位） | 1 |
| **探索エリア記録** | `query` × 1 ＋ `putItem` × **新規タイル数** | 1 + N |
| シード | `query` × 1 ＋ `putItem` × スポット数 | 1 + N |

`user_spot_state` を独立テーブルにしているのは、再チェックイン判定を**履歴の走査ではなく 1 回の `getItem`** で
終わらせるため。履歴テーブルを毎回スキャンする設計にすると、アクセス回数が利用量に比例して増える。

探索エリアの記録は、フロントエンド側でも**既に塗ったタイルは送らない**ため、
歩き続けていない限り `putItem` は発生しない。1 リクエストの座標は 200 点まで、
1 ユーザーのタイルは `MAX_EXPLORED_TILES_PER_REQUEST`（既定 2,000 ＝ 5km² 相当）で打ち切る。
打ち切った場合は `summary.truncated` を true で返し、画面には「以上」を付けて出す。

## 秘匿情報について

`getItem` はアイテム全体を返すため、「カラムを選んで SELECT」に相当する防御がない。
秘匿したいフィールドが出てきた場合は**テーブルごと分ける**のが唯一の隔離手段になる。
本サンプルには秘匿フィールドは無いが、本番で投稿写真の生 EXIF や連絡先を扱う場合はテーブルを分けること。
