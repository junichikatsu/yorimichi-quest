import { serve } from '@hono/node-server'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from './app.js'
import { loadConfig, missingConfigKeys } from './config.js'
import { contentTypeFor, isTextContentType, setStaticAssetLoader } from './static.js'

/**
 * ローカル起動。
 *
 * Lambda を介さず、デプロイと同じ `app` を @hono/node-server で立ち上げる。
 * 静的ファイルはディスクから毎回読み直すので、HTML/CSS を編集したらリロードで反映される。
 * node:fs をここに閉じ込め、index.ts 経由の Lambda バンドルには入れない。
 */

const here = dirname(fileURLToPath(import.meta.url))
const webPublicDir = join(here, '..', '..', 'web', 'public')

setStaticAssetLoader((name) => {
  const path = join(webPublicDir, name)
  if (!existsSync(path)) return undefined

  const contentType = contentTypeFor(name)
  if (isTextContentType(contentType)) {
    return { contentType, encoding: 'utf8', body: readFileSync(path, 'utf8') }
  }
  return { contentType, encoding: 'base64', body: readFileSync(path).toString('base64') }
})

// ローカルはデータストアへ接続できないため、既定でインメモリ実装を使う
process.env['USE_FAKE_DATASTORE'] ??= 'true'
process.env['ADMIN_KEY'] ??= 'local-admin-key'
/*
 * ★ 開発用ログインを既定で有効にする。
 *
 * LIFF はエンドポイント URL に公開URLを登録した状態で LINE アプリから開く必要が
 * あるため、**ローカルでは LINE ログインが完走できない。** そのため、ログインが要る
 * 機能（チェックインの保存・カード）を手元で確かめられなかった。
 *
 * ★ ここで有効にするのは安全である。このファイルはローカル起動専用で、
 * デプロイする ZIP の入口は index.ts であり、**local.ts は含まれない。**
 */
process.env['ENABLE_DEV_LOGIN'] ??= 'true'

const port = Number(process.env['PORT'] ?? 8787)
const config = loadConfig()
const missing = missingConfigKeys(config)

if (missing.length > 0) {
  console.warn(`[config] missing environment variables: ${missing.join(', ')}`)
}
if (config.mapboxToken === '') {
  console.warn(
    '[config] MAPBOX_ACCESS_TOKEN が未設定です。地図は表示されず、一覧表示にフォールバックします。',
  )
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`YORIMICHI QUEST sample: http://localhost:${info.port}/`)
  console.log(`  health : http://localhost:${info.port}/v1/health`)
  console.log(`  fake datastore: ${loadConfig().useFakeDataStore ? 'ON' : 'OFF'}`)
})
