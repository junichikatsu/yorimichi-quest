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
        spots / users / checkins / user_spot_state / explored_tiles
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

探索グリッドの量子化（`tileOf`）も core に置いている。**FE と BE が同じ関数で判定する**ことが
前提の設計で、片方だけずれると「送ったのに塗られない」「同じ場所を送り続ける」が起きる。

| パッケージ | 役割 |
| :--- | :--- |
| `packages/shared` | 型と Zod スキーマ（= API 契約）、ブランド型の ID |
| `packages/core` | 距離計算、未開拓判定、ポイント付与、チェックイン可否、探索グリッドの純関数 |
| `packages/datastore` | データストアのクライアントラッパ、キー設計、リポジトリ、インメモリ fake |
| `apps/function` | Hono アプリ、ルート、ミドルウェア、静的配信、ZIP ビルド |
| `apps/web` | React + Mapbox GL JS のフロントエンド |

## enebular の制約と、それに対する設計

| 制約 | 設計 |
| :--- | :--- |
| レスポンスはバッファされる（SSE 不可） | 長時間処理を作らない。チェックインは同期完結 |
| データストアに JOIN・二次インデックス・集計が無い | アクセスパターン起点のキー設計。チェックイン数は**書き込み時に事前計算** |
| ZIP はルート直下に `index.js` / `package.json`、CommonJS 必須 | esbuild で単一 CJS にバンドル。`zip-package.json` を分離し `"type": "module"` を混入させない |
| データストアのアクセス数に月次上限 | 再チェックイン判定を `user_spot_state` の 1 件 `getItem` で済ませる（履歴走査をしない）。歩いた場所はタイルへ丸めて重複を落とし、書き込みを面積比に抑える |

## 歩いたところの塗りつぶし（フォグ・オブ・ウォー）

未踏エリアを霧で覆い、歩いたところだけ晴らす。地図の上に重ねた **2D canvas** へ毎フレーム描いている。

```
1. 画面全体を霧色で塗る
2. globalCompositeOperation = 'destination-out' にする
3. 探索済みタイルの位置へ、外周をぼかした円を描く → 霧が削れる
```

Mapbox の fill レイヤ（穴あきポリゴン）を使わなかったのは、**円が重なると穴あきポリゴンが破綻する**ため。
正しく描くには円の和集合を先に計算する必要があり、turf.js のような幾何ライブラリが要る。
canvas の合成なら重なりはブラウザ側が処理するので、依存を増やさずに済み、
外周をぼかした「霧が晴れる」表現もそのまま出せる。

| 論点 | 対応 |
| :--- | :--- |
| 地図の操作を邪魔しない | canvas は `pointer-events: none`。クリックは下の地図へ抜ける |
| 地図の移動へ追従する | `map.on('move')` で再描画（アニメーション中も毎フレーム発火する） |
| 半径の計算が投影に依存する | 地図を `projection: 'mercator'` に固定（既定の globe だと低ズームでずれる） |
| 歩くほどタイルが増える | 画面外のタイルは描画をスキップ |

霧の半径（`EXPLORE_REVEAL_RADIUS_M`）はタイル幅より小さいが、隣接タイルの円が重なるため軌跡は繋がる。
一方で**探索率と面積はタイル面積で数える**ので、見た目より数値のほうが控えめに出る（水増ししない）。

## 現在地への追従

測位できている間は地図の中心を現在地に合わせ続ける。地図の初期中心はエリア中心（`AREA_CENTER_*`）で、
最初の位置が届いた時点で現在地へ移す。

| 論点 | 対応 |
| :--- | :--- |
| 利用者が地図を動かしたら追従をやめたい | `movestart` に `originalEvent` が付いているかで、指の操作と `easeTo` を見分ける |
| 追従を再開したい | 地図右下の現在地ボタン。追従中は青く表示する |
| スポットを選ぶと現在地へ引き戻される | スポット選択時に追従を解除する |
| 起動直後に地図が流れて見える | 初回だけ `jumpTo`（アニメーションなし）、以降は `easeTo` |

`watchPosition` は歩いている間ほぼ毎秒届く。そのたびにスポット一覧を取り直すとレート制限
（`RATE_LIMIT_PER_MINUTE`、既定 60 req/分）に達するので、**一定距離（25m）動くまでは取り直さない**。
チェックイン半径（既定 100m）より十分小さいため、圏内判定が古くなることはない。
歩いたところの記録（`useExploration`）は別系統で、タイル単位の重複排除と 4 秒のまとめ送信で間引いている。

## スマートフォン表示

| 論点 | 対応 |
| :--- | :--- |
| アドレスバーの伸縮で画面下が隠れる | `.app` の高さを `100dvh`（`100%` をフォールバックに残す） |
| ノッチ・ホームインジケータに文字がかかる | `viewport-fit=cover` に合わせ、ヘッダ・フッタ・サイドバーへ `env(safe-area-inset-*)` |
| 縦積み時に地図とサイドバーの合計が画面を超える | 行を `minmax(0, 52%) minmax(0, 48%)` にし、`.map` の `min-height` を 0 へ戻す |
| ステータスバーが半端に折り返す | 600px 以下で `order` を入れ替え、1 段目にタイトルと位置情報、2 段目に数値を 3 分割 |
| マーカーが指で押しにくい | `@media (pointer: coarse)` でマーカーと閉じるボタンを拡大（NFR-08） |
| 地図を払うと引っ張って更新が動く | `body` に `overscroll-behavior: none` |

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
