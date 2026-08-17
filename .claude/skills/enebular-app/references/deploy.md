# enebular 側セットアップと CI/CD

## 1. 初回セットアップ（手動・コンソール）

CLI は既存のアセットと実行環境に対して動くため、最初の 1 回はコンソールで作る。
**この手順書もプロジェクトの `docs/` に書き残すこと。**

| # | 作業 | 取得する ID |
| :--- | :--- | :--- |
| 1 | プロジェクトを作成 | `PROJECT_ID` |
| 2 | データストアのテーブルを作成（キー名と型を指定） | テーブル ID × N |
| 3 | ZIP をファイルアセットとして登録（`--deploy-type cloud --handler index.handler`） | `ASSET_ID` |
| 4 | ZIP 向けクラウド実行環境を作成（ランタイム Node.js 22.x） | `CLOUD_ID` |
| 5 | HTTP トリガーを有効化しパスを設定（インスタンス内で一意） | トリガー URL |
| 6 | **`connectDataStore` を有効化**し、環境変数（`envVars`）を設定 | — |
| 7 | アクセスキー / シークレットキーを発行 | `ENEBULAR_ACCESS_KEY` / `ENEBULAR_SECRET_KEY` |

> 手順 3 は ZIP の実体を要求する。実装前に進めるなら、200 を返すだけの最小 ZIP を登録し、以降 CI で差し替える。

環境ごと（staging / development）に 3〜5 を繰り返し、**トリガーのパスも変える**。
フロントは相対パスなので画面側の設定は不要。

> **`envVars` に API キーが含まれるなら、設定ファイルをリポジトリにコミットしないこと。**
> `envVars` はコンソールで手動管理し、**CI が知るシークレットは enebular のアクセスキーだけ**にする。

## 2. GitHub Actions

### `ci.yml`

checkout → pnpm/action-setup → setup-node(22, cache: pnpm) → `pnpm install --frozen-lockfile`
→ typecheck → lint → test → **ZIP ビルド（dry run）**

### `deploy-function.yml`

デプロイ先は **GitHub Environment** で切り替える。

- Secrets（Environment ごと）: `ENEBULAR_ACCESS_KEY` / `ENEBULAR_SECRET_KEY`
  → **値の前後に空白や改行があると認証エラー**になるため、冒頭で空チェックする
- Variables（Environment ごと）: `ENEBULAR_PROJECT_ID` / `ENEBULAR_CLOUD_ID` /
  `ENEBULAR_FILE_ASSET_ID` / `HTTP_TRIGGER_URL`
- 最初は **`workflow_dispatch` のみ**にして、push トリガーはコメントアウトで置いておく
  （意図しないタイミングでデモ環境が入れ替わるのを避ける）
- `concurrency` で同一環境への同時デプロイを止める

### CLI の実行順序

```bash
enebular update file  --project-id … --asset-id … --file "$ZIP_PATH" --json
enebular deploy cloud --project-id … --cloud-id … --asset-id … --asset-type file --json
enebular add file-version --project-id … --asset-id … --name … --comment … --json
```

- **`--json` を必ず付ける**（無いと確認プロンプトで workflow が停止する。`--yes` でも可）
- **`--asset-type` は `file`**（`flow` は Node-RED 用。ブログ記事の例に引きずられない）
- `add file-version` の `--name` は **1〜30 文字の英数字・アンダースコア・ハイフンのみ**。
  ブランチ名（`feat/xxx`）やタグ（`v1.0.0`）はそのままでは通らない。
  **弾かずに整形する**（`tr -c 'A-Za-z0-9_-' '-'` → 前後のハイフン除去 → 30 文字カット → 空なら既定値）。
  ここで失敗させると「ZIP のデプロイは済んでいるのにバージョン記録だけ落ちる」分かりにくい壊れ方になる

## 3. ZIP レイアウトの機械検証（デプロイ前に必ず入れる）

1. ルート直下に `index.js` と `package.json` があるか（`unzip -Z1` の完全一致で確認）
2. ZIP 内 `package.json` に `"type": "module"` が**ない**か
3. 展開して `require()` し、`typeof m.handler === 'function'` か
4. 250MB 以下か

## 4. デプロイ後のスモークテスト

15 秒待ってから `GET $HTTP_TRIGGER_URL/v1/health` を叩き、次を確認する。

- `200` が返るか
- **`commit` が `$GITHUB_SHA` と一致するか**（ZIP 差し替え漏れの検出。これが効く）
- `configOk` が true か
