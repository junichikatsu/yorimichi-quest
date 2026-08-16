# アーキテクチャ

## 全体像

```
ブラウザ
  │  同一オリジン（HTTPS）
  ▼
enebular クラウド実行環境（ZIP / Node.js 22.x / AWS Lambda ベース）
  ├─ Hono（hono/aws-lambda）でパスルーティング
  ├─ 静的ファイル配信： index.html / styles.css / app.js / app.css
  │    → esbuild の define でバンドルに文字列として埋め込み済み
  └─ API： /v1/*
        │
        ▼
   enebular データストア（@uhuru/enebular-sdk 経由でプロキシ Lambda を呼ぶ）
        spots / users / checkins / user_spot_state
```

**フロントエンドを別ホスティングに置かない。** 同じ ZIP から同一オリジンで配信することで、
CORS・Cookie の SameSite・デプロイ 2 系統・API ベース URL の環境変数がまとめて不要になる。

## パッケージ構成と依存の向き

```
apps/web       ──▶ packages/shared, packages/core
apps/function  ──▶ packages/shared, packages/core, packages/datastore
packages/core  ──▶ packages/shared のみ
packages/datastore ──▶ packages/shared
```

`packages/core` はデータストアにも時刻にも依存しない純関数だけを持つ。
チェックイン可否とポイント計算（`evaluateCheckin`）はここにあり、境界値をそのままテストできる。

| パッケージ | 役割 |
| :--- | :--- |
| `packages/shared` | 型と Zod スキーマ（= API 契約）、ブランド型の ID |
| `packages/core` | 距離計算、未開拓判定、ポイント付与、チェックイン可否の純関数 |
| `packages/datastore` | データストアのクライアントラッパ、キー設計、リポジトリ、インメモリ fake |
| `apps/function` | Hono アプリ、ルート、ミドルウェア、静的配信、ZIP ビルド |
| `apps/web` | React + Mapbox GL JS のフロントエンド |

## enebular の制約と、それに対する設計

| 制約 | 設計 |
| :--- | :--- |
| レスポンスはバッファされる（SSE 不可） | 長時間処理を作らない。チェックインは同期完結 |
| データストアに JOIN・二次インデックス・集計が無い | アクセスパターン起点のキー設計。チェックイン数は**書き込み時に事前計算** |
| ZIP はルート直下に `index.js` / `package.json`、CommonJS 必須 | esbuild で単一 CJS にバンドル。`zip-package.json` を分離し `"type": "module"` を混入させない |
| データストアのアクセス数に月次上限 | 再チェックイン判定を `user_spot_state` の 1 件 `getItem` で済ませる（履歴走査をしない） |

## 意図的にプレイブックから外した点

| 項目 | プレイブック | 本サンプル | 理由 |
| :--- | :--- | :--- | :--- |
| フロントエンド | フレームワークなし（素の JS） | **React + TypeScript** | 依頼時の指定。ZIP 制約・同一オリジン配信・`?v=` 対策はそのまま踏襲しており、これらは React でも崩れない |
| `apps/web` の minify | `minify: false`（可読性優先） | **`minify: true`** | React + Mapbox GL JS では未圧縮が数 MB になり、Lambda のレスポンス上限（6MB）に近づく。「数十 KB の差」という前提が成り立たない |
| `innerHTML` 禁止の実現 | eslint で禁止 | eslint で禁止 **＋ JSX の自動エスケープ** | ルールはそのまま維持。DOM を直接触るマーカー生成でも `textContent` のみ使用 |

## 認証について（重要）

このサンプルに**認証はない**。`x-sample-user-id` ヘッダに載せた UUID をそのままユーザー識別子として扱うため、
他人の ID を騙れる。要件定義書 NFR-04（LIFF ID トークンのサーバー側検証）は未実装であり、
**公開環境に置かないこと**。本番実装時は `apps/function/src/middleware/auth.ts` を差し替える。
