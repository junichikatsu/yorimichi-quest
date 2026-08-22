import type { SpotId, SpotWithDistance } from '@imanouchi/shared'

/**
 * チェックインできる圏内に入った瞬間の検出（FR-02-10）。
 *
 * ★ これは演出のためではない。歩行中は画面を覆っている（FR-02-9）ので、
 * **着いたことは音でしか伝えられない**。鳴らす瞬間を決めるのがここである。
 *
 * ★ 判定を純粋な関数に切り出してある。閾値の振る舞い（圏界で鳴り続けないこと、
 * 起動直後にまとめて鳴らないこと）をテストで固定したいため。歩行判定
 * （`walking.ts`）と同じ理由で、**入りと出で閾値を分ける**。
 *
 * ★ 「近づくと鳴る」は移動の動機になる（G-2・NFR-14）。鳴らす条件を
 * 「圏内に入った」だけに留め、**近さで報酬を変えない**。ここに「あと10mで
 * 高得点」のような段階を持ち込んではいけない。
 */

/**
 * 出圏と見なす余白（m）。
 *
 * ★ 入圏と同じ閾値にしてはいけない。測位は数十m単位で揺れるため、圏界に
 * 立っているだけで入圏と出圏を繰り返し、**ポケットの中で鳴り続ける**。
 * 一度入ったら、この余白のぶん離れるまで「圏内のまま」として扱う。
 */
export const EXIT_MARGIN_M = 30

export interface NearbyTracker {
  /** 圏内と見なしているスポット */
  inside: readonly SpotId[]
  /**
   * 一度でも判定したか。
   *
   * ★ 最初の判定では知らせない。起動した場所がすでに圏内なら、開いた瞬間に
   * まとめて鳴る（歩いていないのに鳴る）。押せるボタンや一覧の印は最初から
   * 出るので、**知らせを落としても分からなくはならない**。
   */
  seeded: boolean
}

export function initialNearby(): NearbyTracker {
  return { inside: [], seeded: false }
}

export interface NearbyInput {
  /** チェックインできる半径（m）。サーバーから配られる（FR-03-1） */
  radiusM: number
  /** 距離つきのスポット */
  spots: readonly SpotWithDistance[]
}

export interface NearbyStep {
  tracker: NearbyTracker
  /** 今回はじめて圏内へ入ったスポット。近い順 */
  arrived: SpotWithDistance[]
}

/**
 * 新しい距離の一覧を与えて判定を進める。
 *
 * 距離が付いていない（現在地が無い）あいだは**前回の判定を保つ**。位置が
 * 一瞬切れただけで再武装させると、戻った瞬間にもう一度鳴る。
 */
export function trackNearby(prev: NearbyTracker, input: NearbyInput): NearbyStep {
  /*
   * ★ 測れるものが1つも無いうちは何も決めない。
   *
   * スポットの取得と測位は別々に届く。片方が未着の状態で「圏内は空」と
   * 確定させると、届いた瞬間に全件が新規の到着になる。
   */
  const measurable = input.spots.some((spot) => spot.distanceM !== null)
  if (!measurable) return { tracker: prev, arrived: [] }

  const was = new Set(prev.inside)
  const inside: SpotId[] = []
  const arrived: SpotWithDistance[] = []

  for (const spot of input.spots) {
    if (spot.distanceM === null) {
      if (was.has(spot.spotId)) inside.push(spot.spotId)
      continue
    }

    // ヒステリシス。入りは半径そのまま、出は余白のぶん広く見る
    const limit = was.has(spot.spotId) ? input.radiusM + EXIT_MARGIN_M : input.radiusM
    if (spot.distanceM > limit) continue

    inside.push(spot.spotId)
    if (!was.has(spot.spotId)) arrived.push(spot)
  }

  const tracker: NearbyTracker = { inside, seeded: true }
  if (!prev.seeded) return { tracker, arrived: [] }

  arrived.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
  return { tracker, arrived }
}
