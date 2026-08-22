import type { GameElements } from './emergency.js'

/**
 * 重ねて出すものの順番（FR-03-2・FR-12-3・FR-14-8）。
 *
 * ★ **同時に出さない。** 3.2秒で自動的に消える演出と、読んで操作する面が同時に
 * 画面へ出ると、読んでいる最中に片方が消える。実際にそうなった：チェックインの
 * ボタンを押すと「スポット詳細が一瞬映り、ポイントの演出とアンケートが重なって出て、
 * ポイントの演出だけ消える」。**どれも読まれないまま流れていく。**
 *
 * ★ 判定をここに切り出しているのは、**画面ごとに `&&` を書くと必ず食い違う**ため。
 * 「出す条件」と「次を待つ条件」を別々に書いた結果が上の不具合だった。ここが唯一の
 * 決定箇所で、App はこの返り値だけを見る。
 *
 * ★ 有事モードの判定（`GameElements`）を入力に含めているのが要点である。
 * **演出は描かれなければ自動で消える処理（`onDone`）も走らない。** 「値が入って
 * いるか」だけで次を待つと、出てもいない演出をいつまでも待ち続け、アンケートが
 * 永久に開かない。出す条件と待つ条件を同じ式にして、片方だけ直せない形にする。
 */

/**
 * いま出す番のもの。
 *
 * - `burst`: チェックインのポイント（FR-03-2）。自動で消える
 * - `cards`: 手に入れたカード（FR-14-8）。自動で消える／触れば閉じる
 * - `survey`: 現地確認アンケート（FR-12-3）。**利用者が操作する面**
 * - `none`: 何も出さない
 */
export type OverlayStep = 'waiting' | 'burst' | 'cards' | 'survey' | 'none'

/**
 * サーバーを待っている処理。
 *
 * ★ 分けているのは、**待っている面が画面にあるかどうか**が違うためである。
 * クイズの回答は設問の面が出たままなので、そこで選択肢を無効にすれば伝わる。
 * チェックインとアンケートの読み込みは**画面に何も無い状態で待つ**ので、
 * 覆って知らせないと「押したのに何も起きない」に見える（実際にそう見えた）。
 *
 * - `checkin`: チェックインの記録。押した直後で、まだ演出も面も出ていない
 * - `survey`: アンケートの読み込み。ポイントの演出が消えたあとで、画面は空
 * - `quiz`: クイズの読み込み。アンケートを閉じた直後で、やはり画面は空
 * - `answer`: クイズ・アンケートの送信。**面が出ているので覆わない**
 */
export const WAITING_KINDS = ['checkin', 'survey', 'quiz', 'answer'] as const

export type WaitingKind = (typeof WAITING_KINDS)[number]

/**
 * 画面を覆って待つか。
 *
 * ★ **自分の面が画面に無いものだけ覆う。** 面があるのに覆うと、読んでいた設問が
 * 隠れる（クイズの回答ごとに問題文が消えることになる）。
 */
export function waitingCoversScreen(kind: WaitingKind): boolean {
  return kind !== 'answer'
}

/** 覆っているあいだに出す文。**何を待っているのかを書く**（「読み込み中」では分からない） */
export const WAITING_MESSAGES: Record<WaitingKind, string> = {
  checkin: 'チェックインを記録しています',
  survey: 'この場所の設問を読み込んでいます',
  quiz: '防災クイズを読み込んでいます',
  answer: '送っています',
}

export interface OverlayInput {
  /**
   * サーバーを待っている処理。undefined は待っていない。
   *
   * ★ 何よりも先に出す。**待ちを隠して演出を出すと、順番が入れ替わって見える**
   * （記録が終わる前に「+30pt」が出たように見えてしまう）。
   */
  waiting: WaitingKind | undefined
  /** ポイントの演出の中身があるか */
  hasBurst: boolean
  /** 見せていないカードがあるか */
  hasCards: boolean
  /** 演出のあとに開く約束をしたアンケートがあるか */
  hasPendingSurvey: boolean
  /** 有事モードで隠すものの判定（FR-08-2）。`gameElements` の結果をそのまま渡す */
  game: GameElements
}

/**
 * 順番を決める。
 *
 * ★ 並びは **ポイント → カード → アンケート**。労力の順ではなく、
 * 「勝手に消えるもの」を先に、「読んで操作するもの」を後に置いている。
 * 逆にすると、操作している最中に演出が割り込む。
 *
 * ★ 有事モードで隠されているものは**飛ばす**（待たない）。隠された演出を待つと、
 * その先が永久に開かない。
 */
export function overlayStep(input: OverlayInput): OverlayStep {
  /*
   * ★ 待ちを最優先で出す。**有事モードでも隠さない。** これは演出（褒める表示）では
   * なく、操作を受け付けていないことの表示である。隠すと、押しても何も起きない
   * 画面になる。
   */
  if (input.waiting !== undefined && waitingCoversScreen(input.waiting)) return 'waiting'

  if (input.hasBurst && input.game.checkin) return 'burst'
  if (input.hasCards && input.game.cards) return 'cards'
  if (input.hasPendingSurvey && input.game.survey) return 'survey'
  return 'none'
}

/**
 * ポイントの演出のあとに、まだ続くものがあるか。
 *
 * ★ **続くときは演出を短くする**ために要る。順番に出す形にした結果、初回訪問では
 * ポイント → 場所カード → アンケートで、アンケートに着くまでが長くなった。
 * 待たせたいのではなく、重ねたくないだけである。後ろが空いているときは
 * ゆっくり読ませ、続きがあるときは切り上げる。
 *
 * ★ 判定は `overlayStep` を使い回す。**「後ろに何があるか」を別の式で書いてはいけない。**
 * 有事モードで隠されているものは飛ばす、という規則もそのまま効かせたい
 * （隠れているものを「続き」と数えると、続きが無いのに演出だけ短くなる）。
 */
export function hasNextAfterBurst(input: OverlayInput): boolean {
  /*
   * ★ 待ちは「続き」に数えない。ポイントの演出が出ている時点で記録は終わっており、
   * このあと待ちが入るかどうかは**まだ分からない**（アンケートの読み込みは演出が
   * 消えてから始まる）。数えると、続きが無いときまで演出が短くなる。
   */
  return overlayStep({ ...input, waiting: undefined, hasBurst: false }) !== 'none'
}
