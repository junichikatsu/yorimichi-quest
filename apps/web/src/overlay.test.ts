import { describe, expect, it } from 'vitest'
import { gameElements } from './emergency.js'
import {
  hasNextAfterBurst,
  overlayStep,
  WAITING_KINDS,
  type OverlayInput,
} from './overlay.js'

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
    waiting: undefined,
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

/**
 * サーバーを待っているあいだの覆い。
 *
 * ★ 通信が遅いと「押したのに何も起きない」時間ができ、もう一度押される。
 * **二重に記録しようとして 409 になり、エラーの知らせだけが出る**（実際に起きた）。
 */
describe('overlayStep（待っているあいだ）', () => {
  it('★ 待っているあいだは何よりも先に覆いを出す', () => {
    /*
     * ★ 待ちを隠して演出を出すと、順番が入れ替わって見える
     * （記録が終わる前に「+30pt」が出たように見える）。
     */
    const step = overlayStep(
      input({ waiting: 'checkin', hasBurst: true, hasCards: true, hasPendingSurvey: true }),
    )
    expect(step).toBe('waiting')
  })

  it('チェックインの記録を待つあいだは覆う', () => {
    expect(overlayStep(input({ waiting: 'checkin' }))).toBe('waiting')
  })

  it('アンケートの読み込みを待つあいだは覆う（画面が空になる区間）', () => {
    expect(overlayStep(input({ waiting: 'survey' }))).toBe('waiting')
  })

  it('クイズの読み込みを待つあいだも覆う', () => {
    expect(overlayStep(input({ waiting: 'quiz' }))).toBe('waiting')
  })

  it('★ 送信中も覆う（送ったのに何も起きない時間を作らない）', () => {
    /*
     * ★ 当初は「面が画面に出ているものは覆わない」としていた。読んでいた設問が
     * 隠れることを避けたかったが、**送ってから結果が出るまでが遅く、送ったのに
     * 何も起きない時間になっていた。** 送ったあとに読み返す設問は無いので覆う。
     */
    expect(overlayStep(input({ waiting: 'answer' }))).toBe('waiting')
  })

  it('カードの一覧の読み込みも覆う', () => {
    expect(overlayStep(input({ waiting: 'cards' }))).toBe('waiting')
  })

  it('★ 待つものはすべて覆う（覆わない待ちを作らない）', () => {
    /*
     * ★ 1つでも漏れると、そこだけ「押したのに何も起きない」場面になる。
     * 種類を足したときに覆い忘れないよう、全種類を回して確かめる。
     */
    for (const kind of WAITING_KINDS) {
      expect(overlayStep(input({ waiting: kind })), kind).toBe('waiting')
    }
  })

  it('★ 有事モードでも覆いは隠さない（演出ではなく、操作を止めている表示である）', () => {
    /*
     * ★ ゲーム要素は隠すが（FR-08-2）、これは褒める表示ではない。隠すと
     * 「押しても何も起きない画面」になる。
     */
    const step = overlayStep(input({ waiting: 'checkin', game: gameElements(true) }))
    expect(step).toBe('waiting')
  })

  it('待ち終われば、順番どおり演出へ進む', () => {
    expect(overlayStep(input({ hasBurst: true, hasPendingSurvey: true }))).toBe('burst')
  })
})

/**
 * ポイントの演出の長さ（FR-03-2）。
 *
 * ★ 重ねないために順番にした結果、**足した待ち時間がそのままアンケートに着くまでの
 * 遅れになる**（初回訪問はカードも挟むので一番長い）。続きがあるときだけ短くする。
 */
describe('hasNextAfterBurst', () => {
  it('後ろに何も無ければ、ゆっくり読ませる（短くしない）', () => {
    expect(hasNextAfterBurst(input({ hasBurst: true }))).toBe(false)
  })

  it('カードが続くなら短くする', () => {
    expect(hasNextAfterBurst(input({ hasBurst: true, hasCards: true }))).toBe(true)
  })

  it('アンケートが続くなら短くする', () => {
    expect(hasNextAfterBurst(input({ hasBurst: true, hasPendingSurvey: true }))).toBe(true)
  })

  it('★ 隠れているものを「続き」と数えない（続きが無いのに短くしない）', () => {
    /*
     * ★ 有事モードで隠されているものは出てこない。それを続きと数えると、
     * **このあと何も出ないのに演出だけ短く消える**（読む時間が理由なく削られる）。
     * 判定を `overlayStep` の使い回しにしてあるので、隠す規則がそのまま効く。
     */
    const game = gameElements(true)

    expect(
      hasNextAfterBurst(input({ hasBurst: true, hasCards: true, hasPendingSurvey: true, game })),
    ).toBe(false)
  })

  it('カードだけ隠れていてもアンケートが続くなら短くする', () => {
    const game = { ...gameElements(false), cards: false }

    expect(hasNextAfterBurst(input({ hasBurst: true, hasCards: true, hasPendingSurvey: true, game }))).toBe(
      true,
    )
  })

  it('★ 自分（ポイントの演出）を続きと数えない', () => {
    // hasBurst だけが真のときに true を返すと、常に短くなってしまう
    expect(hasNextAfterBurst(input({ hasBurst: true }))).toBe(false)
  })

  it('★ 待ちを「続き」に数えない', () => {
    /*
     * ★ ポイントの演出が出ている時点で記録は終わっている。このあと待ちが入るかは
     * **まだ分からない**（設問の読み込みは演出が消えてから始まる）。数えると、
     * 続きが無いときまで演出が短くなる。
     */
    expect(hasNextAfterBurst(input({ waiting: 'checkin', hasBurst: true }))).toBe(false)
  })
})
