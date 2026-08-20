# デプロイ手順（enebular）

CLI は既存のアセットと実行環境に対して動くため、**最初の1回はコンソールで作る**。
以降は GitHub Actions（`.github/workflows/imanouchi-deploy.yml`）で ZIP を差し替える。

> **サンプル（`sample/map-checkin`）とは enebular プロジェクトが別。**
> 値の取り違えを防ぐため、GitHub 側の変数名を `PROD_` で始める別の名前にしている。
> 同じ名前を使い回すと、設定漏れのときにサンプル側の値を拾って**別のプロジェクトへ
> デプロイしてしまう**（もっとも気づきにくい壊れ方）。

## 0. 前提：ワークフローが develop に入っていること

**`workflow_dispatch` は、ワークフローファイルが既定ブランチ（`develop`）に無いと
Actions の画面に出てこない。** 機能ブランチに置いただけでは実行できない。

## 1. 初回セットアップ（コンソール・手動）

| # | 作業 | 取得する値 |
| :--- | :--- | :--- |
| 1 | プロジェクトを作成 | `PROJECT_ID` |
| 2 | データストアのテーブルを2つ作成（キーは下記） | テーブル ID × 2 |
| 3 | ZIP をファイルアセットとして登録（`--deploy-type cloud --handler index.handler`） | `ASSET_ID` |
| 4 | ZIP 向けクラウド実行環境を作成（ランタイム **Node.js 22.x**） | `CLOUD_ID` |
| 5 | HTTP トリガーを有効化し、パスを設定（インスタンス内で一意） | トリガー URL |
| 6 | **`connectDataStore` を有効化**し、`envVars` を設定 | — |
| 7 | アクセスキー / シークレットキーを発行 | アクセスキー / シークレットキー |

手順 3 は ZIP の実体を要求する。先に `pnpm build:zip` で
`apps/function/imanouchi-function.zip` を作って登録する。

トリガーのパスはインスタンス内で一意であればよい。コード側は `/` `/:base` `/:base/` の
3通りにマウントしているため、パスを変えても影響しない。

### データストアのキー

| テーブル | メインキー | サブキー | 型 |
| :--- | :--- | :--- | :--- |
| スポット | `areaKey` | `spotId` | 文字列 / 文字列 |
| ユーザー | `userKey` | `recordKey` | 文字列 / 文字列 |

**FR-03 以降で増えるテーブルのうち、時系列のサブキーは必ず数値型にする。**
文字列にすると範囲クエリが辞書順になり、桁が上がった時点で並びが壊れる。
定義は `packages/datastore/src/keys.ts` の冒頭にある。

### envVars

`.env.example` を参照。**API キーを含むためコンソールで手動管理し、リポジトリに
コミットしない。** CI が知るシークレットは enebular のアクセスキーだけにする。

`USE_FAKE_DATASTORE` は**設定しない**。true だとインメモリ実装になり、再起動で
データが消える。

## 2. GitHub 側の登録

**Environment `production`** を作り、そこに登録する。

| 種別 | 名前 |
| :--- | :--- |
| Secret | `PROD_ENEBULAR_ACCESS_KEY` / `PROD_ENEBULAR_SECRET_KEY` |
| Variable | `PROD_ENEBULAR_PROJECT_ID` / `PROD_ENEBULAR_CLOUD_ID` / `PROD_ENEBULAR_FILE_ASSET_ID` / `PROD_HTTP_TRIGGER_URL` |

`PROD_HTTP_TRIGGER_URL` は**末尾スラッシュなし**（例 `https://lcdp002.enebular.com/imanouchi`）。
スモークテストが `$HTTP_TRIGGER_URL/v1/health` を組み立てるため、付けると `//v1/health` になる。

ワークフローの冒頭で**空と前後の空白・改行を検査している。** コピー時の改行混入は
認証エラーになるが原因が分かりにくいため、先に落とす。

## 3. デプロイ

Actions →「イマノウチ deploy (enebular)」→ Run workflow → environment に `production`。

意図しないタイミングで環境が入れ替わらないよう、**手動実行のみ**にしている。

ワークフローがやること:

