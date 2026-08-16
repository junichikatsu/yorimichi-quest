import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * API クライアントのエラー処理。
 *
 * 前段（ゲートウェイ / Lambda）が落ちたときのボディはアプリの形式ではないため、
 * ここを固めておかないと本来のエラーが TypeError に化けて原因が追えなくなる。
 *
 * api.ts は読み込み時に location / localStorage を触るので、
 * 先に用意してから動的 import する（jsdom を足さずに node 環境で回すため）。
 */

// 型注釈での import() は lint で禁止されているため、値側の動的 import から型を導く
function loadApi() {
  return import('./api.js')
}

let api: Awaited<ReturnType<typeof loadApi>>

beforeAll(async () => {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  })
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { pathname: '/yorimichi-sample/' },
  })

  api = await loadApi()
})

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** 再送の待ち時間を飛ばしつつ、実際の呼び出し回数を数える */
async function runWithFetch<T>(responses: Response[], call: () => Promise<T>) {
  const fetchMock = vi.fn(() => Promise.resolve(responses.shift() ?? jsonResponse(200, {})))
  vi.stubGlobal('fetch', fetchMock)

  const promise = call()
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  await vi.runAllTimersAsync()

  return { result: await settled, calls: fetchMock.mock.calls.length }
}

describe('前段が落ちたときのエラー', () => {
  it('アプリの形式でない 503 でもクラッシュしない', async () => {
    // ★ これが本番で出た症状。payload.error を直に読むと
    //   "Cannot read properties of undefined (reading 'code')" になっていた
    const { result } = await runWithFetch(
      Array.from({ length: 3 }, () => jsonResponse(503, { message: 'Service Unavailable' })),
      () => api.fetchMe(),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.error).toBeInstanceOf(api.ApiError)
    const error = result.error as InstanceType<typeof api.ApiError>
    expect(error.status).toBe(503)
    expect(error.code).toBe('INTERNAL')
    expect(error.message).toContain('一時的に応答していません')
  })

  it('ボディが JSON ですらなくてもクラッシュしない', async () => {
    const { result } = await runWithFetch(
      Array.from({ length: 3 }, () => new Response('<html>502 Bad Gateway</html>', { status: 502 })),
      () => api.fetchSpots(undefined),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect((result.error as InstanceType<typeof api.ApiError>).status).toBe(502)
  })

  it('GET はコールドスタートの 503 を再送して回復する', async () => {
    const { result, calls } = await runWithFetch(
      [
        jsonResponse(503, { message: 'Service Unavailable' }),
        jsonResponse(200, { tiles: [], summary: { tileCount: 0 } }),
      ],
      () => api.fetchExploration(),
    )

    expect(result.ok).toBe(true)
    expect(calls).toBe(2)
  })

  it('GET の再送は上限で打ち切る（無限に叩かない）', async () => {
    const { result, calls } = await runWithFetch(
      Array.from({ length: 5 }, () => jsonResponse(503, { message: 'Service Unavailable' })),
      () => api.fetchMe(),
    )

    expect(result.ok).toBe(false)
    // 初回 + 再送 2 回
    expect(calls).toBe(3)
  })

  it('POST は再送しない（二重書き込みを避ける）', async () => {
    const { result, calls } = await runWithFetch(
      Array.from({ length: 3 }, () => jsonResponse(503, { message: 'Service Unavailable' })),
      () => api.postExploration([{ lat: 35.6739, lng: 139.7568 }]),
    )

    expect(result.ok).toBe(false)
    expect(calls).toBe(1)
  })
})

describe('アプリが返したエラー', () => {
  it('code / message / details をそのまま読む', async () => {
    const { result } = await runWithFetch(
      [
        jsonResponse(409, {
          error: {
            code: 'TOO_FAR',
            message: 'スポットから離れすぎています',
            details: { distanceM: 4421, radiusM: 100 },
          },
        }),
      ],
      () => api.postCheckin('sample-hibiya-park', { lat: 35.7, lng: 139.8 }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    const error = result.error as InstanceType<typeof api.ApiError>
    expect(error.code).toBe('TOO_FAR')
    expect(error.message).toBe('スポットから離れすぎています')
    expect(error.details).toMatchObject({ distanceM: 4421 })
  })

  it('429 は Retry-After を details に載せる', async () => {
    const { result } = await runWithFetch(
      [
        jsonResponse(
          429,
          { error: { code: 'RATE_LIMITED', message: 'リクエストが多すぎます' } },
          { 'Retry-After': '30' },
        ),
      ],
      () => api.fetchMe(),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect((result.error as InstanceType<typeof api.ApiError>).details).toEqual({ retryAfterSec: 30 })
  })
})
