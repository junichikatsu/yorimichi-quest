import type { SpotId } from '@imanouchi/shared'

/**
 * 覆っている間に起きたことの控え（FR-02-9・FR-02-10）。
 *
 * ★ 歩行中は画面を覆っている。その間に起きたこと（町丁目の開放・チェックイン
 * できる場所への到着）は**音で知らせるだけで、画面には出せない**。
 * 覆いが外れた時点でまとめて見せるために、ここへ積んでおく。
 *
 * ★ 覆いの上に出して読ませてはいけない。覆いを外す動機を作れば、それは
 * 歩きスマホである（NFR-14）。控えは「立ち止まってから読むもの」である。
 */

export type WalkEventKind = 'arrival' | 'area' | 'hazard'

export interface WalkEvent {
  kind: WalkEventKind
  /**
   * 同じものを二重に積まないための鍵。
   * 到着はスポットID、開放は町丁目コード、ハザードは種別を入れる。
   */
  key: string
  /** 画面に出す名前 */
  name: string
  /** 到着のときだけ入る。押したときにそのスポットを開くため */
  spotId: SpotId | undefined
}

/**
 * 控えに積む上限。
 *
 * ★ 際限なく積むと、長く歩いたあとに何十件も並ぶ。読み切れない量を出すのは
 * 出さないのと同じである。溢れたぶんは件数として残す（黙って減らさない）。
 */
export const WALK_LOG_MAX = 8

export interface WalkLog {
  /** 起きた順。溢れた場合は**新しいほうを残す**（直前に何があったかを知りたい） */
  events: readonly WalkEvent[]
  /** 上限で載せられなかった件数 */
  dropped: number
}

export const EMPTY_WALK_LOG: WalkLog = { events: [], dropped: 0 }

function idOf(event: WalkEvent): string {
  return `${event.kind}:${event.key}`
}

/**
 * 控えに足す。
 *
 * ★ 同じものは足さない。到着の判定（`nearby.ts`）は圏内へ入った一度だけを
 * 返すが、覆いが出ている間に測位が乱れて出入りすれば同じ場所が二度来る。
 * **重ねて数えると「たくさん歩いた」ように見えてしまう。**
 */
export function appendWalkEvents(log: WalkLog, incoming: readonly WalkEvent[]): WalkLog {
  const known = new Set(log.events.map(idOf))
  const fresh = incoming.filter((event) => {
    const id = idOf(event)
    if (known.has(id)) return false
    known.add(id)
    return true
  })

  if (fresh.length === 0) return log

  const merged = [...log.events, ...fresh]
  const overflow = Math.max(0, merged.length - WALK_LOG_MAX)

  return {
    events: merged.slice(overflow),
    dropped: log.dropped + overflow,
  }
}

/** 種類ごとの名前。控えを画面へ出すときに使う */
export function namesOf(log: WalkLog, kind: WalkEventKind): string[] {
  return log.events.filter((event) => event.kind === kind).map((event) => event.name)
}
