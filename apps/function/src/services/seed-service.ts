import {
  deleteSpot,
  listSpotsByArea,
  putSpot,
  type DataStoreContext,
} from '@imanouchi/datastore'
import type { AreaId, Spot } from '@imanouchi/shared'

/**
 * スポットの投入（FR-10-2）。
 *
 * ★ データストアに一括投入が無いため、件数ぶん `putItem` を順に呼ぶしかない。
 * そして**連続して速く書くとスロットリングされる**（実測：間隔なしで約280件目で失敗）。
 *
 * 一息に全件書く形は2つの理由で採らない。
 *
 * 1. 実行環境のタイムアウトに当たる
 * 2. **アクセス数に月次上限がある**（プラットフォーム制約 E4）。失敗してやり直すたびに
 *    件数ぶん消費するので、一息に書く形は上限に対して高くつく
 *
 * そのため範囲を指定して少しずつ入れ、**詰まったら自動で間隔を広げて再試行**する。
 * 運用者が毎回 `delayMs` を思い出す前提にはしない。忘れられる対策は対策ではない。
 */

/** 1件ごとの既定の間隔。0 にしないのは、速く書くと弾かれると実測で分かっているため */
export const DEFAULT_SEED_DELAY_MS = 100

/** 1件あたりの再試行回数の上限。★ 再試行もアクセス数を消費するので伸ばさない */
const MAX_RETRIES = 3

/** 再試行前に待つ時間。回を追うごとに倍にする */
const RETRY_BASE_MS = 300

/** 詰まったあとに引き上げる間隔の上限。ここまで緩めても駄目なら諦める */
const MAX_ADAPTIVE_DELAY_MS = 1000

export interface SeedRange {
  /** 何件目から入れるか（0 起点） */
  offset: number
  /** 何件入れるか */
  count: number
  /** 1件ごとの間隔（ミリ秒） */
  delayMs: number
}

export interface SeedResult {
  /** 対象データの全件数 */
  total: number
  from: number
  to: number
  inserted: number
  /**
   * 途中で止まった位置（0 起点）。undefined なら指定範囲を完走した。
   *
   * ★ 止まったことを黙って 200 で返さないために持たせている。
   */
  stoppedAt: number | undefined
  /** 次に指定する offset。null なら全件終わっている */
  nextOffset: number | null
  /** スロットリングで再試行した回数。0 でなければ間隔が足りていない */
  retries: number
  /** 最終的に使っていた間隔（ミリ秒）。自動で広げた結果が出る */
  delayMs: number
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

type Attempt =
  | { ok: true; retries: number }
  | { ok: false; retries: number; error: unknown }

/**
 * 1件ぶんの操作。スロットリングされたら間隔を置いて数回だけやり直す。
 *
 * ★ 何が失敗だったかはここでは判別しない。データストアは理由を文字列で返し、
 * 分類はすべて `failed` に落ちる（`packages/datastore/src/errors.ts`）。
 * 設定の誤りなら再試行しても同じく失敗するので、**回数を絞ることで区別の代わりにする。**
 *
 * 書き込みと削除の両方で使う。どちらも同じ理由で弾かれる。
 */
async function withRetry(operation: () => Promise<void>): Promise<Attempt> {
  let retries = 0

  for (;;) {
    try {
      await operation()
      return { ok: true, retries }
    } catch (err) {
      if (retries >= MAX_RETRIES) return { ok: false, retries, error: err }
      retries += 1
      await sleep(RETRY_BASE_MS * 2 ** (retries - 1))
    }
  }
}

/** 詰まったあとに引き上げる間隔 */
function widen(delayMs: number): number {
  return Math.min(Math.max(delayMs * 2, RETRY_BASE_MS), MAX_ADAPTIVE_DELAY_MS)
}

/**
 * 指定範囲のスポットを投入する。
 *
 * ★ 1件目から失敗した場合は例外をそのまま投げる。設定の誤り（テーブルID・キー名）
 * である可能性が高く、200 で「0件入れました」と返すと**気づけない**。
 *
 * 2件目以降で止まった場合は、入った件数と止まった位置を返す。
 * `putItem` はキー指定の上書きなので、同じ位置から再実行すれば続きから埋まる。
 */
export async function seedSpots(
  ctx: DataStoreContext,
  spots: Spot[],
  range: SeedRange,
): Promise<SeedResult> {
  const from = Math.min(range.offset, spots.length)
  const to = Math.min(from + range.count, spots.length)

  let inserted = 0
  let retries = 0
  let stoppedAt: number | undefined
  let delayMs = range.delayMs

  for (let i = from; i < to; i += 1) {
    const spot = spots[i]
    if (!spot) break

    const result = await withRetry(() => putSpot(ctx, spot))
    retries += result.retries

    if (!result.ok) {
      // 1件も入っていないなら設定の誤りとして扱い、素の例外を上へ返す
      if (inserted === 0) throw result.error
      stoppedAt = i
      break
    }

    // ★ 一度詰まったら、残りは間隔を広げて進む。同じ速さで続けても再び詰まる
    if (result.retries > 0) delayMs = widen(delayMs)

    inserted += 1
    if (delayMs > 0 && i + 1 < to) await sleep(delayMs)
  }

  const reached = stoppedAt ?? to
  return {
    total: spots.length,
    from,
    to,
    inserted,
    stoppedAt,
    nextOffset: reached < spots.length ? reached : null,
    retries,
    delayMs,
  }
}

/* ------------------------------------------------------------------ *
 * 削除（やり直しのため）
 * ------------------------------------------------------------------ */

export interface PurgeRange {
  /** 1回で消す上限 */
  count: number
  delayMs: number
}

export interface PurgeResult {
  deleted: number
  /**
   * まだ残っている可能性があるか。
   *
   * ★ 総数は数えられない（データストアに集計が無い）。上限まで消えたなら
   * 「まだあるかもしれない」として true を返し、呼び出し側が繰り返す。
   */
  hasMore: boolean
  retries: number
  delayMs: number
  /** 途中で止まったか。true なら残りは次の呼び出しで消す */
  stopped: boolean
}

/**
 * エリア内のスポットを消す（管理用）。
 *
 * ★ 消す前に query で引くので、**削除1件につきアクセスは2回**（query は
 * まとめて1回だが、削除は1件ずつ）。入れ直しのたびに全消しするなら、
 * `AREA_ID` を変えてパーティションを分ける方が**アクセス数を消費しない**。
 *
 * それでも「消す」経路が無いと後戻りできないので用意している。
 */
export async function purgeSpots(
  ctx: DataStoreContext,
  areaId: AreaId,
  range: PurgeRange,
): Promise<PurgeResult> {
  const spots = await listSpotsByArea(ctx, areaId, range.count)

  let deleted = 0
  let retries = 0
  let stopped = false
  let delayMs = range.delayMs

  for (const spot of spots) {
    const result = await withRetry(() => deleteSpot(ctx, areaId, spot.spotId))
    retries += result.retries

    if (!result.ok) {
      // 1件も消えていないなら設定の誤りとして扱い、素の例外を上へ返す
      if (deleted === 0) throw result.error
      stopped = true
      break
    }

    if (result.retries > 0) delayMs = widen(delayMs)
    deleted += 1
    if (delayMs > 0) await sleep(delayMs)
  }

  return {
    deleted,
    // 上限まで消えたなら、まだ残っているかもしれない
    hasMore: !stopped && spots.length >= range.count,
    retries,
    delayMs,
    stopped,
  }
}
