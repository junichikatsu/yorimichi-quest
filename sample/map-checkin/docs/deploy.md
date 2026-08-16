# デプロイ手順（enebular）

CLI は既存のアセットと実行環境に対して動くため、**最初の 1 回はコンソールで作る**。
以降は GitHub Actions（`sample-deploy-function.yml`）で ZIP を差し替える。

## 1. 初回セットアップ（コンソール・手動）

| # | 作業 | 取得する値 |
| :--- | :--- | :--- |
| 1 | プロジェクトを作成 | `PROJECT_ID` |
| 2 | データストアのテーブルを 5 つ作成（キー名と型は [datamodel.md](datamodel.md) のとおり） | テーブル ID × 5 |
| 3 | ZIP をファイルアセットとして登録（`--deploy-type cloud --handler index.handler`） | `ASSET_ID` |
| 4 | ZIP 向けクラウド実行環境を作成（ランタイム **Node.js 22.x**） | `CLOUD_ID` |
| 5 | HTTP トリガーを有効化し、パスを設定（インスタンス内で一意） | トリガー URL |
| 6 | **`connectDataStore` を有効化**し、`envVars` を設定（下記） | — |
| 7 | アクセスキー / シークレットキーを発行 | `ENEBULAR_ACCESS_KEY` / `ENEBULAR_SECRET_KEY` |

> 手順 3 は ZIP の実体を要求する。先に `pnpm build:zip` でローカル生成した
> `apps/function/map-checkin-function.zip` を登録すればよい。
>
> **現在デプロイ済みのトリガーパスは `/yorimichi-sample`**（`https://lcdp002.enebular.com/yorimichi-sample`）。
> これは enebular 側の設定値で、リポジトリ内のディレクトリ名（`sample/map-checkin`）とは独立している。
> トリガーパスはインスタンス内で一意であればよく、コード側は `/:base` で受けるため変更しても影響しない。
>
> 環境ごと（staging / development）に 3〜5 を繰り返し、**トリガーのパスも変える**。
> フロントは相対パスなので画面側の設定変更は不要。

### envVars に設定する値

`.env.example` を参照。**API キーを含むためコンソールで手動管理し、リポジトリにコミットしない。**
CI が知るシークレットは enebular のアクセスキーだけにする。

| キー | 値 |
| :--- | :--- |
| `MAPBOX_ACCESS_TOKEN` | Mapbox の公開トークン（`pk.`）。**URL 制限をかけたものを使う** |
| `ADMIN_KEY` | シード実行用の鍵（推測できない値） |
| `DS_TABLE_SPOTS` / `DS_TABLE_USERS` / `DS_TABLE_CHECKINS` / `DS_TABLE_USER_SPOT_STATE` / `DS_TABLE_EXPLORED_TILES` | 手順 2 のテーブル ID |
| `AREA_ID` / `AREA_NAME` / `AREA_CENTER_LAT` / `AREA_CENTER_LNG` / `AREA_ZOOM` / `AREA_RADIUS_M` | 対象エリア |
| `CHECKIN_RADIUS_M` / `CHECKIN_COOLDOWN_HOURS` / `RATE_LIMIT_PER_MINUTE` | ゲームパラメータ（暫定値） |
| `EXPLORE_TILE_SIZE_M` / `EXPLORE_REVEAL_RADIUS_M` | 探索エリアの粒度と霧を晴らす半径（未設定なら既定値 50 / 40） |
| `LOG_LEVEL` | `INFO`（`DEBUG` 以上は入力内容がログに出うる） |

`USE_FAKE_DATASTORE` は **設定しない**（enebular では常に本物のデータストアを使う）。

### すでに動いている環境へ探索エリア機能を入れる場合

**ZIP を差し替える前に、コンソールで作業が要る。** テーブルの作成は CLI にも GitHub Actions にも
含まれていないため、先に ZIP だけ入れ替えると `/v1/exploration` が 500 `CONFIG_ERROR` を返す
（`/v1/health` と既存 API は動き続けるので、気づかないまま放置されやすい）。

