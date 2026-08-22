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
export type OverlayStep = 'burst' | 'cards' | 'survey' | 'none'

export interface OverlayInput {
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
  return overlayStep({ ...input, hasBurst: false }) !== 'none'
}
