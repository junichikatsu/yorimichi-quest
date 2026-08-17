---
name: enebular-app
description: enebular のクラウド実行環境（ZIP / Node.js 22.x / Lambda ベース）にバックエンド API とフロントエンドを同一オリジンで載せるときに使う。新規に enebular アプリを立ち上げる、既存の enebular ZIP 関数を直す、enebular データストアのキー設計をする、enebular へのデプロイ（CLI / GitHub Actions）を組む、といった作業のすべてで読むこと。「デプロイしたのに画面が変わらない」「関数は動いているのに 404」「データストアが 503」などの症状の切り分けにも使う。
---

# enebular にフロントエンドとバックエンドを載せる

enebular クラウド実行環境（ZIP）で動くバックエンド API と、**同じ ZIP から同一オリジンで配信される
フロントエンド**を実装・保守するための手順書。

ここに書かれているのは推測ではなく、本番デプロイまで到達した構成の**確定仕様**として扱う。
このリポジトリの [`sample/map-checkin/`](../../../sample/map-checkin/) が実際に動いている参照実装。

## 参照ファイル

作業に入る段階で該当するものだけを読む。

| ファイル | 読むタイミング |
| :--- | :--- |
| [references/constraints.md](references/constraints.md) | 常に。プラットフォーム制約 E1〜E4 と、それが設計に与える影響 |
| [references/pitfalls.md](references/pitfalls.md) | 実装前と、症状の切り分け時。前段キャッシュ・トリガーパス・データストア SDK の落とし穴 |
| [references/scaffold.md](references/scaffold.md) | 骨格を作るとき。フォルダ構成とコードの骨子 |
| [references/deploy.md](references/deploy.md) | enebular 側セットアップと CI/CD を組むとき |
| [references/checklist.md](references/checklist.md) | 実装完了を報告する前に必ず |

## 0. 最初に確認すること

新規に立ち上げる場合、実装に入る前に次だけをユーザーに聞く。それ以外はこの手順書どおりに進めてよい。

