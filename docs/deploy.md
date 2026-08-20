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
| 2 | データストアのテーブルを3つ作成（キーは下記） | テーブル ID × 3 |
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

| テーブル | メインキー | サブキー | 型 | 環境変数 |
| :--- | :--- | :--- | :--- | :--- |
| スポット | `areaKey` | `spotId` | 文字列 / 文字列 | `DS_TABLE_SPOTS` |
| ユーザー | `userKey` | `recordKey` | 文字列 / 文字列 | `DS_TABLE_USERS` |
| **歩いたところ** | `userKey` | `tileKey` | 文字列 / 文字列 | `DS_TABLE_EXPLORED_TILES` |

**「歩いたところ」は FR-02-7 で追加した。** 作り忘れると **`/v1/exploration` だけが 500 に
なる。** 他は正常に見えるので気づきにくい（地図もスポットも出る）。

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

### 先に `MAX_SPOTS_PER_REQUEST` を確認する

**既定の 200 のままだと AED しか表示されない。**

データストアの query は**サブキーの昇順**で返す。`spotId` は `<出典>-<ハッシュ>` なので、
辞書順で先頭の `aed`（224件）だけで200件が埋まり、**避難所・トイレ・給水が1件も出ない。**

| カテゴリ | 全件 | 上限200のとき |
| :--- | ---: | ---: |
| aed | 224 | 200 |
| shelter | 72 | **0** |
| toilet | 36 | **0** |
| water | 38 | **0** |

全件を入れるなら `MAX_SPOTS_PER_REQUEST=400` にする（envVars。再デプロイ不要）。
撮影ルートで絞り込むなら 200 のままでよい。

打ち切られた場合は**画面に警告が出て、実行環境のログにも記録される**
（`[spots] truncated at 200`）。黙って切れることはない。

### 投入（スクリプトで全件入れる）

**1リクエストで全件は入らない。** 連続して速く書くとスロットリングされるので間隔が必要で、
370件だと実行環境のタイムアウトに当たる。範囲を区切って何回も呼ぶことになるが、
手で回すと `offset` を間違える。**スクリプトを使う。**

```bash
export HTTP_TRIGGER_URL=https://lcdp002.enebular.com/imanouchi
export ADMIN_KEY=<管理キー>

pnpm seed              # 全件入れる（終わるまで繰り返す）
pnpm seed -- --reset   # 先に全部消してから入れ直す
pnpm seed -- --purge-only
pnpm seed -- --count 30 --delay 400
```

**詰まったら待って緩めて続ける。** 実測では間隔 100ms（10件/秒）でも約198件目で詰まった。
既定は 200ms にしてあるが、それでも詰まる場合がある。

```
0〜49 を 50 件 累計 50/370 （間隔 200ms）
...
  詰まりました。5 秒待って、間隔 400ms・1回 25 件に落として続けます
150〜174 を 25 件 累計 175/370 （間隔 400ms）
```

**冷却は 5 → 15 → 30 → 60 秒**と伸ばし、そのたびに間隔を倍・件数を半分にする。
4回続けて進まなければ諦める。`再試行` や `間隔` の表示が出たら、次回は
`--delay` を上げて始めた方が速い。

### 手で叩く場合

```bash
# まず1件だけ入れて、設定が正しいかを確かめる
curl -X POST "$HTTP_TRIGGER_URL/v1/admin/seed?count=1" -H "x-admin-key: $ADMIN_KEY"
# → { "total": 370, "from": 0, "to": 1, "inserted": 1, "nextOffset": 1, "retries": 0 }
```

`nextOffset` を次の `offset` に渡して、`null` になるまで繰り返す。

**LINE ログインは不要。** 管理キーだけで認証する（運用者が端末や CI から叩くため）。

| クエリ | 既定 | 意味 |
| :--- | ---: | :--- |
| `offset` | 0 | 何件目から入れるか（0 起点） |
| `count` | 50 | 何件入れるか（**最大 200**。既定の間隔だと 200 件で 20 秒かかる） |
| `delayMs` | **200** | 1件ごとの間隔。詰まると自動で広がる（最大1000ms） |

`putItem` はキー指定の上書きなので、**同じ位置から再実行すれば続きから埋まる。**

### やり直す（消してから入れ直す）

```bash
pnpm seed -- --reset
```

**ただし削除もアクセス数を消費する。** 370件消して370件入れると 740 回以上使う。

**入れ直しを繰り返すなら `AREA_ID` を変える方が安い。** パーティションが変わるので古い分は
引かれなくなり、**削除のアクセスがゼロで済む。**

```
AREA_ID=chiyoda-minato-demo
```

古いデータはデータストアに残るが、アプリからは見えない。デモの範囲では害がない。

### 投入が失敗したとき

```json
{"error":{"code":"DATASTORE_UNAVAILABLE","details":{"operation":"putItem","kind":"failed",...}}}
```

`kind: "failed"` は「操作は届いたが失敗した」で、**テーブル不在・キー不正・上限のいずれでも
同じ値になる。** レスポンスだけでは切り分けられない。

**実行環境のログに理由が出る。**

