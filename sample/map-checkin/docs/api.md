# API 仕様

ベース URL は **HTTP トリガーの URL**。フロントエンドは「現在のパス」を基準に相対で叩くため、
トリガーのパスが変わってもクライアント側の設定変更は不要。

```
https://<trigger-host>/<trigger-path>/v1/...
```

## 認証（サンプル用・本物ではない）

`/v1/health` と `/v1/client-config` 以外は `x-sample-user-id` ヘッダ（UUID v4 形式）が必要。
**これは認証ではない。** ブラウザが生成した ID をそのまま信頼するため他人を騙れる。
本番は LIFF ID トークンのサーバー側検証に差し替える（要件定義書 NFR-04）。

## エンドポイント

| メソッド / パス | 認証 | 概要 |
| :--- | :--- | :--- |
| `GET /v1/health` | 不要 | 稼働確認。デプロイ済みコミット・設定不足の有無 |
| `GET /v1/client-config` | 不要 | Mapbox トークン・対象エリア・チェックイン半径などの画面設定 |
| `GET /v1/spots?lat=&lng=&limit=` | 要 | エリア内スポット一覧（距離・未開拓判定つき、距離順） |
| `GET /v1/spots/:spotId?lat=&lng=` | 要 | スポット詳細 |
| `POST /v1/spots/:spotId/checkin` | 要 | チェックイン（位置検証・ポイント付与） |
| `GET /v1/exploration` | 要 | 探索済みエリア（歩いたところ）のタイル一覧と集計 |
| `POST /v1/exploration` | 要 | 歩いた座標をまとめて記録し、タイルを塗る |
| `GET /v1/me` | 要 | 累計ポイント・チェックイン履歴（直近 20 件） |
| `POST /v1/admin/seed` | 管理キー | サンプルスポットの初期投入（既存分は skip） |
| `GET /` `/styles.css` `/app.js` `/app.css` | 不要 | 静的ファイル（同一オリジン配信） |

## GET /v1/health

```jsonc
{
  "status": "ok",
  "version": "0.1.0",
  "commit": "8ed2fbb0f921",   // ★ デプロイしたコミットが動いているかの機械的な確認に使う
  "builtAt": "2026-08-16T12:00:00.000Z",
  "mockMode": false,
  "configOk": true,
  "configMissing": 0,          // 件数のみ。キー名は出さない（認証不要のため）
  "limits": { "checkinRadiusM": 100, "checkinCooldownHours": 24,
              "maxSpotsPerRequest": 200, "rateLimitPerMinute": 60,
              "exploreTileSizeM": 50 }
}
```

## GET /v1/client-config

フロントエンドは環境変数を持たないため、画面に必要な設定はここで受け取る。
`exploration` の値は**送信前の重複判定にも使う**（サーバーと同じグリッドで判定する）。

```jsonc
{
  "mapboxToken": "pk.…",
  "area": { "areaId": "chiyoda", "name": "…", "center": { "lat": 35.6785, "lng": 139.7594 }, "zoom": 14 },
  "checkinRadiusM": 100,
  "checkinCooldownHours": 24,
  "exploration": {
    "tileSizeM": 50,          // 記録の粒度（m 四方）
    "revealRadiusM": 40,      // 地図上で霧を晴らす半径（m）
    "areaRadiusM": 1500,      // 探索率の分母になる円の半径（m）
    "maxPointsPerRequest": 200
  },
  "assetVersion": "…",
  "mockMode": false
}
```

## POST /v1/spots/:spotId/checkin

リクエスト:

```json
{ "lat": 35.6739, "lng": 139.7568 }
```

成功（200）:

```jsonc
{
  "spot": { /* SpotWithDistance */ },
  "distanceM": 0,
  "pointsEarned": 50,
  "breakdown": { "base": 10, "multiplier": 3, "firstVisitBonus": 20 },
  "totalPoints": 50,
  "nextAvailableAt": "2026-08-17T12:18:56.577Z"
}
```

## GET /v1/exploration ・ POST /v1/exploration

歩いた場所を固定グリッドのタイルへ量子化して記録する（データモデルは
[datamodel.md](datamodel.md) の `explored_tiles` を参照）。

POST のリクエスト（座標は 200 点まで。超えると `BAD_REQUEST`）:

```json
{ "points": [{ "lat": 35.6739, "lng": 139.7568 }, { "lat": 35.6743, "lng": 139.7568 }] }
```

成功（200）。GET も `newTileCount` を除いて同じ形を返す:

```jsonc
{
  "tiles": [
    // lat / lng は**タイルの中心**。送った生の座標はどこにも保存しない
    { "tileKey": "79424:311154", "lat": 35.673957, "lng": 139.756782,
      "firstSeenAt": "2026-08-17T12:00:00.000Z" }
  ],
  "summary": {
    "tileCount": 1,
    "exploredAreaM2": 2031,    // 50m × 50m × cos(緯度)。北緯 35 度で約 2,031m²
    "coveragePercent": 0.03,   // 対象エリア（半径 areaRadiusM の円）に対する割合
    "truncated": false          // true なら上限で打ち切り。数値は「以上」として扱う
  },
  "newTileCount": 1             // POST のみ。0 なら既に歩いた範囲だった
}
```

**同じタイルへの再送は書き込みを増やさない**（`putItem` が同じキーへの上書きになる）。
フロントエンドも既に塗ったタイルは送らないため、同じ場所に留まっている間は通信が発生しない。

## エラー

```jsonc
{ "error": { "code": "TOO_FAR", "message": "スポットから離れすぎています",
             "details": { "distanceM": 4421, "radiusM": 100 } } }
```

| code | HTTP | 意味 |
| :--- | :--- | :--- |
| `BAD_REQUEST` | 400 | 入力値が不正（`details.fields` にパスのみ。値は出さない） |
| `UNAUTHORIZED` | 401 | ユーザーヘッダが無い／形式不正 |
| `FORBIDDEN` | 403 | 管理キー不一致 |
| `NOT_FOUND` | 404 | スポットが存在しない |
| `TOO_FAR` | 409 | チェックイン半径の外 |
| `COOLDOWN` | 409 | 再チェックイン制限中（`details.nextAvailableAt`） |
| `RATE_LIMITED` | 429 | レート制限（`Retry-After` ヘッダあり） |
| `CONFIG_ERROR` | 500 | サーバー設定不足（**どのキーかは返さない**） |
| `DATASTORE_UNAVAILABLE` | 503 | データストアの操作失敗または接続不可（`details.kind` = `failed` / `threw`、`reason` = `client_init`） |
| `INTERNAL` | 500 | 想定外 |

**レスポンスに出さないもの**: 外部 SDK の生メッセージ（送信アイテムの中身が含まれうる）、
不足している環境変数のキー名、入力値そのもの、シークレット。

## 404 の形

想定と違うパスで呼ばれたことを切り分けられるよう、受け取ったパスとメソッドを返す。

```json
{ "error": { "code": "NOT_FOUND", "message": "Not Found", "path": "/x", "method": "POST" } }
```
