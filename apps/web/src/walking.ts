import { distanceMeters, type LatLng } from '@imanouchi/core'

/**
 * 歩いている最中かどうかの判定（FR-02-9）。
 *
 * 歩きながら画面を見せないための機構である。歩行を検出できなければ、
 * 「歩いているあいだは操作させない」を実装できない。
 *
 * ★ 判定を純粋な関数に切り出してある。閾値の振る舞い（とくに信号待ちで
 * 切り替わらないこと）をテストで固定したいため。
 *
 * ★ `coords.speed` は使わない。端末によって null が返り、模擬位置（デモ移動）でも
 * 埋まらない。2 点の距離と時間から出せば、どの経路でも同じ判定になる。
 */

/**
 * 歩き出したと見なす速度（m/s）。時速 3.6km。
 * 成人の歩行は 1.2〜1.4m/s なので、ゆっくり歩いても超える。
 */
const START_MPS = 1.0

/**
 * 止まったと見なす速度（m/s）。時速 1.1km。
 *
 * ★ 歩き出しと同じ閾値にしてはいけない。GPS の速度は数秒ごとに揺れるので、
 * 単一の閾値だと**歩行中モードが点滅する**。低い側を別に置いて、
 * 信号待ちや立ち止まりでだけ解除されるようにする。
 */
const STOP_MPS = 0.3

/**
 * 速度を出すのに必要な最短の間隔（ms）。
 *
 * ★ 短いと GPS の揺れがそのまま速度になる。測位は数m単位で揺れるため、
 * 1 秒で 5m 揺れれば時速 18km に見えてしまう。
 */
const MIN_INTERVAL_MS = 3_000

/**
 * 測位が届かなくなってから歩行中を解除するまでの時間（ms）。
 *
 * ★ これが無いと覆いが出たままになる。`watchPosition` は位置が変わらないと
 * 通知しないことがあり、**立ち止まった瞬間に更新が止まる**端末がある。
 * 最後の測位から一定時間が過ぎたら、止まったものとして扱う。
 */
export const WALK_STALE_MS = 20_000

export interface WalkSample extends LatLng {
  /** 測位した時刻（epoch ms） */
  at: number
}

export interface WalkTracker {
  /** 歩いている最中か */
  walking: boolean
  /** 直近に求めた速度（m/s）。判定に足る間隔がまだ無ければ 0 */
  speedMps: number
  /** 速度の基準にしている位置 */
  anchor: WalkSample | undefined
}

export function initialWalkTracker(): WalkTracker {
  return { walking: false, speedMps: 0, anchor: undefined }
}

/**
 * 新しい測位を1件与えて判定を進める。
 *
 * 間隔が足りないあいだは**基準を動かさない**。動かすと差分がほぼ 0 になり、
 * 速度が常に 0 に潰れて歩行を検出できなくなる。
 */
export function trackWalk(prev: WalkTracker, sample: WalkSample): WalkTracker {
  const anchor = prev.anchor
  if (!anchor) return { ...prev, anchor: sample }

  const elapsedMs = sample.at - anchor.at
  if (elapsedMs < MIN_INTERVAL_MS) return prev

  const speedMps = distanceMeters(anchor, sample) / (elapsedMs / 1000)
  // ヒステリシス。歩き出しは高い閾値、止まりは低い閾値で見る
  const walking = prev.walking ? speedMps >= STOP_MPS : speedMps >= START_MPS

  return { walking, speedMps, anchor: sample }
}

/** 表示用の速度（km/h）。小数第 1 位まで */
export function speedKmh(tracker: WalkTracker): number {
  return Math.round(tracker.speedMps * 3.6 * 10) / 10
}
