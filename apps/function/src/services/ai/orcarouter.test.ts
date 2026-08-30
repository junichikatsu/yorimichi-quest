import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiError, chat, isConfigured, parseJson, type OrcaRouterConfig } from './orcarouter.js'

/**
 * OrcaRouter の呼び出し（#75）。
 *
 * ★ **実際に外へ出さない。** `fetch` を差し替えて、こちらの振る舞いだけを固定する。
 * 見ているのは「落ち方」である。落ち方を間違えると、Lambda が返らないまま課金され、
 * 利用者の画面はクイズが出ないまま止まる。
 */

const config: OrcaRouterConfig = {
  baseUrl: 'https://api.example.test/v1',
  apiKey: 'test-key',
  ingestModel: 'high-tier',
  runtimeModel: 'light-tier',
  timeoutMs: 50,
  maxRetries: 2,
}

function ok(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('設定', () => {
  it('鍵が無ければ「設定されていない」とする（壊れているのとは違う）', () => {
    expect(isConfigured({ ...config, apiKey: '' })).toBe(false)
    expect(isConfigured(config)).toBe(true)
  })

  it('★ 設定が無い状態で呼んだら、再試行しない', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)

    await expect(
      chat({ ...config, apiKey: '' }, { model: 'x', messages: [] }),
    ).rejects.toThrow('設定されていません')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('呼び出しの中身', () => {
  it('★ モデルは呼ぶ側が渡したものをそのまま送る（動的に振り分けない）', async () => {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body)) as Record<string, unknown>
      return ok('{}')
    })

    await chat(config, { model: 'high-tier', messages: [{ role: 'user', content: 'x' }] })
    expect(sent['model']).toBe('high-tier')
  })

  it('★ 既定の temperature を低く保つ（同じナレッジから違う正解が出ると再現できない）', async () => {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body)) as Record<string, unknown>
      return ok('{}')
    })

    await chat(config, { model: 'm', messages: [] })
    expect(Number(sent['temperature'])).toBeLessThanOrEqual(0.3)
  })

  it('json を頼めば response_format を付ける', async () => {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body)) as Record<string, unknown>
      return ok('{}')
    })

    await chat(config, { model: 'm', messages: [], json: true })
    expect(sent['response_format']).toEqual({ type: 'json_object' })
  })

  it('末尾のスラッシュがあっても URL が壊れない', async () => {
    let url = ''
    vi.stubGlobal('fetch', async (u: string) => {
      url = u
      return ok('{}')
    })

    await chat({ ...config, baseUrl: 'https://api.example.test/v1/' }, { model: 'm', messages: [] })
    expect(url).toBe('https://api.example.test/v1/chat/completions')
  })
})

describe('落ち方', () => {
  it('★ 400 は再試行しない（何度投げても同じで、コストと待ち時間が増えるだけ）', async () => {
    const spy = vi.fn(async () => new Response('bad request', { status: 400 }))
    vi.stubGlobal('fetch', spy)

    await expect(chat(config, { model: 'm', messages: [] })).rejects.toBeInstanceOf(AiError)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('★ 429 は再試行する', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return calls < 3 ? new Response('slow down', { status: 429 }) : ok('{"ok":true}')
    })

    await expect(chat(config, { model: 'm', messages: [] })).resolves.toContain('ok')
    expect(calls).toBe(3)
  }, 15000)

  it('★ 上限を超えたら諦める（無限に投げ続けない）', async () => {
    const spy = vi.fn(async () => new Response('boom', { status: 503 }))
    vi.stubGlobal('fetch', spy)

    await expect(chat({ ...config, maxRetries: 1 }, { model: 'm', messages: [] })).rejects.toThrow('503')
    expect(spy).toHaveBeenCalledTimes(2)
  }, 15000)

  it('★ 応答しない相手を時間で打ち切る（返らないまま課金され続けない）', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    })

    await expect(
      chat({ ...config, maxRetries: 0, timeoutMs: 30 }, { model: 'm', messages: [] }),
    ).rejects.toThrow('応答しませんでした')
  })

  it('空の応答は一時的なものとして再試行する', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return calls < 2 ? ok('   ') : ok('{"ok":true}')
    })

    await expect(chat(config, { model: 'm', messages: [] })).resolves.toContain('ok')
    expect(calls).toBe(2)
  }, 15000)

  it('★ 失敗の文言に鍵を含めない', async () => {
    vi.stubGlobal('fetch', async () => new Response('unauthorized', { status: 401 }))

    const error = await chat(config, { model: 'm', messages: [] }).catch((e: unknown) => e)
    expect(String(error)).not.toContain('test-key')
  })
})

describe('JSON として読む', () => {
  it('素の JSON を読む', () => {
    expect(parseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('★ ```json のフェンスを剥がす（json を頼んでも付いてくることがある）', () => {
    expect(parseJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJson<{ a: number }>('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('★ 読めなければ例外にする（半端に解釈して壊れたクイズを配らない）', () => {
    expect(() => parseJson('これは JSON ではありません')).toThrow(AiError)
  })
})