```
[datastore] putItem failed: <データストアが返した理由>
```

| ログの内容 | 原因 |
| :--- | :--- |
| キー名・必須項目に関する記述 | テーブルのメインキー／サブキーの名前が `areaKey` / `spotId` になっていない |
| テーブルが見つからない旨 | `DS_TABLE_SPOTS` の UUID 違い |
| 上限・スロットリングに関する記述 | アクセス数の上限（E4）。`delayMs` を入れるか、投入件数を減らす |

**切り分けは `?count=1` が早い。** 1件でも失敗するなら設定の誤りで、件数を減らしても直らない。
1件は通るのに途中で止まるなら速度か上限の問題なので、`delayMs=100` を付けて `count` を小さくする。

### アクセス数を無駄に使わないために

**370件は入れ直しに向かない。** 撮影ルートが決まっているなら、先に絞り込んでから入れる。

```bash
pnpm ingest -- --center 35.676,139.732 --radius 800 --cap aed=60
```

赤坂・永田町周辺なら半径 800m で4カテゴリが揃い、14件で収まる（データの偏りにより、
AED は港区のみ・公衆トイレは千代田区のみに存在するため、4カテゴリが揃う地点は限られる）。

### ★ 投入したスポットは消せない

`seed` は追加だけで、削除の経路が無い。あとで撮影ルートに絞り込んで入れ直しても、
**先に入れた分が残って表示される。**

入れ直すときは `AREA_ID` を変える。パーティションが変わるので、古い分は引かれなくなる。

```
AREA_ID=chiyoda-minato-demo
```

```bash
pnpm ingest -- --center 35.669,139.753 --radius 1200 --cap aed=60
```

## 5. デプロイ後の確認

```bash
curl -s "$HTTP_TRIGGER_URL/v1/health"
# → {"status":"ok","commit":"<デプロイしたコミット>","configOk":true,"configMissing":0}
```

`configOk` が false のときは、**管理キーで名前を確認できる。**

```bash
curl -s "$HTTP_TRIGGER_URL/v1/admin/config" -H "x-admin-key: $ADMIN_KEY"
# → {"configOk":false,"missing":["DS_TABLE_EXPLORED_TILES"],"area":{...},"seedDataset":"opendata"}
```

`/v1/health` は認証不要なので**件数しか返さない**。「1件足りない」と分かっても
何が足りないかは分からないため、こちらを使う。**値は返さず、名前だけ**を返す。

実行環境のログにも出る。

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
| **`/v1/exploration` だけ 500、他は正常** | `explored_tiles` テーブルまたは `DS_TABLE_EXPLORED_TILES` の作成漏れ | テーブルを作り、UUID を envVars へ |
| **デプロイは成功するがスモークテストで `configOk が false`** | 必須の環境変数が足りない（テーブル追加後に起きやすい） | `/v1/admin/config` で名前を確認する。**コードは既に稼働しているので再デプロイは不要** |
| 霧が出ない（地図がそのまま） | `MAPBOX_ACCESS_TOKEN` 未設定で一覧表示になっている | `/v1/client-config` の `mapboxToken` を確認 |
| 地図が動かない・ピンが押せない | 霧のキャンバスが操作を奪っている | `.map__fog` の `pointer-events: none` が効いているか |
| 地図が出ず一覧になる | `MAPBOX_ACCESS_TOKEN` 未設定 | `/v1/client-config` の `mapboxToken` を確認 |
| ログインで 401 | IDトークンの検証に失敗 | ログの `[auth] line verify failed: <理由>` を見る |
| 「LINE からユーザー情報を取得できませんでした」 | LIFF に `openid` スコープが無い | LINE Developers 側で付与 |
| スモークテストで commit 不一致 | ZIP の差し替え漏れ | ファイルアセットの版が上がっているか確認 |
| **投入が `putItem` の `failed` で落ちる** | テーブル不在・キー不正・上限のいずれか | ログの `[datastore] putItem failed: ...` を見る。`?count=1` で切り分け |
| 投入が途中で止まる | 書き込みが速すぎる（実測：間隔なしで約280件目、100msで約198件目） | `pnpm seed` を使う（待って緩めて続ける）。手で叩くなら `delayMs` を上げて `nextOffset` から |
| **削除が 0 件で終わる** | `AREA_ID` が変わっている（別パーティションを見ている） | 消したい側の `AREA_ID` に戻してから実行する |

## LINE ログインの確認について

**素のブラウザでは完走しない。** LIFF アプリのエンドポイントURLに
`$HTTP_TRIGGER_URL/` を登録し、**LINE アプリから LIFF URL
（`https://miniapp.line.me/<LIFF ID>`）で開く**必要がある。

開発用の内部チャネルは、**コンソールで登録・承認したテスターだけ**が開ける。
デモに参加する人は先に登録しておく。

`LIFF_ID` と `LINE_CHANNEL_ID` は内部チャネル（開発用・審査用・本番用）ごとに
別の値で、**LIFF ID は `<チャネルID>-<ランダム文字列>` という形**になっている。
組み合わせが違うと起動時の検査で `configOk` が false になる。
