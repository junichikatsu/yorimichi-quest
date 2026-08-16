# サンプル: map-checkin（地図＋チェックイン）

要件定義書（[../../doc/requirements.md](../../doc/requirements.md)）の**平時モードのコア体験**を、
動く形で確認するためのサンプル実装です。**正式な開発ではありません。**
他のサンプルとは独立したワークスペースです（[サンプル一覧](../README.md)）。

- 地図: **Mapbox GL JS**
- 言語: **TypeScript**
- フロントエンド: **React**（esbuild で iife にバンドル）
- 実行環境 / 配信 / DB: **enebular**（クラウド実行環境 ZIP + データストア）

対応する要件: FR-02（マップ・スポット表示）／FR-03（チェックイン）／FR-07（ポイント）／
FR-10（オープンデータ取込＝シード）／FR-11（計測の素地）。
写真投稿・AI 解析・クイズ・相互検証・有事モード・行政ダッシュボードは**対象外**です。

## クイックスタート（ローカル）

```bash
cd sample/map-checkin
pnpm install

# 別ターミナル: フロントエンドの監視ビルド
pnpm dev:web

# APIサーバー（ローカルはインメモリのデータストアを使う）
pnpm dev
# → http://localhost:8787/
```

Mapbox のトークンが無くても起動します（地図の代わりに一覧表示になります）。
地図を出すには `sample/map-checkin/.env` を作って `MAPBOX_ACCESS_TOKEN` を設定してください（`.env.example` 参照）。

現地に行かずにチェックインを試す場合は、スポットを選んで
「デモ用：現在地をこの場所に設定する」を押してください。

## コマンド

| コマンド | 内容 |
| :--- | :--- |
| `pnpm dev` | API サーバーをローカル起動（fake データストア） |
| `pnpm dev:web` | フロントエンドの監視ビルド |
| `pnpm typecheck` | 全パッケージの型チェック |
| `pnpm lint` | ESLint（`apps/web` では `innerHTML` を禁止） |
| `pnpm test` | Vitest（core / datastore / function の統合テスト） |
| `pnpm build:zip` | デプロイ用 ZIP を生成（web ビルド → バンドル → handler 検証 → ZIP） |
| `pnpm verify` | typecheck → lint → test → ZIP ビルドを通しで実行 |

## 構成

```
sample/map-checkin/
├── apps/
│   ├── web/          React + Mapbox（public/ が配信対象。app.js / app.css は生成物）
│   └── function/     Hono アプリ + ZIP ビルド（enebular クラウド実行環境）
├── packages/
│   ├── shared/       型と Zod スキーマ（= API 契約）
│   ├── core/         純関数（距離・ポイント・チェックイン可否）
│   └── datastore/    データストアのリポジトリ層 + インメモリ fake
└── docs/
    ├── architecture.md   構成と設計判断
    ├── datamodel.md      テーブルとキー設計
    ├── api.md            API 仕様
    └── deploy.md         enebular へのデプロイ手順
```

## 注意

- **認証はありません。** ユーザー識別はブラウザが生成した UUID をヘッダで送るだけで、他人を騙れます。
  公開環境に置かないでください（本番は LIFF ID トークンをサーバー側で検証します）。
- **スポットはデモ用の架空データです。** 実在の避難所指定や設備状況を表すものではありません。
  本番は FR-10-1 のオープンデータに置き換えます。
- **データストアはローカルで代替できません**（実行環境が接続情報を注入するため）。
  ローカル開発とテストはインメモリ実装（`packages/datastore/src/fake.ts`）で通します。
- チェックイン半径・クールダウン・ポイント配分は**暫定値**です（Issue #7 で確定）。