1. `explored_tiles` テーブルを作る（メインキー `userKey` / サブキー `tileKey`、**どちらも文字列**）
2. 実行環境の envVars に `DS_TABLE_EXPLORED_TILES` を追加する
3. その後で ZIP を差し替える
4. `/v1/health` の `configOk` が `true` のままか確認する（`false` なら 1〜2 の漏れ）

既存ユーザーのデータ移行は不要。探索済みタイルは歩いた分から新規に貯まる。

## 2. 初期データの投入

デプロイ後に一度だけ実行する。ローカルからデータストアへは接続できないため、
シードは関数経由で行う。

```bash
curl -X POST "$HTTP_TRIGGER_URL/v1/admin/seed" \
  -H "x-admin-key: $ADMIN_KEY" \
  -H "x-sample-user-id: 11111111-2222-4333-8444-555555555555"
# → { "inserted": 12, "skipped": 0 }
```

2 回目以降は既存分が `skipped` になり、チェックイン数は巻き戻らない。

## 3. GitHub Actions でのデプロイ

`.github/workflows/sample-deploy-function.yml`。デプロイ先は **GitHub Environment** で切り替える。

- Secrets（Environment ごと）: `ENEBULAR_ACCESS_KEY` / `ENEBULAR_SECRET_KEY`
  **値の前後に空白や改行があると認証エラー**になるため、冒頭で空チェックしている
- Variables（Environment ごと）: `ENEBULAR_PROJECT_ID` / `ENEBULAR_CLOUD_ID` / `ENEBULAR_FILE_ASSET_ID` / `HTTP_TRIGGER_URL`
- トリガーは `workflow_dispatch` のみ。push デプロイはコメントアウトで置いてある
  （意図しないタイミングでデモ環境が入れ替わるのを避ける）

実行されるコマンド:

```bash
enebular update file       --project-id … --asset-id … --file "$ZIP_PATH" --json
enebular deploy cloud      --project-id … --cloud-id … --asset-id … --asset-type file --json
enebular add file-version  --project-id … --asset-id … --name … --comment … --json
```

- **`--json` を必ず付ける**（無いと確認プロンプトで workflow が停止する）
- **`--asset-type` は `file`**（`flow` は Node-RED 用）
- `add file-version` の `--name` は **1〜30 文字の英数字・アンダースコア・ハイフンのみ**。
  ブランチ名（`feature/xxx`）はそのままでは通らないので、ワークフロー側で整形している

## 4. デプロイ後の確認

```bash
curl -s "$HTTP_TRIGGER_URL/v1/health" | jq
```

- `200` が返るか
- **`commit` が今回デプロイした Git SHA と一致するか**（ZIP 差し替え漏れの検出）
- `configOk` が `true` か

画面は `$HTTP_TRIGGER_URL/`（末尾スラッシュなしでもリダイレクトされる）。

## つまずきやすい点

| 症状 | 原因 | 対処 |
| :--- | :--- | :--- |
| 全リクエストが 404、レスポンスに `path` が出る | トリガーのパスの想定違い | `path` の値を見る。ルートは `/` `/:base` `/:base/` の 3 通りにマウント済み |
| **デプロイしたのに画面が変わらない** | 前段（Cloudflare）が CSS/JS に `max-age=14400` を上書きする | `index.html` の `?v=` が更新されているか確認。`?v=` はコミットハッシュから生成される |
| CSS も JS も 404 | 末尾スラッシュ無しの URL で開いた | `/` へのリダイレクトが効いているか確認 |
| `/v1/health` は返るが API が 503 | `connectDataStore` が無効／実行環境の外 | `details.reason === "client_init"` なら接続設定側 |
| API が 500 `CONFIG_ERROR` | テーブル ID の環境変数が未設定 | 実行環境のログに不足キー名が出る |
| **`/v1/exploration` だけ 500、他は正常** | `explored_tiles` テーブルまたは `DS_TABLE_EXPLORED_TILES` の作成漏れ | 上記「すでに動いている環境へ〜」の手順 1〜2 |
| 地図に霧が出ない（塗られない） | Mapbox トークン未設定で一覧表示にフォールバックしている | `/v1/client-config` の `mapboxToken` を確認 |
| 画面が白い | 静的ファイル未ビルド | `/app.js` が 500 `ASSET_NOT_BUILT` を返す。ZIP を作り直す |
