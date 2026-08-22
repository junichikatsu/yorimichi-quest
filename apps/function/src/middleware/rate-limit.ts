import type { MiddlewareHandler } from 'hono'
import { loadConfig } from '../config.js'
import { AppError } from '../errors.js'
import { skipsSessionGate } from './auth.js'
import type { AppEnv } from '../types.js'

/**
 * インメモリのレート制限。
 *
 * Lambda はインスタンスが増減するため、これは **インスタンス単位のベストエフォート**であって
 * 全体のスロットリングではない。サンプルの暴走防止（AI API・データストアのアクセス回数保護）が目的。
 */
const WINDOW_MS = 60_000

const hits = new Map<string, number[]>()

export function resetRateLimit(): void {
  hits.clear()
}

export function rateLimit(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    // セッションを要求しないパスは利用者を特定できないため、ここでは数えない。
    // 'anonymous' でまとめて数えると、1人の連打で全員のログインが止まる。
    if (skipsSessionGate(c.req.path)) return next()

    const limit = loadConfig().rateLimitPerMinute
    // おためしもゲストIDごとに数える。1つの端末の連打で全員が止まらないように
    const key = c.get('userId') ?? c.get('guestId') ?? 'anonymous'
    const now = Date.now()

    const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
    if (recent.length >= limit) {
      const oldest = recent[0] ?? now
      const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000))
      c.header('Retry-After', String(retryAfterSec))
      throw new AppError('RATE_LIMITED', 429, 'リクエストが多すぎます', {
        retryAfterSec,
        limitPerMinute: limit,
      })
    }

    recent.push(now)
    hits.set(key, recent)
    return next()
  }
}
