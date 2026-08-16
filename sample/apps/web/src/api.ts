import type {
  CheckinResponse,
  ClientConfigResponse,
  ErrorResponse,
  MeResponse,
  SpotsResponse,
} from '@yorimichi-sample/shared'

/**
 * トリガーのパス配下に置かれるため、ルート相対ではなく「現在のパス」を基準にする。
 * `/v1/...` を直に叩くとトリガーの外に出る。
 * 環境変数は持たない（同一オリジンなので相対パスで足りる）。
 */
const API_BASE = location.pathname.endsWith('/')
  ? location.pathname.slice(0, -1)
  : location.pathname

const USER_ID_STORAGE_KEY = 'yorimichi-sample:user-id'
const USER_ID_HEADER = 'x-sample-user-id'

/** サンプル用の識別子。認証ではない（本番は LIFF ID トークンをサーバー側で検証する）。 */
export function getOrCreateUserId(): string {
  const existing = localStorage.getItem(USER_ID_STORAGE_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(USER_ID_STORAGE_KEY, created)
  return created
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, string | number | boolean> | undefined

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string | number | boolean>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  /** 202 Accepted を待機として扱う場合の最大再送回数 */
  maxRetries?: number
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 0

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        [USER_ID_HEADER]: getOrCreateUserId(),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })

    // 202 はエラーではなく「待機」。retryAfterMs 相当を見て再送する。
    if (response.status === 202 && attempt < maxRetries) {
      const retryAfterMs = Number(response.headers.get('Retry-After') ?? '1') * 1000
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs))
      continue
    }

    if (response.ok) return (await response.json()) as T

    // 同一オリジンなので Retry-After をそのまま読める
    const retryAfter = response.headers.get('Retry-After')
    const payload = (await response.json().catch(() => undefined)) as ErrorResponse | undefined

    throw new ApiError(
      response.status,
      payload?.error.code ?? 'INTERNAL',
      payload?.error.message ?? `リクエストに失敗しました (${response.status})`,
      {
        ...(payload?.error.details ?? {}),
        ...(retryAfter ? { retryAfterSec: Number(retryAfter) } : {}),
      },
    )
  }
}

export function fetchClientConfig(): Promise<ClientConfigResponse> {
  return request<ClientConfigResponse>('/v1/client-config')
}

export function fetchSpots(position: { lat: number; lng: number } | undefined): Promise<SpotsResponse> {
  const query = position ? `?lat=${position.lat}&lng=${position.lng}` : ''
  return request<SpotsResponse>(`/v1/spots${query}`)
}

export function fetchMe(): Promise<MeResponse> {
  return request<MeResponse>('/v1/me')
}

export function postCheckin(
  spotId: string,
  position: { lat: number; lng: number },
): Promise<CheckinResponse> {
  return request<CheckinResponse>(`/v1/spots/${encodeURIComponent(spotId)}/checkin`, {
    method: 'POST',
    body: position,
  })
}
