import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { setStaticAssetLoader } from './static.js'

/**
 * 静的ファイルの配信。
 *
 * ★ 「ルートはあるが ZIP に入っていない」は**本番でだけ 500 になる**。
 * ローカルはディスクから読むので気づけない。ここで組み合わせを固定する。
 */

const here = dirname(fileURLToPath(import.meta.url))
const routesSource = readFileSync(join(here, 'routes', 'index.ts'), 'utf-8')
const buildSource = readFileSync(join(here, '..', 'build.mjs'), 'utf-8')

/** ルートが返している静的ファイル名（sendAsset の呼び出しから拾う） */
function servedAssets(): string[] {
  const names = new Set<string>()
  for (const match of routesSource.matchAll(/sendAsset\(c, '([^']+)'\)/g)) {
    names.add(match[1]!)
  }
  return [...names]
}

const TRIGGER_PATH = '/imanouchi'

beforeEach(() => {
  // 開発用ページの経路が開く条件（ローカル起動と同じ状態）
  process.env['USE_FAKE_DATASTORE'] = 'true'
  process.env['ENABLE_DEV_LOGIN'] = 'true'
  // 実ファイルではなく名前をそのまま返す。配線だけを見る
  setStaticAssetLoader((name) => ({
    contentType: 'text/html; charset=utf-8',
    encoding: 'utf8',
    body: `<!-- ${name} -->`,
  }))
})

afterEach(() => {
  setStaticAssetLoader(undefined)
  delete process.env['USE_FAKE_DATASTORE']
  delete process.env['ENABLE_DEV_LOGIN']
})

/**
 * 開発用のページ。
 *
 * ★ ルートを**開発用に閉じてある**（インメモリ実装のときだけ返す）ので、ZIP に
 * 入れない。本番に置いても中身を返す API が無く、開いても何も出ないためである。
 * ローカルは public/ をディスクから読むのでそのまま開ける。
 *
 * ★ `dashboard-mock.html` は理由が別である。中身は静的なので本番でも表示は
 * できるが、**行政向けの体裁をしたモックを公開URLに置くと、実装済みの
 * ダッシュボードと取り違えられる**。だから同じ扱いで閉じる。
 */
const DEV_ONLY_ASSETS = ['card-catalog.html', 'dashboard-mock.html']

describe('静的ファイルの配信', () => {
  it('ルートが返すファイルはすべて ZIP に同梱されている', () => {
    const served = servedAssets().filter((name) => !DEV_ONLY_ASSETS.includes(name))
    expect(served.length).toBeGreaterThan(0)

    for (const name of served) {
      expect(buildSource, `${name} が build.mjs の STATIC_ASSETS に無い`).toContain(`'${name}'`)
    }
  })

  it('★ 開発用のページは ZIP に入れない（本番に置くと壊れたページになる）', () => {
    for (const name of DEV_ONLY_ASSETS) {
      expect(buildSource, `${name} が build.mjs の STATIC_ASSETS に入っている`).not.toContain(
        `'${name}'`,
      )
    }
  })

  it('★ 開発用のページは本番では 404（インメモリ実装のときだけ返す）', async () => {
    process.env['USE_FAKE_DATASTORE'] = 'false'
    const app = createApp()

    for (const name of DEV_ONLY_ASSETS) {
      const response = await app.request(`/${name}`)
      expect(response.status, name).toBe(404)
    }
  })

  it('確認ページは認証なしで返る（トリガー経由でも）', async () => {
    const app = createApp()

    for (const path of ['/caps.html', `${TRIGGER_PATH}/caps.html`]) {
      const response = await app.request(path)
      expect(response.status, path).toBe(200)
      expect(await response.text()).toContain('caps.html')
    }
  })
})
