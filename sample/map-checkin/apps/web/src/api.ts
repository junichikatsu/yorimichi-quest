import type {
  Avatar,
  AvatarUpdateResponse,
  CheckinResponse,
  ClientConfigResponse,
  Equipment,
  EquipmentUpdateResponse,
  ErrorResponse,
  ExplorationResponse,
  ExplorationUpdateResponse,
  ItemsResponse,
  MeResponse,
  QuizAnswerResponse,
  QuizResponse,
  SpotsResponse,
} from '@map-checkin/shared'

/**
 * トリガーのパス配下に置かれるため、ルート相対ではなく「現在のパス」を基準にする。
 * `/v1/...` を直に叩くとトリガーの外に出る。
 * 環境変数は持たない（同一オリジンなので相対パスで足りる）。
 */
const API_BASE = location.pathname.endsWith('/')
  ? location.pathname.slice(0, -1)
  : location.pathname

const USER_ID_STORAGE_KEY = 'map-checkin:user-id'
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
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  /** 202 Accepted を待機として扱う場合の最大再送回数 */
  maxRetries?: number
}

/**
 * 前段（ゲートウェイ / Lambda）が返す一時的なエラー。
 *
 * この場合ボディはアプリの形式ではなく `{"message":"Service Unavailable"}` などになる。
 * 関数まで届いていないので、副作用の無い GET なら安全に再送できる。
 */
const GATEWAY_ERROR_STATUSES = new Set([502, 503, 504])

const GATEWAY_MAX_RETRIES = 2
const GATEWAY_RETRY_BASE_MS = 700

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * エラーレスポンスから中身を取り出す。
 *
 * ★ `payload.error.code` を直に読んではいけない。
 * 前段が落ちたときのボディには `error` が無いため、TypeError
 * （`Cannot read properties of undefined (reading 'code')`）になり、
 * **本来の 503 が意味不明なクラッシュに化けて原因が追えなくなる**。
 * サーバーの形式を仮定せず、読めた項目だけを使う。
 */
function readErrorPayload(body: unknown): Partial<ErrorResponse['error']> {
  if (typeof body !== 'object' || body === null) return {}

  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return {}

  const raw = error as Record<string, unknown>
  return {
    ...(typeof raw['code'] === 'string' ? { code: raw['code'] as ErrorResponse['error']['code'] } : {}),
    ...(typeof raw['message'] === 'string' ? { message: raw['message'] } : {}),
    ...(typeof raw['details'] === 'object' && raw['details'] !== null
      ? { details: raw['details'] as Record<string, string | number | boolean> }
      : {}),
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 0
  const method = options.method ?? 'GET'

  let acceptedRetries = 0
  let gatewayRetries = 0

  for (;;) {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        [USER_ID_HEADER]: getOrCreateUserId(),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })

    // 202 はエラーではなく「待機」。retryAfterMs 相当を見て再送する。
    if (response.status === 202 && acceptedRetries < maxRetries) {
      acceptedRetries += 1
      await delay(Number(response.headers.get('Retry-After') ?? '1') * 1000)
      continue
    }

    // コールドスタート時に出る前段の 5xx。ここで諦めると初回表示が
    // 「読み込みに失敗しました」で止まってしまうため、GET だけ短く再送する。
    if (
      GATEWAY_ERROR_STATUSES.has(response.status) &&
      method === 'GET' &&
      gatewayRetries < GATEWAY_MAX_RETRIES
    ) {
      gatewayRetries += 1
      await delay(GATEWAY_RETRY_BASE_MS * gatewayRetries)
      continue
    }

    if (response.ok) return (await response.json()) as T

    // 同一オリジンなので Retry-After をそのまま読める
    const retryAfter = response.headers.get('Retry-After')
    const payload: unknown = await response.json().catch(() => undefined)
    const error = readErrorPayload(payload)

    // アプリの形式で返っていないなら、状態コードから読める説明に落とす
    const fallbackMessage = GATEWAY_ERROR_STATUSES.has(response.status)
      ? 'サーバーが一時的に応答していません。少し待ってからもう一度お試しください。'
      : `リクエストに失敗しました (${response.status})`

    throw new ApiError(
      response.status,
      error.code ?? 'INTERNAL',
      error.message ?? fallbackMessage,
      {
        ...(error.details ?? {}),
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

export function fetchQuiz(spotId: string): Promise<QuizResponse> {
  return request<QuizResponse>(`/v1/spots/${encodeURIComponent(spotId)}/quiz`)
}

export function postQuizAnswer(
  spotId: string,
  quizId: string,
  choiceIndex: number,
): Promise<QuizAnswerResponse> {
  return request<QuizAnswerResponse>(`/v1/spots/${encodeURIComponent(spotId)}/quiz/answer`, {
    method: 'POST',
    body: { quizId, choiceIndex },
  })
}

export function fetchItems(): Promise<ItemsResponse> {
  return request<ItemsResponse>('/v1/items')
}

export function putAvatar(avatar: Avatar): Promise<AvatarUpdateResponse> {
  return request<AvatarUpdateResponse>('/v1/me/avatar', { method: 'PUT', body: avatar })
}

export function putEquipment(equipment: Equipment): Promise<EquipmentUpdateResponse> {
  return request<EquipmentUpdateResponse>('/v1/me/equipment', { method: 'PUT', body: equipment })
}

export function fetchExploration(): Promise<ExplorationResponse> {
  return request<ExplorationResponse>('/v1/exploration')
}

export function postExploration(
  points: { lat: number; lng: number }[],
): Promise<ExplorationUpdateResponse> {
  return request<ExplorationUpdateResponse>('/v1/exploration', { method: 'POST', body: { points } })
}
