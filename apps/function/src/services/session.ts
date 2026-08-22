import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { asGuestId, asUserId, isGuestId, isUserId, type GuestId, type UserId } from '@imanouchi/shared'

/**
 * セッショントークン（FR-01）。
 *
 * LINE の IDトークンをログイン時に1回検証したあと、**自前の署名付きトークン**を
 * 発行する。以降のリクエストはこれをローカルで検証するので、外部通信が入らない。
 *
 * ★ サーバー側にセッションを保存しない。データストアに書くと、リクエストごとに
 * getItem が1回増える。署名だけで検証できる形にして、記憶を持たせない。
 *
 * ★ 暗号化ではなく署名である。中身（ユーザーID・期限）は読めるが、鍵が無ければ
 * 書き換えられない。秘密を入れてはいけない。
 */

/** `<payload>.<signature>` の2要素。JWT にしていないのは、必要なのが署名だけだから */
const SEPARATOR = '.'

interface SessionPayload {
  /** ユーザーID（LINE の userId、またはおためしのゲストID） */
  u: string
  /** 失効時刻（epoch ミリ秒） */
  e: number
}

/**
 * トークンの持ち主。
 *
 * ★ LINE ログインとおためし（ゲスト）を**型で分ける**。
 * 同じ `userId` に混ぜると、おためしの ID でデータストアへ書く経路が
 * うっかり通ってしまう。呼び出し側に分岐を強制する。
 */
export type SessionSubject =
  | { kind: 'line'; userId: UserId }
  | { kind: 'guest'; guestId: GuestId }

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export interface IssuedSession {
  token: string
  expiresAt: Date
}

export function issueSession(
  subject: SessionSubject,
  secret: string,
  ttlHours: number,
): IssuedSession {
  if (secret === '') throw new Error('session secret is not configured')

  const expiresAt = new Date(Date.now() + ttlHours * 3600_000)
  // 種別は ID の接頭辞で分かる（U… / G…）ので、余分な項目は持たせない
  const id = subject.kind === 'line' ? subject.userId : subject.guestId
  const payload: SessionPayload = { u: id, e: expiresAt.getTime() }
  const encoded = base64url(JSON.stringify(payload))

  return { token: `${encoded}${SEPARATOR}${sign(encoded, secret)}`, expiresAt }
}

export type SessionFailure = 'malformed' | 'bad-signature' | 'expired'

export type SessionResult =
  | { ok: true; subject: SessionSubject }
  | { ok: false; reason: SessionFailure }

/**
 * トークンを検証する。
 *
 * ★ 署名の比較は timingSafeEqual を使う。文字列の `===` は先頭から比較して
 * 一致した長さで所要時間が変わるため、繰り返し試せば署名を1バイトずつ
 * 当てられる（タイミング攻撃）。
 */
export function verifySession(token: string, secret: string): SessionResult {
  if (secret === '') return { ok: false, reason: 'bad-signature' }

  const index = token.indexOf(SEPARATOR)
  if (index <= 0) return { ok: false, reason: 'malformed' }

  const encoded = token.slice(0, index)
  const signature = token.slice(index + 1)
  const expected = sign(encoded, secret)

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  // 長さが違うと timingSafeEqual が例外を投げるので先に弾く
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad-signature' }
  }

  let payload: SessionPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (typeof payload.u !== 'string' || typeof payload.e !== 'number') {
    return { ok: false, reason: 'malformed' }
  }
  /*
   * ★ 形の検査を緩めない。
   *
   * LINE の userId（U + 32桁）か、おためしのゲストID（G + 32桁）のどちらかだけを
   * 通す。緩めると、署名を持っている側が任意の文字列を主キーにできてしまう。
   */
  const line = isUserId(payload.u)
  if (!line && !isGuestId(payload.u)) return { ok: false, reason: 'malformed' }
  if (payload.e <= Date.now()) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    subject: line
      ? { kind: 'line', userId: asUserId(payload.u) }
      : { kind: 'guest', guestId: asGuestId(payload.u) },
  }
}

/** おためしのゲストIDを作る。`G` + 32桁の16進数（LINE の形と重ならない） */
export function newGuestId(): GuestId {
  const bytes = randomBytes(16).toString('hex')
  return asGuestId(`G${bytes}`)
}
