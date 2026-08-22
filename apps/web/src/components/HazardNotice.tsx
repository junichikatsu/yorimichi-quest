import type { HazardHere } from '../hazard.js'
import { hazardSentence } from '../hazard.js'

interface HazardNoticeProps {
  here: readonly HazardHere[]
  /**
   * キャラクターの状態にも出しているか。
   *
   * ★ 有事モードでは false を渡す。逃げている最中にゲームの演出は出さないが、
   * **どこに居るかの知らせは出す**（消すほうが危険である）。
   */
  withCharacter: boolean
}

/**
 * いまいる場所のハザード（#72）。
 *
 * ★ 絵だけにしない。**文字でも出す**（NFR-08）。色や見た目だけに意味を持たせると、
 * 小さい画面や色覚によっては伝わらない。
 *
 * ★ 断定しない。判定はタイルの画素で、境界は数十mずれる。
 *
 * ★ **想定であることを必ず添える。** いま水が来ていることを示すものではない。
 * 防災アプリが災害の発生を思わせる画面を出すことはそれ自体が危険である
 * （有事モードのデモ表示の明示・FR-08-9 と同じ作法）。
 *
 * ★ 危ないと知らせるだけで、点数は動かさない（G-2・FR-14-10）。
 * 「濡れると何かが得られる」形にしてはいけない。
 *
 * ★ 「押している間は消える」ことを書く。**書かなければ誰も気づかない。**
 * 塗りは地図の文字の上に重なるので、確かめる手立てがあることを伝える必要がある。
 */
export function HazardNotice({ here, withCharacter }: HazardNoticeProps): React.JSX.Element | null {
  if (here.length === 0) return null

  return (
    <div className="hazardnow" role="status" aria-live="polite">
      <p className="hazardnow__title">{hazardSentence(here)}</p>
      {withCharacter && (
        <p className="hazardnow__character">キャラクターの足元が濡れています。</p>
      )}
      <p className="hazardnow__note">
        <strong>想定です。</strong>いま水が来ていることを示すものではありません。
        色と区分は国土交通省ハザードマップポータルサイトのものです。
      </p>
      <p className="hazardnow__hint">地図を押している間は塗りを消します。</p>
    </div>
  )
}