1. アプリ名 / パッケージスコープ名（例: `@myapp/*`、ZIP 名 `myapp-function.zip`、HTTP トリガーのパス）
2. 必要なデータストアのテーブルと、そのアクセスパターン（[キー設計の制約](references/constraints.md#キー設計の原則)を踏まえて一緒に設計する）
3. LLM を使うか。使うなら経由するゲートウェイ（OrcaRouter など）とモデルの出し分け
4. 既存コードがある場合、どこまで作り直してよいか

既存アプリの修正で作業範囲が明確なら、この確認は飛ばしてよい。

## 1. 動かせない前提

| # | 制約 | 帰結 |
| :--- | :--- | :--- |
| E1 | ハンドラは `{ statusCode, headers, body }` を return し、レスポンスはバッファされる | **SSE / ストリーミングは原理的に使えない** |
| E2 | データストアはメインキー + サブキーの JSON アイテムストア。JOIN・二次インデックス・集計なし | アクセスパターン起点のキー設計。集計は書き込み時に事前計算 |
| E3 | ZIP はルート直下に `index.js` と `package.json`。`"type": "module"` 不可（**CommonJS 必須**）。250MB 以下 | esbuild で単一 CJS にバンドル |
| E4 | データストアのアクセス数に月次上限（フリー 10,000 / エンタープライズ 3,000,000）。1 アイテム約 350KB | **1 論理単位 = 少数アイテム**に集約 |

詳細と出典は [references/constraints.md](references/constraints.md)。

## 2. 採る構成（この通りにする）

| レイヤ | 採用 |
| :--- | :--- |
| バックエンド | TypeScript + **Hono**（`hono/aws-lambda`） |
| バンドル | **esbuild**（`--bundle --platform=node --target=node22 --format=cjs`） |
| フロントエンド | **フレームワークなし。HTML + CSS + 素の JavaScript + esbuild のみ** |
| 配信 | **バックエンドの関数が静的ファイルを返す（同一オリジン）** |
| データストア | enebular データストア（`@uhuru/enebular-sdk`） |
| バリデーション | Zod（サーバ側の入力検証。FE と型・スキーマを共有） |
| モノレポ | pnpm workspaces + Turborepo |
| テスト | Vitest |
| CI/CD | GitHub Actions + `@uhuru/enebular-cli` |

**フロントエンドを別ホスティング（Vercel / Pages 等）に置かないこと。** ZIP に同梱し、関数が
`/`・`/app.js`・`/styles.css` を返す。CORS・Cookie の SameSite・デプロイ 2 系統・API ベース URL の
環境変数がまとめて消える。構成上いちばん効く判断。

フロントエンドにフレームワークを入れるのは、画面数と状態遷移がフレームワークの解く問題に達したときだけ。
入れる場合はユーザーに理由を説明して合意を取る（`sample/map-checkin` は地図 UI のため React を採用した例。
関数側・ビルド・静的配信の構成はフレームワーク有無に関わらず同じ）。

依存の向き — `core` がどのパッケージにも依存しないことが重要。データストアも LLM もなしでテストできる:

```
apps/web       ──▶ packages/shared, core（マスキング等の共有純関数）
apps/function  ──▶ packages/shared, core, datastore
packages/core  ──▶ packages/shared のみ
```

## 3. 実装の進め方

各段階でテストを書きながら進める。段階 3 を飛ばさないこと（ZIP が作れない構成に後から気づくと高くつく）。

1. モノレポの骨格 — ルート `package.json` / `pnpm-workspace.yaml` / `turbo.json` / `tsconfig.base.json` / eslint / `.gitignore`
2. `apps/function` の最小構成 — `index.ts` / `app.ts`（**3 通りマウント**）/ `local.ts` / `config.ts` / `GET /v1/health`
3. `build.mjs` と `zip-package.json` — **この時点で ZIP を作り、`require` して handler を検証できる状態にする**
4. `packages/shared`（型 + Zod）と `packages/datastore`（クライアントラッパ + テーブル解決 + リポジトリ 1 本）
5. `apps/web` の骨格と `static.ts` による同一オリジン配信 — **`?v=__ASSET_VERSION__` の仕組みをこの段階で入れる**
6. 業務ロジック（`packages/core` は純関数で、データストアなしでテストできる形に保つ）
7. `ci.yml` → `deploy-function.yml`（ZIP レイアウト検証とスモークテストを含む）
8. `docs/` に構成・ADR・デプロイ手順・データモデル・API 仕様を書く

コードの骨子は [references/scaffold.md](references/scaffold.md)、CI/CD は [references/deploy.md](references/deploy.md)。

## 4. 特に外してはいけない 5 点

実装中に何度も戻ってくる点。詳細と再現条件は [references/pitfalls.md](references/pitfalls.md)。

1. **前段キャッシュは `no-cache` を無視する。** 実行環境の前段（Cloudflare）が拡張子で判断し、
   `.css` と `.js` を `max-age=14400` に上書きする。**URL を変えるしかない** →
   `index.html` に `href="styles.css?v=__ASSET_VERSION__"` を書き、配信時にコミットハッシュへ置換。
   **この仕組みはテストで固定する。** 症状は「デプロイしたのに画面が変わらない」。デプロイ失敗より気づきにくい。
2. **HTTP トリガーはトリガーのパスを含めてハンドラを呼ぶ。** 同じルート定義を `/`・`/:base`・`/:base/` の
   3 通りにマウントして吸収する。**トリガーのパスを環境変数で持たない**（ずれた瞬間に全リクエスト 404）。
3. **`getItem` の "Not found" は正常系。** `getItem` 専用の `runGet` で `undefined` に落とす。
   503 にするとサインアップが原理的に成立しない。`putItem` / `query` / `deleteItem` の "not found" は吸収しない。
4. **データストア SDK は文字列を throw することがある。** 文字列 = 操作エラー（`failed`）、
   `Error` = プロキシに到達不可（`threw`）。両方を 1 箇所で正規化する。`cause.message` だけ見ると原因が消える。
5. **設定不足で起動を止めない。** `configOk: false` を返せる状態で立ち上がる。throw すると `/v1/health` すら
   返らず、最も切り分けにくい状態になる。

## 5. 運用のための仕込み

**`GET /v1/health`（認証不要の唯一のエンドポイント）** は次を返す:

```jsonc
{
  "status": "ok",
  "version": "0.1.0",
  "commit": "<git sha>",   // デプロイしたコミットが実際に動いているかを機械的に確認する
  "builtAt": "...",
  "mockMode": false,       // 本番で true のまま公開していないかの目視確認用
  "configOk": true,
  "configMissing": 0,      // 件数だけ。キー名は出さない（認証不要のため）
  "limits": { }            // 実際に効いている上限値
}
```

**環境変数の設定漏れ検出（`config.ts`）**:

- 動作モードに応じて必須項目が変わるので、手作業のチェックリストではなく**コードで持つ**
- `.env.example` の雛形値（`00000000-0000-0000-0000-000000000000` / `change-me`）は**未設定と同じ扱い**
- **不足キー名は `/v1/health` に出さない。起動時ログにだけ出す。値はどこにも出さない**
- 環境変数の読み取りは**呼び出しのたびに行う**（モジュール読み込み時に固めない）

**ローカル開発**:

```bash
pnpm dev:web    # apps/web の監視ビルド（別ターミナル）
pnpm dev        # tsx watch --env-file-if-exists=../../.env src/local.ts → http://localhost:8787
```

- ローカルは Lambda を介さず**同じ `app` を `@hono/node-server` で起動**する
- **データストアだけはローカルで代替できない**（実行環境が接続情報を注入するため）。この事実を README に
  正直に書き、通しの導線確認は**同じインターフェースの fake に差し替えた統合テスト 1 本**で行う
- 外部依存（LLM 等）を使うなら `MOCK_MODE` を**最初に**実装する。後から入れると分岐の差し込み箇所が
  散って高くつく。分岐は各関数の**入口 1 箇所**に置く

## 6. 完了報告の前に

[references/checklist.md](references/checklist.md) の 14 項目をレビューする。

**「動いた」と報告する前に、実際にコマンドを実行して結果を確認すること。未実施のことを実施済みと書かない。**
