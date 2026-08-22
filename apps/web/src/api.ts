import type {
  Avatar,
  CardsResponse,
  CheckinRequest,
  CheckinResponse,
  ClientConfigResponse,
  ConsentRequest,
  ErrorResponse,
  ExplorationRequest,
  ExplorationResponse,
  ExplorationUpdateResponse,
  GuestLoginResponse,
  LoginResponse,
  MeResponse,
  ProgressResponse,
  QuizAnswerRequest,
  QuizAnswerResponse,
  QuizResponse,
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
    /**
     * 付帯情報。
     *
     * ★ 画面の案内を書き分けるために要る。「離れすぎです」だけでは、
     * 近づけば済むのか場所が違うのかが分からない（TOO_FAR は距離、
     * COOLDOWN は次に押せる時刻を返す）。
     */
    readonly details: Record<string, string | number | boolean> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 取り直せば復帰できる失敗か。
 *
 * ★ `TOKEN_EXPIRED` だけを対象にする。`UNAUTHORIZED` を含めてはいけない。
 * 含めると、チャネルIDの設定違いなど**取り直しても直らない失敗でも取り直しに走り**、
 * リダイレクトが繰り返される。
 */
export function isAuthExpired(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'TOKEN_EXPIRED'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('content-type', 'application/json')
  if (token !== undefined) headers.set('authorization', `Bearer ${token}`)

  const response = await fetch(url(path), { ...init, headers })

  if (!response.ok) {
    let code = 'INTERNAL'
    let message = '通信に失敗しました'
    let details: Record<string, string | number | boolean> = {}
    try {
      const body = (await response.json()) as ErrorResponse
      code = body.error.code
      message = body.error.message
      details = body.error.details ?? {}
    } catch {
      // JSON で返らない経路（前段のエラーページ等）。status だけで判断する
    }
    throw new ApiError(code, message, response.status, details)
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

/**
 * おためし利用を始める（LINE ログインなし）。
 *
 * ★ 返るセッションは**読み取り専用**である。書き込みの経路はサーバー側で
 * 閉じてあり（403）、歩いた記録・同意・見た目は端末の中だけに置く。
 */
export function guestLogin(): Promise<GuestLoginResponse> {
  return request<GuestLoginResponse>('/v1/auth/guest', { method: 'POST' })
}

/**
 * 開発用ログイン（ローカル確認専用）。
 *
 * ★ ローカルでは LIFF のログインが完走しないため、これが無いとログインが要る機能
 * （チェックインの保存・カード）を手元で確かめられない。サーバー側はインメモリ実装
 * のときしかこの経路を作らないので、本番では 404 になる。
 */
export function devLogin(): Promise<LoginResponse> {
  return request<LoginResponse>('/v1/auth/dev', { method: 'POST' })
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

export function fetchExploration(): Promise<ExplorationResponse> {
  return request<ExplorationResponse>('/v1/exploration')
}

/**
 * 歩いた座標を送る（FR-02-7）。
 *
 * ★ 呼ぶ回数を抑えること。書き込みはタイル単位に量子化されるので点をいくら
 * 送っても件数は増えないが、**リクエストの回数はそのまま増える**。
 * 呼び出し側（`useExploration`）が間隔をまとめている。
 */
export function postExploration(points: ExplorationRequest['points']): Promise<ExplorationUpdateResponse> {
  return request<ExplorationUpdateResponse>('/v1/exploration', {
    method: 'POST',
    body: JSON.stringify({ points }),
  })
}

/** キャラクターの見た目を保存する（FR-01-6） */
export function saveAvatar(avatar: Avatar): Promise<MeResponse> {
  return request<MeResponse>('/v1/me/avatar', {
    method: 'PUT',
    body: JSON.stringify(avatar),
  })
}

/**
 * チェックイン（FR-03）。
 *
 * ★ 送るのは現在地だけ。距離もポイントもサーバーが決める。
 * おためし（ゲスト）でも呼べるが、サーバーは保存しない（`saved` が false）。
 */
export function checkin(
  spotId: string,
  position: CheckinRequest,
): Promise<CheckinResponse> {
  return request<CheckinResponse>(`/v1/spots/${encodeURIComponent(spotId)}/checkin`, {
    method: 'POST',
    body: JSON.stringify(position),
  })
}

/** クイズの取得（FR-04-1）。正解は含まれない */
export function fetchQuiz(spotId: string): Promise<QuizResponse> {
  return request<QuizResponse>(`/v1/spots/${encodeURIComponent(spotId)}/quiz`)
}

/**
 * クイズの回答（FR-04-3・FR-04-6）。
 *
 * ★ 採点はサーバー。解説は正解・不正解のどちらでも返るので、
 * 画面は結果をそのまま出せばよい。
 */
export function answerQuiz(
  spotId: string,
  body: QuizAnswerRequest,
): Promise<QuizAnswerResponse> {
  return request<QuizAnswerResponse>(`/v1/spots/${encodeURIComponent(spotId)}/quiz/answer`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * 進み具合の取得（FR-03・FR-04）。
 *
 * ★ 起動時に1回だけ呼ぶ。**呼ばないと、再読み込み後はチェックイン済みの場所でも
 * ボタンが押せる状態に見え、押してから断られる。**
 * おためし（ゲスト）では呼ばない（403 になる。記録は端末の中にある）。
 */
export function fetchProgress(): Promise<ProgressResponse> {
  return request<ProgressResponse>('/v1/progress')
}

/**
 * カードコレクションの取得（FR-14）。
 *
 * ★ おためし（ゲスト）では呼べない（403）。達成状態をサーバーが持たないと、
 * 未達成カードの中身を隠す仕組みが成立しないため、機能そのものを出さない。
 */
export function fetchCards(): Promise<CardsResponse> {
  return request<CardsResponse>('/v1/cards')
}
