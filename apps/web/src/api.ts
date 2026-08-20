import type {
  ClientConfigResponse,
  ConsentRequest,
  ErrorResponse,
  LoginResponse,
  MeResponse,
  SpotsResponse,
} from '@imanouchi/shared'

/**
 * サーバーとの通信。
 *
 * ★ トークンはメモリだけに置く。localStorage に入れると XSS で持ち出せるうえ、
 * 端末に残る。再読み込み時は LIFF から取り直す（LINE アプリ内なら無操作で済む）。
 */

let token: string | undefined

export function setToken(value: string | undefined): void {
  token = value
}

export function hasToken(): boolean {
  return token !== undefined
}

/**
 * ベースパス。
 *
 * ★ enebular の HTTP トリガーはパスの前置があるため、絶対パスで書くと 404 になる。
 * 配信元と同じ場所を基準にする。
 */
function url(path: string): string {
  const base = window.location.pathname.replace(/\/$/, '')
  return `${base}${path}`
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 期限切れは呼び出し側が再ログインで復帰できるので、判定を1か所に置く */
export function isAuthExpired(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'TOKEN_EXPIRED' || err.code === 'UNAUTHORIZED')
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('content-type', 'application/json')
  if (token !== undefined) headers.set('authorization', `Bearer ${token}`)

  const response = await fetch(url(path), { ...init, headers })

  if (!response.ok) {
    let code = 'INTERNAL'
    let message = '通信に失敗しました'
    try {
      const body = (await response.json()) as ErrorResponse
      code = body.error.code
      message = body.error.message
    } catch {
      // JSON で返らない経路（前段のエラーページ等）。status だけで判断する
    }
    throw new ApiError(code, message, response.status)
  }

  return (await response.json()) as T
}

export function fetchClientConfig(): Promise<ClientConfigResponse> {
  return request<ClientConfigResponse>('/v1/client-config')
}

export function login(idToken: string): Promise<LoginResponse> {
  return request<LoginResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
}

export function fetchMe(): Promise<MeResponse> {
  return request<MeResponse>('/v1/me')
}

export function setLocationConsent(granted: boolean): Promise<MeResponse> {
  const body: ConsentRequest = { granted }
  return request<MeResponse>('/v1/me/location-consent', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchSpots(position: { lat: number; lng: number } | undefined): Promise<SpotsResponse> {
  const query = position ? `?lat=${position.lat}&lng=${position.lng}` : ''
  return request<SpotsResponse>(`/v1/spots${query}`)
}
