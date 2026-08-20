import { isUserId, type UserId } from '@imanouchi/shared'

/**
 * LINE の IDトークン検証（FR-01-1）。
 *
 * ★ 署名検証を自前で実装せず、**LINE の検証エンドポイントに投げる**。
 * JWK の取得・キャッシュ・ローテーション、RS256 の検証を自作すると、
 * 間違えたときに「誰でもログインできる」という形で壊れる。ここは自作しない。
 *
 * 呼ぶのは**ログイン時の1回だけ**である。以降は自前の署名トークンを
 * ローカルで検証するので、リクエストごとに LINE へ出ていくことはない。
 */

const VERIFY_ENDPOINT = 'https://api.line.me/oauth2/v2.1/verify'

/** LINE 側が応答しないときに待ち続けない */
const TIMEOUT_MS = 5000

export interface LineIdentity {
  userId: UserId
  displayName: string
  pictureUrl: string
}

export class LineVerifyError extends Error {
  constructor(
    readonly reason: string,
    readonly status: number,
  ) {
    super(`line id token verification failed: ${reason}`)
    this.name = 'LineVerifyError'
  }
}

/** 検証エンドポイントの応答のうち、使う項目だけ */
interface VerifyPayload {
  iss?: unknown
  sub?: unknown
  aud?: unknown
  exp?: unknown
  name?: unknown
  picture?: unknown
  error?: unknown
  error_description?: unknown
}

/**
 * IDトークンを検証して、LINE のユーザー情報を取り出す。
 *
 * ★ 検証エンドポイントに通っただけでは足りない。**aud（宛先チャネル）を自分の
 * チャネルIDと照合する**。ここを省くと、別のチャネル向けに正しく発行された
 * トークンでログインできてしまう（他サービスのトークンの使い回し）。
 */
export async function verifyLineIdToken(
  idToken: string,
  channelId: string,
): Promise<LineIdentity> {
  if (channelId === '') throw new LineVerifyError('channel id is not configured', 500)

  let response: Response
  try {
    response = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    // ★ 生のエラーは持ち出さない。トークンが含まれうる
    throw new LineVerifyError(err instanceof Error ? err.name : 'network error', 502)
  }

  let payload: VerifyPayload
  try {
    payload = (await response.json()) as VerifyPayload
  } catch {
    throw new LineVerifyError('malformed response', 502)
  }

  if (!response.ok) {
    // LINE 側が「トークンが不正」と言っている場合は 401 に落とす（500 にしない）
    const reason = typeof payload.error === 'string' ? payload.error : `http ${response.status}`
    throw new LineVerifyError(reason, response.status === 400 ? 401 : 502)
  }

  if (payload.iss !== 'https://access.line.me') {
    throw new LineVerifyError('unexpected issuer', 401)
  }

  // ★ aud の照合。文字列でも配列でも来うる
  const aud = payload.aud
  const audMatches = Array.isArray(aud) ? aud.includes(channelId) : aud === channelId
  if (!audMatches) throw new LineVerifyError('audience mismatch', 401)

  // 検証エンドポイントは期限切れを弾くが、こちらでも確認しておく
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    throw new LineVerifyError('token expired', 401)
  }

  const sub = payload.sub
  if (typeof sub !== 'string' || !isUserId(sub)) {
    throw new LineVerifyError('unexpected subject', 401)
  }

  return {
    userId: sub,
    displayName: typeof payload.name === 'string' ? payload.name : '',
    pictureUrl: typeof payload.picture === 'string' ? payload.picture : '',
  }
}
