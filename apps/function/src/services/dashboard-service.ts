import { listSpotsByArea, type DataStoreContext } from '@imanouchi/datastore'
import {
  buildChomeCsv,
  buildDashboardSummary,
  buildGapCsv,
  buildVerifiedCsv,
  chomeRowsOf,
  type AreaId,
  type DashboardSummary,
  type Spot,
} from '@imanouchi/shared'

/**
 * 行政還元ダッシュボードの供給（FR-09）。
 *
 * ★ **読み取りしかしない。** 認証なしで開ける画面から呼ばれる（FR-09-5）ので、
 * 書き込む経路をここに作ってはいけない。壊せるものが無い状態を保つ。
 *
 * ★ 集計そのものは `@imanouchi/shared` の純関数にある。ここがやるのは
 * **データストアから全件を読むこと**と、**読み切れたかどうかを見張ること**だけである。
 */

export interface DashboardInput {
  areaId: AreaId
  areaName: string
  limit: number
  threshold: number
  chomeTopLimit: number
  now: Date
}

export interface DashboardData {
  summary: DashboardSummary
  spots: Spot[]
  /**
   * 上限で切られたか。
   *
   * ★ **切られたまま集計を出してはいけない。** 件数が減るのではなく、
   * 「属性が空のスポットが 232 件ある」という数字が小さく出る。**主張が弱くなる
   * 方向に静かに壊れる**ので、画面まで運んで断り書きを出す。
   */
  truncated: boolean
}

async function loadSpots(
  ctx: DataStoreContext,
  areaId: AreaId,
  limit: number,
): Promise<{ spots: Spot[]; truncated: boolean }> {
  // 上限より1件多く引いて、ちょうど上限だったのか切られたのかを見分ける
  const fetched = await listSpotsByArea(ctx, areaId, limit + 1)
  const truncated = fetched.length > limit
  return { spots: truncated ? fetched.slice(0, limit) : fetched, truncated }
}

export async function getDashboardData(
  ctx: DataStoreContext,
  input: DashboardInput,
): Promise<DashboardData> {
  const { spots, truncated } = await loadSpots(ctx, input.areaId, input.limit)

  if (truncated) {
    console.warn(`[dashboard] truncated at ${spots.length} (DASHBOARD_MAX_SPOTS)`)
  }

  const summary = buildDashboardSummary({
    spots,
    areaName: input.areaName,
    generatedAt: input.now.toISOString(),
    chomeTopLimit: input.chomeTopLimit,
    threshold: input.threshold,
  })

  return { summary, spots, truncated }
}

/** CSV の種類。増やすときはここと routes の両方を触ることになる */
export type CsvKind = 'verified' | 'gaps' | 'chome'

export interface CsvResult {
  body: string
  /** ダウンロード時のファイル名。日付を入れて、いつ時点かを手元に残す */
  filename: string
}

export function buildCsv(kind: CsvKind, data: DashboardData, threshold: number): CsvResult {
  const date = data.summary.generatedAt.slice(0, 10)

  if (kind === 'verified') {
    return {
      body: buildVerifiedCsv(data.spots, { threshold }),
      filename: `imanouchi_verified_${date}.csv`,
    }
  }
  if (kind === 'gaps') {
    return {
      body: buildGapCsv(data.spots, { threshold }),
      filename: `imanouchi_gaps_${date}.csv`,
    }
  }
  return {
    body: buildChomeCsv(chomeRowsOf(data.spots)),
    filename: `imanouchi_chome_${date}.csv`,
  }
}
