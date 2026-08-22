import { useEffect, useState } from 'react'
import {
  HAZARD_ENTERED_TITLE,
  HAZARD_INSIDE_TITLE,
  hazardParts,
  type HazardHere,
} from '../hazard.js'

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
 * 「入りました」を出しておく時間（ミリ秒）。
 *
 * ★ 過ぎたら短い表示へ切り替える。区域は湾岸で広く、**入った文言のまま居続けると
 * 大きな帯が画面の上に貼りついたままになる**（地図が読めなくなる）。
 */
const ENTERED_MS = 4000

/**
 * いまいる場所のハザード（#72）。
 *
 * ★ **地図の中に置かない。** 以前は地図の左上に箱で出していたため、スマホでは
 * キャラクターや地図の文字と重なって読めなかった。上の帯として出し、地図の絵の
 * 上に情報を積み上げない。
 *
 * ★ 二段で見せる。**入った瞬間**は「入りました」と断り書きを出し、しばらくして
 * **居るあいだの短い表示**へ切り替える。同じ強さで出し続けると、広い区域では
 * 帯が貼りついたままになる。
 *
 * ★ 絵だけにしない。**文字でも出す**（NFR-08）。色や見た目だけに意味を持たせると、
 * 小さい画面や色覚によっては伝わらない。
 *
 * ★ 断定しない。判定はタイルの画素で、境界は数十mずれる。
 *
 * ★ **想定であることは常に添える**（短い表示でも「想定」の印を落とさない）。
 * いま水が来ていることを示すものではない。防災アプリが災害の発生を思わせる画面を
 * 出すことはそれ自体が危険である（FR-08-9 と同じ作法）。出典は画面下の出典表示
 * （`HAZARD_CREDITS`）にある。
 *
 * ★ 危ないと知らせるだけで、点数は動かさない（G-2・FR-14-10）。
 * 「濡れると何かが得られる」形にしてはいけない。
 */
export function HazardNotice({ here, withCharacter }: HazardNoticeProps): React.JSX.Element | null {
  const parts = hazardParts(here)

  /*
   * ★ 区域が変わったら「入りました」からやり直す。深さの区分が変わったときも
   * 知らせ直したいので、内訳そのものを見ている（`here` の参照では毎回変わる）。
   *
   * ★ フックは早期 return より前に置く。条件付きで呼ぶとフックの数が変わって落ちる。
   */
  const [entered, setEntered] = useState(true)
  useEffect(() => {
    if (parts === '') return
    setEntered(true)
    const timer = setTimeout(() => setEntered(false), ENTERED_MS)
    return () => clearTimeout(timer)
  }, [parts])

  if (here.length === 0) return null

  return (
    <div
      className={entered ? 'hazardnow hazardnow--entered' : 'hazardnow'}
      role="status"
      aria-live="polite"
    >
      <p className="hazardnow__line">
        {/* ★ 「想定」の印は短い表示でも落とさない。実況として読まれてはいけない */}
        <span className="hazardnow__badge">想定</span>
        <span className="hazardnow__title">
          {entered ? HAZARD_ENTERED_TITLE : HAZARD_INSIDE_TITLE}
        </span>
        <span className="hazardnow__parts">{parts}</span>
      </p>

      {/*
        ★ 断り書きは入った瞬間だけ出す。読ませたいのはそのときで、居るあいだ出し
        続けると帯が高いままになる。「想定」の印は上の行に残っている。
      */}
      {entered && (
        <p className="hazardnow__note">
          いま水が来ていることを示すものではありません。
          {withCharacter && 'キャラクターの足元が濡れています。'}
        </p>
      )}
    </div>
  )
}
