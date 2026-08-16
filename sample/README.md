# サンプル実装

技術検証やデモのためのサンプルを置く場所です。**正式な開発ではありません。**

各サンプルは `sample/<名前>/` 以下に**独立した pnpm ワークスペース**として置きます。
サンプル同士は依存せず、`pnpm-lock.yaml` も CI ワークフローもサンプルごとに分かれています。
1つのサンプルを消しても他に影響しません。

## 一覧

| サンプル | 内容 | 技術 | 状態 |
| :--- | :--- | :--- | :--- |
| [map-checkin](map-checkin/) | 平時モードのコア体験（地図表示・チェックイン・ポイント付与）。要件定義書 FR-02 / FR-03 / FR-07 / FR-10 / FR-11 に対応 | React + TypeScript / Mapbox GL JS / Hono / enebular（クラウド実行環境 + データストア） | enebular にデプロイ済み |

## 新しいサンプルを追加するとき

1. **ディレクトリを作る**: `sample/<名前>/`
   名前は「何をするサンプルか」が分かるもの（`map-checkin` のように機能ベース）にする
2. **独立したワークスペースにする**: `package.json` / `pnpm-lock.yaml` をそのディレクトリに置く。
   親（`sample/`）にワークスペース設定は置かない
3. **パッケージスコープをサンプル名に合わせる**: `@<名前>/shared` のように。
   スコープを共有するとサンプル間で名前が衝突する
4. **`.gitignore` はサンプル内に置く**: 生成物（バンドル・ZIP）のパスはサンプルごとに違うため
5. **README を書く**: 何のサンプルか、対応する要件、動かし方、注意点（未実装・非本番の箇所）
6. **CI ワークフローを追加する**: `.github/workflows/sample-<名前>-ci.yml`。
   `paths` フィルタと `working-directory` をそのサンプルに限定する
   （既存の [sample-map-checkin-ci.yml](../.github/workflows/sample-map-checkin-ci.yml) をひな形にできる）
7. **この表に1行足す**

### 命名の対応関係

`map-checkin` を例にすると、名前は次の場所に現れます。追加時はまとめて揃えてください。

| 箇所 | 値 |
| :--- | :--- |
| ディレクトリ | `sample/map-checkin/` |
| ルート package name | `map-checkin-sample` |
| パッケージスコープ | `@map-checkin/shared` など |
| CI ワークフロー | `.github/workflows/sample-map-checkin-ci.yml` |
| デプロイワークフロー | `.github/workflows/sample-map-checkin-deploy.yml` |
| 成果物（該当する場合） | `map-checkin-function.zip` |
| ブラウザの保存領域キー | `map-checkin:user-id`（localStorage / sessionStorage / Cookie 名） |

> 最後の行は見落としやすい点です。**同じホストの別パスに複数サンプルをデプロイすると localStorage は共有されます**
> （例: `https://<host>/sample-a` と `https://<host>/sample-b` は同一オリジン）。
> キーにサンプル名を含めないと、サンプル間で状態が混ざります。

## 共通の注意

- サンプルには**本番相当の認証を入れていません**。公開環境に置かないでください
- サンプルが表示するデータは**デモ用の架空データ**です。実在の施設情報として扱わないでください
- デプロイ先の資格情報は GitHub Environment（Secrets / Variables）で管理し、
  アプリの実行時設定は実行環境側（enebular の `envVars` など）に置きます。**リポジトリにコミットしません**
