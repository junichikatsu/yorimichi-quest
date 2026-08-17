# フォルダ構成とコードの骨子

参照実装: `sample/map-checkin/`（関数側・ビルド・静的配信はそのまま流用できる）。

## フォルダ構成

```
<repo>/
├── package.json            # pnpm workspace ルート（packageManager, engines.node >= 22）
├── pnpm-workspace.yaml     # packages: apps/*, packages/*  /  allowBuilds: esbuild: true
├── turbo.json
├── tsconfig.base.json      # strict / noUncheckedIndexedAccess / verbatimModuleSyntax / noEmit
├── .env.example            # 必要な環境変数の一覧（値は入れない）
│
├── apps/
│   ├── web/                        # フロントエンド（バンドラのみ）
│   │   ├── build.mjs               #   esbuild: src/main.js → public/app.js（iife / minify:false）
│   │   ├── src/                    #   入力。素の JS（`// @ts-check` + JSDoc）
│   │   │   ├── main.js             #     画面遷移と配線
│   │   │   ├── api.js              #     API 呼び出し規約（相対パス・202 再送・Retry-After）
│   │   │   └── dom.js …            #     描画ユーティリティ
│   │   └── public/
│   │       ├── index.html          #   1 枚
│   │       ├── styles.css          #   1 枚
│   │       └── app.js              #   ★生成物。.gitignore に入れる
│   │
│   └── function/                   # enebular クラウド実行環境（ZIP）
│       ├── src/
│       │   ├── index.ts            #   exports.handler（Lambda エントリ）
│       │   ├── app.ts              #   Hono アプリ本体（3 通りマウント）
│       │   ├── local.ts            #   ローカル起動（@hono/node-server）
│       │   ├── static.ts           #   静的ファイル配信
│       │   ├── config.ts           #   環境変数の設定漏れ検出
│       │   ├── build-info.d.ts     #   __BUILD_INFO__ / __STATIC_ASSETS__ の型宣言
│       │   ├── routes/             #   ルート定義
│       │   ├── middleware/         #   auth / validate / rate-limit / error-handler
│       │   └── services/           #   core・datastore を束ねる層
│       ├── build.mjs               #   esbuild バンドル + ZIP 生成
│       ├── zip-package.json        #   ZIP に同梱する最小 package.json
│       └── package.json            #   "type": "module"（ZIP 側とは別物）
│
├── packages/
│   ├── shared/                     # 型と Zod スキーマ（= API 契約）
│   ├── core/                       # ドメインロジック（純関数・外部依存なし）
│   └── datastore/                  # enebular データストアのリポジトリ層
│
└── .github/workflows/
    ├── ci.yml                      # typecheck / lint / test / ZIP ビルド検証
    └── deploy-function.yml         # ZIP ビルド → enebular デプロイ
```

## エントリポイント `apps/function/src/index.ts`

```ts
import { handle } from 'hono/aws-lambda'
import { app } from './app'
import { logConfigIssues } from './config'

// コールドスタート時に 1 回だけ設定漏れをログへ（キー名はここにしか出さない）
logConfigIssues()

// ハンドラ指定は index.handler。esbuild が CJS へ変換し module.exports.handler になる
export const handler = handle(app)
```

## ルーティング `apps/function/src/app.ts`

```ts
export function createApp() {
  const app = new Hono<AppEnv>()

  app.route('/',       createRoutes())  // /v1/health           ローカル・テスト
  app.route('/:base',  createRoutes())  // /myapp/v1/health     トリガー経由
  app.route('/:base/', createRoutes())  // /myapp/              トリガーのルート URL

  app.onError((err, c) => toErrorResponse(err, c))
  app.notFound((c) => c.json({
    error: { code: 'NOT_FOUND', message: 'Not Found', path: c.req.path, method: c.req.method },
  }, 404))

  return app
}
```

理由は [pitfalls.md](pitfalls.md#2-http-トリガーはトリガーのパスを含めてハンドラを呼ぶ)。

**認証ミドルウェアはルートファイル側で個別に書かず、1 箇所でパス指定してまとめて適用する。**
各ルートで書く方式だと、ルート追加時に書き忘れる。忘れられる防御は防御ではない。

## 静的配信 `apps/function/src/static.ts`

要点は [pitfalls.md](pitfalls.md#4-静的ファイルの埋め込みに-js-の-text-ローダを使わない) を参照。
完全な実装は `sample/map-checkin/apps/function/src/static.ts`。骨子:

```ts
export interface StaticAsset { contentType: string; encoding: 'utf8' | 'base64'; body: string }
export const ASSET_VERSION_PLACEHOLDER = '__ASSET_VERSION__'

