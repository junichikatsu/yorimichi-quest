import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { ANALYTICS_PLACEHOLDER, analyticsTag, setStaticAssetLoader } from './static.js'

/**
 * 静的ファイルの配信。
 *
 * ★ 「ルートはあるが ZIP に入っていない」は**本番でだけ 500 になる**。
 * ローカルはディスクから読むので気づけない。ここで組み合わせを固定する。
 */

const here = dirname(fileURLToPath(import.meta.url))
const webPublic = join(here, '..', '..', 'web', 'public')
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
 * ★ `dashboard.html`（行政還元ダッシュボード・FR-09）は**公開する**ので、
 * ここには入れない。中身が静的で外部を呼ばないため、配信先でも表示できる。
 */
const DEV_ONLY_ASSETS = ['card-catalog.html']

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

/**
 * 利用状況の計測タグ（GA4・#82）。
 *
 * ★ **未設定のときに何も出ないことが本体である。** 空の測定IDでタグだけ残ると、
 * 意味のない外部リクエストが増え、しかも数字は取れない。
 *
 * ★ 測定IDは環境変数の値をそのまま HTML へ書き出すので、形の検査も固定する。
 */
describe('計測タグの差し込み', () => {
  /** 差し込み位置だけを置いた HTML を返す */
  function servePlaceholderOnly(): void {
    setStaticAssetLoader(() => ({
      contentType: 'text/html; charset=utf-8',
      encoding: 'utf8',
      body: `<head>${ANALYTICS_PLACEHOLDER}</head>`,
    }))
  }

  afterEach(() => {
    delete process.env['GA_MEASUREMENT_ID']
  })

  it('★ 配信する HTML はすべて差し込み位置を持つ（片方だけ計測されないのを防ぐ）', () => {
    for (const name of ['index.html', 'dashboard.html']) {
      const html = readFileSync(join(webPublic, name), 'utf-8')
      expect(html, `${name} に ${ANALYTICS_PLACEHOLDER} が無い`).toContain(ANALYTICS_PLACEHOLDER)
    }
  })

  it('★ HTML 側にタグを書かない（測定IDがリポジトリへ入らないこと）', () => {
    for (const name of ['index.html', 'dashboard.html']) {
      const html = readFileSync(join(webPublic, name), 'utf-8')
      expect(html, `${name} が直接タグを読み込んでいる`).not.toContain('googletagmanager.com')
      expect(html, `${name} に測定IDが書かれている`).not.toMatch(/G-[A-Z0-9]{4,}/)
    }
  })

  it('★ 未設定なら1バイトも出さない（差し込み位置ごと消える）', async () => {
    servePlaceholderOnly()
    const response = await createApp().request('/index.html')
    const body = await response.text()

    expect(body).not.toContain('googletagmanager')
    expect(body, '差し込み位置がそのまま残っている').not.toContain(ANALYTICS_PLACEHOLDER)
    expect(body).toBe('<head></head>')
  })

  it('設定すればタグが入る', async () => {
    process.env['GA_MEASUREMENT_ID'] = 'G-ABCD1234'
    servePlaceholderOnly()
    const body = await (await createApp().request('/index.html')).text()

    expect(body).toContain('https://www.googletagmanager.com/gtag/js?id=G-ABCD1234')
    expect(body).toContain("gtag('config','G-ABCD1234')")
  })

  it('★ 形の違う値は未設定として扱う（HTML を値経由で壊せないようにする）', async () => {
    for (const value of ['UA-12345-1', 'change-me', 'G-x', "G-1'></script><script>alert(1)"]) {
      process.env['GA_MEASUREMENT_ID'] = value
      servePlaceholderOnly()
      const body = await (await createApp().request('/index.html')).text()
      expect(body, `${value} が通っている`).toBe('<head></head>')
    }
  })

  it('測定IDが空なら組み立て側も空文字を返す', () => {
    expect(analyticsTag('')).toBe('')
  })
})