1. 必須の secrets / variables の検査
2. `pnpm build:zip`
3. ZIP の形の検査（ルート直下が `index.js` と `package.json` だけ／`type` フィールドが無い／`handler` が関数／250MB 以下）
4. `enebular update file` → `deploy cloud` → `add file-version`
5. スモークテスト

## 4. 初期データの投入

**デプロイしただけではスポットが空。** 投入は自動では走らない。

```bash
curl -X POST "$HTTP_TRIGGER_URL/v1/admin/seed" -H "x-admin-key: $ADMIN_KEY"
# → { "area": {...}, "inserted": 370 }
```

**データストアに一括投入が無いため、件数ぶん `putItem` を順に呼ぶ。** 370件では
7〜18秒かかり、実行環境のタイムアウトに当たることがある。当たった場合は先に
取込を絞る（撮影ルート確定後に必要な作業でもある）。

```bash
pnpm ingest -- --center 35.669,139.753 --radius 1200 --cap aed=60
```

## 5. デプロイ後の確認

```bash
curl -s "$HTTP_TRIGGER_URL/v1/health"
# → {"status":"ok","commit":"<デプロイしたコミット>","configOk":true,"configMissing":0}
```

`configOk` が false のときは**実行環境のログを見る。** 不足キー名はレスポンスに
出さない（認証不要のエンドポイントのため）。

```
[config] missing: LIFF_ID, SESSION_SECRET
[config] missing: LIFF_ID_CHANNEL_MISMATCH   ← LIFF ID とチャネルIDの組み合わせ違い
```

画面は `$HTTP_TRIGGER_URL/`（末尾スラッシュなしでもリダイレクトされる）。
**ただし LINE ログインは LIFF 経由でしか完走しない**（下記）。

## つまずきやすい点

| 症状 | 原因 | 対処 |
| :--- | :--- | :--- |
| Actions に workflow が出てこない | ワークフローが既定ブランチ（`develop`）に無い | 先にマージする |
| 全リクエストが 404、レスポンスに `path` が出る | トリガーのパスの想定違い | `path` の値を見る。ルートは3通りにマウント済み |
| **デプロイしたのに画面が変わらない** | 前段が CSS/JS に `max-age` を上書きする | `index.html` の `?v=` が更新されているか。コミットハッシュから生成される |
| CSS も JS も 404 | 末尾スラッシュ無しの URL で開いた | `/` へのリダイレクトが効いているか |
| `/v1/health` は返るが API が 503 | `connectDataStore` が無効／実行環境の外 | `details.reason === "client_init"` なら接続設定側 |
| API が 500 `CONFIG_ERROR` | テーブル ID の環境変数が未設定 | 実行環境のログに不足キー名が出る |
| 画面が白い | 静的ファイル未ビルド | `/app.js` が 500 `ASSET_NOT_BUILT` を返す。ZIP を作り直す |
| 地図が出ず一覧になる | `MAPBOX_ACCESS_TOKEN` 未設定 | `/v1/client-config` の `mapboxToken` を確認 |
| ログインで 401 | IDトークンの検証に失敗 | ログの `[auth] line verify failed: <理由>` を見る |
| 「LINE からユーザー情報を取得できませんでした」 | LIFF に `openid` スコープが無い | LINE Developers 側で付与 |
| スモークテストで commit 不一致 | ZIP の差し替え漏れ | ファイルアセットの版が上がっているか確認 |

## LINE ログインの確認について

**素のブラウザでは完走しない。** LIFF アプリのエンドポイントURLに
`$HTTP_TRIGGER_URL/` を登録し、**LINE アプリから LIFF URL
（`https://miniapp.line.me/<LIFF ID>`）で開く**必要がある。

開発用の内部チャネルは、**コンソールで登録・承認したテスターだけ**が開ける。
デモに参加する人は先に登録しておく。

`LIFF_ID` と `LINE_CHANNEL_ID` は内部チャネル（開発用・審査用・本番用）ごとに
別の値で、**LIFF ID は `<チャネルID>-<ランダム文字列>` という形**になっている。
組み合わせが違うと起動時の検査で `configOk` が false になる。
