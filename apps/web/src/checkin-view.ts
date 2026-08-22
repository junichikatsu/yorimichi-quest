/**
 * チェックインボタンの状態（FR-03）。
 *
 * ★ 判定はサーバーが持つ。ここで決めるのは**押せるボタンを出すかどうか**だけである。
 * 遠いのに押せるボタンを出すと、押してから断られる。逆にここを厳しくしすぎると
 * サーバーが通す状況でも押せなくなるので、**同じ閾値を使う**（設定から配られる）。
 *
 * ★ 状態を1か所で組み立てる理由: 「位置が無い」「遠い」「時間をおく」「済んだ」の
 * 4つは案内の文言が全部違う。分岐を画面に散らすと、**どれかが黙って消える**。
 */

/** そのスポットの進み。LINE ログインならサーバー由来、おためしなら端末由来 */
export interface SpotProgress {
  /** 次にチェックインできる時刻（epoch ms）。undefined は制限なし */
  nextAvailableAt: number | undefined
  /** 訪問回数（FR-03-4 の貢献度） */
  visitCount: number
  /** このスポットのクイズに正解済みか（FR-04） */
  quizCleared: boolean
}

export const NO_PROGRESS: SpotProgress = {
  nextAvailableAt: undefined,
  visitCount: 0,
  quizCleared: false,
}

export interface CheckinViewInput {
  /** 現在地からの距離（m）。位置が取れていなければ null */
  distanceM: number | null
  radiusM: number
  progress: SpotProgress
  now: number
}

export interface CheckinView {
  /** ボタンを押せるか */
  enabled: boolean
  /** ボタンの文字。押せない理由が分かる文にする */
  label: string
  /** 補足。undefined なら出さない */
  note: string | undefined
}

/** 「あと 12 分」の形にする。秒は出さない（1秒ごとに描き替える意味がない） */
function formatRemaining(ms: number): string {
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return `あと ${minutes} 分`
  const hours = Math.ceil(minutes / 60)
  return `あと ${hours} 時間`
}

export function buildCheckinView(input: CheckinViewInput): CheckinView {
  const { distanceM, radiusM, progress, now } = input

  if (distanceM === null) {
    return {
      enabled: false,
      label: '現在地を取得中',
      note: '位置情報が使えるとチェックインできます。',
    }
  }

  if (distanceM > radiusM) {
    return {
      enabled: false,
      label: `半径 ${radiusM}m 以内で可能`,
      // ★ 「あと何m」を出す。近づけばよいと分からないと、その場で諦める
      note: `あと ${Math.max(1, Math.round(distanceM - radiusM))}m 近づいてください。`,
    }
  }

  if (progress.nextAvailableAt !== undefined && now < progress.nextAvailableAt) {
    return {
      enabled: false,
      label: `時間をおいて再チェックイン（${formatRemaining(progress.nextAvailableAt - now)}）`,
      note: '同じ場所は一定時間あけてから記録できます。',
    }
  }

  return {
    enabled: true,
    label: progress.visitCount > 0 ? 'また来たことを記録する' : 'チェックインする',
    note: undefined,
  }
}

/**
 * いまチェックインできるか。
 *
 * ★ 地図と一覧で「押せるスポット」を目立たせるために使う。**押せる条件を
 * ここ以外で組み立ててはいけない。** 目立たせる条件とボタンの条件がずれると、
 * 「光っているのに押せない」場所が生まれる。
 */
export function isCheckinReady(input: CheckinViewInput): boolean {
  return buildCheckinView(input).enabled
}

/** おためしの端末内記録。`guest-store` の形をそのまま受ける（型の重複を避ける） */
export interface StoredSpotProgress {
  lastCheckinAt: number
  visitCount: number
  quizClearedAt: number | undefined
}

/**
 * 端末内の記録を画面の状態へ直す。
 *
 * ★ 保存しているのは「前回いつ来たか」であり、「次いつ来られるか」ではない。
 * 待ち時間の設定（サーバーから配られる）は後から変わりうるので、**保存側に
 * 焼き付けない**。焼き付けると、設定を変えても古い端末だけ挙動が違う。
 */
export function progressFromStored(
  spots: Record<string, StoredSpotProgress>,
  cooldownHours: number,
): Record<string, SpotProgress> {
  const cooldownMs = cooldownHours * 60 * 60 * 1000
  const result: Record<string, SpotProgress> = {}

  for (const [spotId, stored] of Object.entries(spots)) {
    result[spotId] = {
      nextAvailableAt: stored.lastCheckinAt + cooldownMs,
      visitCount: stored.visitCount,
      quizCleared: stored.quizClearedAt !== undefined,
    }
  }

  return result
}