let loader: ((name: string) => StaticAsset | undefined) | undefined
export function setStaticAssetLoader(fn: typeof loader): void { loader = fn }

export function getAsset(name: string): StaticAsset | undefined {
  if (loader) return loader(name)                      // ローカル: ディスクから毎回読む
  return typeof __STATIC_ASSETS__ === 'undefined' ? undefined : __STATIC_ASSETS__[name]
}

export function assetVersion(): string {
  const commit = buildInfo().commit
  if (commit && commit !== 'dev' && commit !== 'unknown') return commit.slice(0, 12)
  return `dev-${LOCAL_VERSION}`                        // ローカルは起動時刻ベース
}

export function sendAsset(c: Context, name: string): Response {
  const asset = getAsset(name)
  if (!asset) throw new AppError('INTERNAL', 500, 'ASSET_NOT_BUILT', { asset: name })

  const headers = { 'content-type': asset.contentType, 'cache-control': 'no-cache' }
  if (asset.encoding === 'base64') {
    return c.body(Uint8Array.from(Buffer.from(asset.body, 'base64')), 200, headers)
  }
  return c.body(applyAssetVersion(asset.body), 200, headers)
}
```

## フロントの API 呼び出し規約 `apps/web/src/api.js`

```js
// トリガーのパス配下に置かれるため、ルート相対ではなく「現在のパス」を基準にする。
// `/v1/...` を直に叩くとトリガーの外に出る。
const API_BASE = location.pathname.endsWith('/')
  ? location.pathname.slice(0, -1)
  : location.pathname
```

- 環境変数を一切持たない（同一オリジンなので相対パスで足りる）
- `202 Accepted` は**エラーではなく待機**として扱い、`retryAfterMs` で再送するヘルパを用意する
- `429` の `Retry-After` ヘッダは同一オリジンだから読める
  （別ホストだと `Access-Control-Expose-Headers` が要る）
- **`innerHTML` を使わない**（[pitfalls.md](pitfalls.md#11-フロントに-innerhtml-を使わない)）

## `apps/function/build.mjs`（ZIP 生成）

処理順を**この通り**にする。完全な実装は `sample/map-checkin/apps/function/build.mjs`。

```
0) apps/web の build.mjs を execFileSync で実行する
   ★ public/app.js は生成物で git 管理しない。ここで作らずに読むと古い app.js が ZIP に入る
1) zip-package.json を読み、"type": "module" があれば throw して落とす
2) esbuild で src/index.ts → build/index.js（bundle / node22 / cjs / minify: true）
   define に __BUILD_INFO__（version, commit, builtAt）と __STATIC_ASSETS__ を埋め込む
   commit は CI では GITHUB_SHA、ローカルは git rev-parse HEAD、どちらも無ければ 'unknown'
   静的ファイルが 1 つでも読めなければ throw する
3) zip-package.json を build/package.json へコピー
4) build/index.js を require して typeof handler === 'function' を検証する
   ★ 文字列 grep はしない（pitfalls.md 9）
5) archiver で build/ の "中身" を ZIP ルートへ（archive.directory(dir, false) の false が肝）
6) 250MB 以下かを確認
```

`zip-package.json` — **`"type": "module"` を書かない**。`apps/function/package.json` 側は
`"type": "module"` なので、ファイルを分けてコピーするだけの運用にして、設定に引きずられて壊れないようにする:

```json
{
  "name": "myapp-function",
  "version": "0.1.0",
  "main": "index.js"
}
```

## `apps/web/build.mjs`

```js
{
  entryPoints: ['src/main.js'],
  outfile: 'public/app.js',
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'iife',      // ★ module にすると index.html 側で type="module" が要る
  minify: false,       // 配信される JS は読める状態に保つ（no-cache 配信なので数十 KB の差は出ない）
  sourcemap: false,
  banner: { js: '/* 生成物です。編集しないでください。編集先は apps/web/src/ です。 */' },
}
```

`--watch` 引数で esbuild の `context().watch()` に切り替え、ローカル開発では監視ビルドを併走させる。
