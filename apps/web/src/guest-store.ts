import type { ExploredTile } from '@imanouchi/shared'

/**
 * おためし利用の記録を、**端末の中だけ**に置く。
 *
 * ★ サーバーへ送らない（送れない）。おためしのセッションは読み取り専用で、
 * 書き込みの経路はサーバー側で閉じてある。
 *
 * ★ これは privacy 上の後退ではなく前進である。歩いた場所という機微な情報を
 * どこにも預けずに遊べる。画面でも「この端末にだけ残る」と明示する。
 *
 * ★ 壊れた値・容量超過で落とさない。localStorage は容量上限（数MB）があり、
 * プライベートブラウズでは書き込み自体が例外になる端末もある。
 * 記録が残らないのは困るが、**アプリが開けなくなるほうが困る。**
 */

const TILES_KEY = 'imanouchi.guest.tiles.v1'
const CONSENT_KEY = 'imanouchi.guest.consent.v1'
const PROGRESS_KEY = 'imanouchi.guest.progress.v1'

/**
 * 保存するタイルの上限。
 *
 * 50m タイルで 2000 枚は約 4km² ぶんで、サーバー側の上限と同じ。
 * おためしでこれを超えるほど歩く人は、LINE でログインしたほうがよい。
 */
const MAX_TILES = 2000

function storage(): Storage | undefined {
  try {
    // プライベートブラウズでは参照自体が例外になることがある
    return window.localStorage
  } catch {
    return undefined
  }
}

function isTile(value: unknown): value is ExploredTile {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  return (
    typeof raw['tileKey'] === 'string' &&
    typeof raw['lat'] === 'number' &&
    typeof raw['lng'] === 'number' &&
    typeof raw['firstSeenAt'] === 'string'
  )
}

/** 端末に残っている探索済みタイル。壊れていれば空で返す */
export function loadGuestTiles(): ExploredTile[] {
  const store = storage()
  if (!store) return []

  try {
    const raw = store.getItem(TILES_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // ★ 1件ずつ検査する。手で書き換えられる場所なので、形を信じない
    return parsed.filter(isTile).slice(0, MAX_TILES)
  } catch {
    return []
  }
}

/** 探索済みタイルを端末へ書く。書けなくても落とさない */
export function saveGuestTiles(tiles: readonly ExploredTile[]): void {
  const store = storage()
  if (!store) return

  try {
    store.setItem(TILES_KEY, JSON.stringify(tiles.slice(0, MAX_TILES)))
  } catch {
    // 容量超過・書き込み禁止。記録は失うが、遊べる状態は保つ
  }
}

/** おためしの同意状態（FR-01-4）。サーバーへは送れないので端末に置く */
export function loadGuestConsent(): boolean {
  const store = storage()
  if (!store) return false

  try {
    return store.getItem(CONSENT_KEY) === 'yes'
  } catch {
    return false
  }
}

export function saveGuestConsent(agreed: boolean): void {
  const store = storage()
  if (!store) return

  try {
    if (agreed) store.setItem(CONSENT_KEY, 'yes')
    else store.removeItem(CONSENT_KEY)
  } catch {
    // 同意し直せばよいので、書けないことは致命的ではない
  }
}

/* ------------------------------------------------------------------ *
 * チェックインとクイズの進み（FR-03・FR-04）
 * ------------------------------------------------------------------ */

/**
 * スポットごとの進み。
 *
 * ★ おためしではサーバーが**再チェックイン制限を効かせられない**（前回時刻を
 * 持たないため）。ここに置いた記録で画面側が抑える。破られても他人に影響は無く、
 * サーバーには何も残らない。
 */
export interface GuestSpotProgress {
  lastCheckinAt: number
  visitCount: number
  /** クイズで報酬を受け取った時刻。undefined は未正解 */
  quizClearedAt: number | undefined
}

export interface GuestProgress {
  /** 端末の中だけの累計ポイント。サーバーの累計とは別物である */
  points: number
  spots: Record<string, GuestSpotProgress>
}

export const EMPTY_GUEST_PROGRESS: GuestProgress = { points: 0, spots: {} }

/** 保存するスポット数の上限。おためしでこれを超える人は LINE でログインしたほうがよい */
const MAX_SPOTS = 500

function isSpotProgress(value: unknown): value is GuestSpotProgress {
  if (typeof value !== 'object' || value === null) return false
  const raw = value as Record<string, unknown>
  return typeof raw['lastCheckinAt'] === 'number' && typeof raw['visitCount'] === 'number'
}

/** 端末に残っている進み。壊れていれば空で返す */
export function loadGuestProgress(): GuestProgress {
  const store = storage()
  if (!store) return EMPTY_GUEST_PROGRESS

  try {
    const raw = store.getItem(PROGRESS_KEY)
    if (raw === null) return EMPTY_GUEST_PROGRESS

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_GUEST_PROGRESS
    const record = parsed as Record<string, unknown>

    const spots: Record<string, GuestSpotProgress> = {}
    const rawSpots = record['spots']
    if (typeof rawSpots === 'object' && rawSpots !== null) {
      // ★ 1件ずつ検査する。手で書き換えられる場所なので、形を信じない
      for (const [spotId, value] of Object.entries(rawSpots as Record<string, unknown>)) {
        if (!isSpotProgress(value)) continue
        const cleared = (value as unknown as Record<string, unknown>)['quizClearedAt']
        spots[spotId] = {
          lastCheckinAt: value.lastCheckinAt,
          visitCount: value.visitCount,
          quizClearedAt: typeof cleared === 'number' && cleared > 0 ? cleared : undefined,
        }
      }
    }

    return {
      points: typeof record['points'] === 'number' && record['points'] >= 0 ? record['points'] : 0,
      spots,
    }
  } catch {
    return EMPTY_GUEST_PROGRESS
  }
}

/** 進みを端末へ書く。書けなくても落とさない */
export function saveGuestProgress(progress: GuestProgress): void {
  const store = storage()
  if (!store) return

  try {
    const entries = Object.entries(progress.spots).slice(0, MAX_SPOTS)
    store.setItem(
      PROGRESS_KEY,
      JSON.stringify({ points: progress.points, spots: Object.fromEntries(entries) }),
    )
  } catch {
    // 容量超過・書き込み禁止。記録は失うが、遊べる状態は保つ
  }
}

/** おためしの記録を消す。「残っているのが気になる」に応えられるようにする */
export function clearGuestData(): void {
  const store = storage()
  if (!store) return

  try {
    store.removeItem(TILES_KEY)
    store.removeItem(CONSENT_KEY)
    store.removeItem(PROGRESS_KEY)
  } catch {
    // 消せないときは何もできない
  }
}
