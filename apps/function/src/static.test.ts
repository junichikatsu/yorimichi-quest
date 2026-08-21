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
  // 実ファイルではなく名前をそのまま返す。配線だけを見る
  setStaticAssetLoader((name) => ({
    contentType: 'text/html; charset=utf-8',
    encoding: 'utf8',
    body: `<!-- ${name} -->`,
  }))
})

afterEach(() => {
  setStaticAssetLoader(undefined)
})

describe('静的ファイルの配信', () => {
  it('ルートが返すファイルはすべて ZIP に同梱されている', () => {
    const served = servedAssets()
    expect(served.length).toBeGreaterThan(0)

    for (const name of served) {
      expect(buildSource, `${name} が build.mjs の STATIC_ASSETS に無い`).toContain(`'${name}'`)
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
