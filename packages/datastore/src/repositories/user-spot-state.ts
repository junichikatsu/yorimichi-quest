import type { SpotId, UserId } from '@imanouchi/shared'
import type { DataStoreContext } from '../context.js'
import {
  spotStateKey,
  USER_SPOT_STATE_MAIN_KEY,
  USER_SPOT_STATE_SUB_KEY,
  userKey,
} from '../keys.js'
import { runGet, runOp } from '../run.js'

/**
 * 利用者 × スポットの状態（FR-03-3・FR-03-4・FR-04）。
 *
 * ★ 再チェックイン制限の判定を **1 回の getItem で終わらせる**ための専用テーブル。
 * 履歴（checkins）を走査して前回時刻を探すと、件数が増えるほどアクセスが増える。
 * データストアはアクセス数に月次上限がある（制約 E4）。
 *
 * ★ クイズ用に別テーブルを作らない。同じ「利用者 × スポット」の状態なので、
 * 1 レコードにまとめればアクセスは 1 回で済む。
 */
export interface UserSpotState {
  /**
   * 最後にチェックインした時刻（epoch ms）。
   *
   * ★ undefined は「まだチェックインしていない」。クイズだけ先に正解した場合に
   * 起こりうる。0 を入れて代用すると「1970年に来た」ことになり、
   * **初回ボーナスが付かないのにクールダウンも効かない**という状態になる。
   */
  lastCheckinAt: number | undefined
  /** このスポットへの累計訪問回数（FR-03-4 の貢献度） */
  visitCount: number
  /**
   * このスポットのクイズで報酬を受け取った時刻。
   *
   * ★ 再挑戦は何度でもできる（FR-04-6）が、加点は一度だけ。
   * undefined は「まだ正解していない」。
   */
  quizClearedAt: number | undefined
}

export async function getUserSpotState(
  ctx: DataStoreContext,
  userId: UserId,
  spotId: SpotId,
): Promise<UserSpotState | undefined> {
  const tableId = ctx.tableId('userSpotState')
  const result = await runGet(() =>
    ctx.client.getItem({
      tableId,
      key: {
        [USER_SPOT_STATE_MAIN_KEY]: userKey(userId),
        [USER_SPOT_STATE_SUB_KEY]: spotStateKey(spotId),
      },
    }),
  )
  if (!result) return undefined

  const item = result.params?.Item
  if (typeof item !== 'object' || item === null) return undefined
  const raw = item as Record<string, unknown>

  const last = raw['lastCheckinAt']
  const cleared = raw['quizClearedAt']

  /*
   * ★ どちらも読めない行は捨てる。
   *
   * 空の状態を返すと「チェックイン済みでもクイズ正解済みでもない行がある」ことに
   * なり、書き込み側の不具合が**正常な初回訪問と区別できなくなる**。
   */
  if (typeof last !== 'number' && typeof cleared !== 'number') return undefined

  return {
    // 書き込み側が「無い」を 0 で表すため、0 は undefined へ戻す
    lastCheckinAt: typeof last === 'number' && last > 0 ? last : undefined,
    visitCount: typeof raw['visitCount'] === 'number' ? raw['visitCount'] : 0,
    quizClearedAt: typeof cleared === 'number' && cleared > 0 ? cleared : undefined,
  }
}

export async function putUserSpotState(
  ctx: DataStoreContext,
  userId: UserId,
  spotId: SpotId,
  state: UserSpotState,
): Promise<void> {
  const tableId = ctx.tableId('userSpotState')
  await runOp('putItem', () =>
    ctx.client.putItem({
      tableId,
      item: {
        [USER_SPOT_STATE_MAIN_KEY]: userKey(userId),
        [USER_SPOT_STATE_SUB_KEY]: spotStateKey(spotId),
        // データストアは undefined を保持できないので 0 を「無い」として扱う
        lastCheckinAt: state.lastCheckinAt ?? 0,
        visitCount: state.visitCount,
        quizClearedAt: state.quizClearedAt ?? 0,
      },
    }),
  )
}
