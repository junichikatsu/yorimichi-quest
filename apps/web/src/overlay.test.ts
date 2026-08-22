import { describe, expect, it } from 'vitest'
import { gameElements } from './emergency.js'
import { overlayStep, type OverlayInput } from './overlay.js'

/**
 * 重ねて出すものの順番（FR-03-2・FR-12-3・FR-14-8）。
 *
 * ★ ここで固定しているのは、**実際に起きた「忙しない」画面**である。
 * チェックインのボタンを押すと、ポイントの演出（3.2秒で自動的に消える）と
 * アンケートが重なって出て、読んでいる最中に点数の表示だけが消えていた。
 * どれも1行で戻せるので、順番そのものをテストで留める。
 */

function input(overrides: Partial<OverlayInput> = {}): OverlayInput {
  return {
    hasBurst: false,
    hasCards: false,
    hasPendingSurvey: false,
    game: gameElements(false),
    ...overrides,
  }
}

describe('overlayStep', () => {
  it('何も無ければ何も出さない', () => {
    expect(overlayStep(input())).toBe('none')
  })

  it('★ ポイントの演出とアンケートが同時に出ない（アンケートは待つ）', () => {
    /*
     * ★ これが直した不具合そのものである。ここが `survey` を返すようになると、
     * 3.2秒で消える演出と、読んで操作する面が同時に画面へ出る。
     */
    const step = overlayStep(input({ hasBurst: true, hasPendingSurvey: true }))
    expect(step).toBe('burst')
  })

  it('★ ポイント → カード → アンケート の順で出す', () => {
    const all = { hasBurst: true, hasCards: true, hasPendingSurvey: true }

    // 勝手に消えるものを先に、読んで操作するものを後に置く
    expect(overlayStep(input(all))).toBe('burst')
    expect(overlayStep(input({ ...all, hasBurst: false }))).toBe('cards')
    expect(overlayStep(input({ ...all, hasBurst: false, hasCards: false }))).toBe('survey')
  })

  it('演出が無ければアンケートはすぐ出る（無用に待たせない）', () => {
    expect(overlayStep(input({ hasPendingSurvey: true }))).toBe('survey')
  })

  it('カードだけならカードを出す', () => {
    expect(overlayStep(input({ hasCards: true }))).toBe('cards')
  })

  /*
   * 有事モード（FR-08-2・FR-12-13）。
   *
   * ★ **隠されている演出を待ってはいけない。** 演出は描かれなければ自動で消える
   * 処理（onDone）も走らないので、値の有無だけで次を待つと永久に開かない。
   * 「出す条件」と「待つ条件」を同じ式にしてあることを、ここで確かめている。
   */
  it('★ 有事モードでは何も出さない（ゲーム要素をすべて隠す）', () => {
    const emergency = gameElements(true)

    const step = overlayStep(
      input({ hasBurst: true, hasCards: true, hasPendingSurvey: true, game: emergency }),
    )
    expect(step).toBe('none')
  })

  it('★ 隠された演出は飛ばす（待たずに次へ進む）', () => {
    /*
     * ポイントの演出だけを隠した状態。`burst` に値はあるが描かれないので、
     * 消える処理も走らない。ここで `burst` を返すと**その先が永久に開かない。**
     */
    const game = { ...gameElements(false), checkin: false }

    expect(overlayStep(input({ hasBurst: true, hasPendingSurvey: true, game }))).toBe('survey')
  })

  it('★ カードの演出が隠されていてもアンケートへ進む', () => {
    const game = { ...gameElements(false), cards: false }

    expect(overlayStep(input({ hasCards: true, hasPendingSurvey: true, game }))).toBe('survey')
  })

  it('アンケートだけが隠されている場合は、演出を出したあと何も出さない', () => {
    const game = { ...gameElements(false), survey: false }

    expect(overlayStep(input({ hasBurst: true, hasPendingSurvey: true, game }))).toBe('burst')
    expect(overlayStep(input({ hasPendingSurvey: true, game }))).toBe('none')
  })
})
