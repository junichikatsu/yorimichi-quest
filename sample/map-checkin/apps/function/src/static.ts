import type { Context } from 'hono'
import { buildInfo } from './config.js'
import { AppError } from './errors.js'

/**
 * 静的ファイルの同一オリジン配信。
 *
 * フロントエンドを別ホスティングに置かず、この関数が index.html / app.js / CSS を返す。
 * これで CORS・Cookie の SameSite・デプロイ 2 系統・API ベース URL の環境変数がまとめて消える。
 */

export interface StaticAsset {
  contentType: string
  encoding: 'utf8' | 'base64'
  body: string
}

export const ASSET_VERSION_PLACEHOLDER = '__ASSET_VERSION__'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

export function contentTypeFor(name: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot < 0 ? '' : name.slice(dot)
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export function isTextContentType(contentType: string): boolean {
  return contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('svg')
}

type AssetLoader = (name: string) => StaticAsset | undefined

let loader: AssetLoader | undefined

/**
 * ローカル起動時にディスク読み込み関数を差し込む（local.ts から呼ぶ）。
 * リクエストごとに読み直すので HTML/CSS を編集したらリロードだけで反映される。
 * node:fs を index.ts 側に持ち込まない（Lambda のバンドルに入れないため）。
 */
export function setStaticAssetLoader(fn: AssetLoader | undefined): void {
  loader = fn
}

function embeddedAssets(): Record<string, StaticAsset> {
  if (typeof __STATIC_ASSETS__ === 'undefined') return {}
  return __STATIC_ASSETS__
}

export function getAsset(name: string): StaticAsset | undefined {
  if (loader) return loader(name)
  return embeddedAssets()[name]
}

/**
 * 前段（Cloudflare）が拡張子で Cache-Control を上書きし、CSS と JS は max-age=14400 になる。
 * ヘッダを通せないので URL を変える。index.html は素通しで届くため、そこに版を差し込む。
 */
export function assetVersion(): string {
  const commit = buildInfo().commit
  if (commit && commit !== 'dev' && commit !== 'unknown') return commit.slice(0, 12)
  // ローカルは起動時刻ベースにして毎回変える
  return `dev-${LOCAL_VERSION}`
}

const LOCAL_VERSION = Date.now().toString(36)

export function applyAssetVersion(text: string): string {
  return text.split(ASSET_VERSION_PLACEHOLDER).join(assetVersion())
}

export function sendAsset(c: Context, name: string): Response {
  const asset = getAsset(name)
  if (!asset) {
    // 白画面でデプロイされるより、原因が分かる 500 を返す方がよい
    throw new AppError('INTERNAL', 500, 'ASSET_NOT_BUILT', { asset: name })
  }

  const headers = {
    'content-type': asset.contentType,
    // 前段に上書きされる場合があるため ?v= と併用する
    'cache-control': 'no-cache',
  }

  if (asset.encoding === 'base64') {
    const bytes = Uint8Array.from(Buffer.from(asset.body, 'base64'))
    return c.body(bytes, 200, headers)
  }

  return c.body(applyAssetVersion(asset.body), 200, headers)
}
