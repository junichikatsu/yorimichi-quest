# データモデル（enebular データストア）

データストアは **メインキー + サブキー** の JSON アイテムストアで、
**JOIN・二次インデックス・集計（COUNT/AVG/GROUP BY）が無い**。
そのためリレーショナル設計は使わず、アクセスパターンからキーを決める。

## テーブル一覧

コンソールで 4 つ作成し、テーブル ID（UUID）を環境変数へ設定する。

| # | 用途 | 環境変数 | メインキー名 | サブキー名 | サブキー型 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | スポットマスタ | `DS_TABLE_SPOTS` | `areaKey` | `spotId` | 文字列 |
| 2 | ユーザー | `DS_TABLE_USERS` | `userKey` | `recordKey` | 文字列 |
| 3 | チェックイン履歴 | `DS_TABLE_CHECKINS` | `userKey` | `checkinAt` | **数値** |
| 4 | ユーザー×スポットの状態 | `DS_TABLE_USER_SPOT_STATE` | `userKey` | `spotKey` | 文字列 |

> **時系列サブキーは必ず数値型で作る。** 文字列で作ると範囲クエリが辞書順になり、桁が変わった時点で壊れる。

## キーの形

```
spots            areaKey = "area#chiyoda"                spotId  = "sample-hibiya-park"
users            userKey = "user#<uuid>"                 recordKey = "profile"
checkins         userKey = "user#<uuid>"                 checkinAt = 1755300000000
user_spot_state  userKey = "user#<uuid>"                 spotKey = "spot#sample-hibiya-park"
```

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

// user_spot_state（再チェックイン制限の判定用）
{ "userKey": "user#…", "spotKey": "spot#…", "lastCheckinAt": 1755300000000, "visitCount": 1 }
```

## アクセスパターンとコスト

データストアのアクセス数には月次上限（フリー 10,000 回）があるため、1 操作あたりの回数を意識する。

| 操作 | 内訳 | 回数 |
| :--- | :--- | :--- |
| スポット一覧 | `query`（エリア単位） | 1 |
| スポット詳細 | `getItem` | 1 |
| マイページ | `getItem`（users）＋ `query`（checkins） | 2 |
| **チェックイン** | `getItem` × 3（spot / user_spot_state / users）＋ `putItem` × 4（checkins / user_spot_state / users / spots） | **7** |
| シード | `query` × 1 ＋ `putItem` × スポット数 | 1 + N |

`user_spot_state` を独立テーブルにしているのは、再チェックイン判定を**履歴の走査ではなく 1 回の `getItem`** で
終わらせるため。履歴テーブルを毎回スキャンする設計にすると、アクセス回数が利用量に比例して増える。

## 秘匿情報について

`getItem` はアイテム全体を返すため、「カラムを選んで SELECT」に相当する防御がない。
秘匿したいフィールドが出てきた場合は**テーブルごと分ける**のが唯一の隔離手段になる。
本サンプルには秘匿フィールドは無いが、本番で投稿写真の生 EXIF や連絡先を扱う場合はテーブルを分けること。
