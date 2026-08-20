import { putSpot, type DataStoreContext } from '@imanouchi/datastore'
import type { Spot } from '@imanouchi/shared'

/**
 * スポットの投入（FR-10-2）。
 *
 * ★ データストアに一括投入が無いため、件数ぶん `putItem` を順に呼ぶしかない。
 * 370件を一息に書くと2つの理由で問題になる。
 *
 * 1. 実行環境のタイムアウトに当たる（1件20〜50msでも7〜18秒）
 * 2. **アクセス数に月次上限がある**（プラットフォーム制約 E4）。失敗して
 *    やり直すたびに件数ぶん消費するので、一息に書く形は上限に対して高くつく
 *
 * そのため**範囲を指定して少しずつ**入れられるようにし、途中で失敗しても
 * どこまで入ったかを返す。次はその位置から再開できる。
 */

export interface SeedRange {
  /** 何件目から入れるか（0 起点） */
  offset: number
  /** 何件入れるか */
  count: number
  /** 1件ごとの間隔（ミリ秒）。書き込みが速すぎて弾かれる場合に効かせる */
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
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

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
  let stoppedAt: number | undefined

  for (let i = from; i < to; i += 1) {
    const spot = spots[i]
    if (!spot) break

    try {
      await putSpot(ctx, spot)
    } catch (err) {
      // 1件も入っていないなら設定の誤りとして扱い、素の例外を上へ返す
      if (inserted === 0) throw err
      stoppedAt = i
      break
    }

    inserted += 1
    if (range.delayMs > 0 && i + 1 < to) await sleep(range.delayMs)
  }

  const reached = stoppedAt ?? to
  return {
    total: spots.length,
    from,
    to,
    inserted,
    stoppedAt,
    nextOffset: reached < spots.length ? reached : null,
  }
}
