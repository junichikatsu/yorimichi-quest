# イマノウチ

歩いて防災データを集める位置情報ゲーム。都知事杯オープンデータ・ハッカソン2026 応募作品。

| | |
| :--- | :--- |
| 企画書 | [doc/proposal.md](doc/proposal.md) |
| 要件定義書 | [doc/requirements.md](doc/requirements.md) |
| オープンデータ一覧 | [doc/opendata-sources.md](doc/opendata-sources.md) |
| 都民ヒアリング（n=37） | [doc/hearing-citizens.md](doc/hearing-citizens.md) |
| 8/23 提出物の草案 | [doc/submission-20260823.md](doc/submission-20260823.md) |

## このリポジトリの構成

```
apps/function/    Hono アプリ（enebular クラウド実行環境・ZIP デプロイ）
apps/web/         React + Mapbox GL JS（同一オリジンで配信）
packages/shared/  型と入力検証。サーバーとクライアントで共有する
packages/core/    純粋な計算（距離・書式）
packages/datastore/ enebular データストアのアクセス層
tools/ingest/     オープンデータ取込（FR-10）
sample/           検証用のサンプル実装。本実装とは別のワークスペース
```

**`sample/` は本実装ではありません。** 先に作った検証用の実装で、独自の
`pnpm-workspace.yaml` を持つ別のワークスペースです。CI もデプロイも別に分かれています。

## 実装済みの範囲

| FR | 内容 | 状態 |
| :--- | :--- | :--- |
| FR-01 | LINE ログイン・自動登録・プロフィール利用・位置情報の同意 | **実装済み** |
| FR-02-1 | 現在地を中心とした地図とカテゴリ別ピン | **実装済み** |
| FR-02-2 | スポット詳細 | **実装済み**（投稿写真・検証状況は FR-05／FR-06 で追加） |
| FR-02-6 | Mapbox の帰属表示 | **実装済み** |
| FR-02-7 | 町丁目単位の霧 | **実装済み** |
| FR-01-5/-6 | キャラクターの保持・キャラクターメイキング | **実装済み** |
| FR-02-8 | 地図上の現在地をキャラクターで表示 | **実装済み** |
| — | デモ用の移動操作（PC・測位不可時のみ。**LINE アプリ内では出さない**） | **実装済み** |
| FR-03 | チェックイン（位置検証・ポイント・再チェックイン制限） | **実装済み**（称号 FR-03-4 は未実装） |
| FR-04 | 現地クイズ（出題・採点・解説・即リトライ） | **実装済み**（出題は固定データ。Dify 生成 FR-04-2 は未実装） |
| FR-14 | カードコレクション（行動・道具・場所・ミッション） | **実装済み**（数値・レア度・対戦は入れない：FR-14-11） |
| FR-10 | オープンデータ取込 | **実装済み**（`pnpm ingest` / `pnpm seed`） |

## 使い方

```bash
pnpm install

# 実データを取り込む（千代田区・港区の370件）
pnpm ingest

# ローカル起動。バックエンド（API と画面の配信）。データストアはインメモリ実装に切り替わる
pnpm dev

# 別のターミナルで。フロントエンドのビルド番（src/ を public/app.js へ焼く）
pnpm dev:web
```

**この2つは役割が違います。** `pnpm dev` が API と画面を配信し（ブラウザが繋ぐのはこちら）、
`pnpm dev:web` は `apps/web/src/` を `apps/web/public/app.js` へビルドし続けるだけです
（サーバーは持ちません）。フロントを直したら `dev:web` が焼き、`dev` がそれを配ります。
**`dev` だけだと古いバンドルが配信されます。**

`.env` を書き換えたら `pnpm dev` を再起動してください（watch は `.env` の変更を拾いません）。
起動が詰まったら `lsof -nP -iTCP:8787 -sTCP:LISTEN` で**古いプロセスが残っていないか**を
確認してください。ポートが埋まっていると新しい起動は静かに失敗し、設定を読んでいない
古いサーバーが応答し続けます。

`pnpm dev` は http://localhost:8787/ で立ち上がります。**ただし LINE ログインは
LIFF が必要なため、ローカルの素のブラウザでは完走しません**（`LIFF_ID` を設定し、
LIFF アプリのエンドポイントに公開URLを登録した状態で LINE アプリから開く必要があります）。

| コマンド | 内容 |
| :--- | :--- |
| `pnpm dev` | バックエンド（API と画面の配信）。8787 で待つ |
| `pnpm dev:web` | フロントエンドのビルド番（`public/app.js` を焼き直す） |
| `pnpm verify` | typecheck → lint → test → ZIP ビルド |
| `pnpm ingest` | スポットを取り込む（FR-10） |
| `pnpm ingest:boundaries` | 町丁目境界256区画を取り込む（FR-02-7 で使う） |
| `pnpm build:zip` | デプロイ用 ZIP を生成 |
| `pnpm seed` | デプロイ先へスポットを投入（終わるまで繰り返す。`--reset` で消してから） |

## 環境変数

[.env.example](.env.example) を参照。ローカルはリポジトリ直下の `.env`、本番は
enebular 実行環境の envVars に設定します。

**設定が足りなくても起動は止まりません。** 全リクエストが 500 になると `/v1/health`
すら返らず、「関数は動いているのに何も応答しない」という最も切り分けにくい状態に
なるためです。不足は `/v1/health` の `configOk` と起動時ログで分かります（**キー名は
レスポンスに出しません**）。

## デプロイ

手順は [docs/deploy.md](docs/deploy.md) にまとめてあります。`.github/workflows/imanouchi-deploy.yml` を手動実行します。

**`workflow_dispatch` はワークフローが既定ブランチ（`develop`）に無いと Actions の画面に出ません。** 機能ブランチに置いただけでは実行できません。

**サンプルとは enebular プロジェクトが別です。** 値の取り違えを防ぐため、変数名を
`PROD_` で始める別の名前にしています。

| 種別 | 名前 |
| :--- | :--- |
| Secret | `PROD_ENEBULAR_ACCESS_KEY` / `PROD_ENEBULAR_SECRET_KEY` |
| Variable | `PROD_ENEBULAR_PROJECT_ID` / `PROD_ENEBULAR_CLOUD_ID` / `PROD_ENEBULAR_FILE_ASSET_ID` / `PROD_HTTP_TRIGGER_URL` |

GitHub Environment は `production` を使います。同じ名前を使い回すと、設定漏れの
ときにサンプル側の値を拾って**別のプロジェクトへデプロイしてしまいます**。

デプロイ後は自動でスモークテストが走り、`/v1/health` の `commit` がデプロイした
コミットと一致するかを確認します。**ZIP の差し替え漏れはこれで検出します。**
