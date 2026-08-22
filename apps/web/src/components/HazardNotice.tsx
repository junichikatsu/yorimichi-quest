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
 * 「入りました」がいつまでも出ていることになる**（いつ入ったのか分からなくなる）。
 */
const ENTERED_MS = 4000

/**
 * いまいる場所のハザード（#72）。
 *
 * ★ **状態バーへ重ねて出す。** 地図の中に置くと、スマホではキャラクターや地図の
 * 文字と重なって読めない（実際にそうなった）。状態バーの下に別の帯として置くと、
 * 区域に入るたびに画面がもう一段狭くなる（湾岸は広範囲が想定区域なので、ほぼ常時
 * 狭くなる）。**行を増やさず、タイトルの場所を借りる。**
 *
 * ★ そのため**1行に収める。** 重ねる先は状態バー1行ぶんの高さしかない。
 * 長い断り書きは置けないので、`想定` の印を必ず添える形にしている（下記）。
 *
 * ★ 二段で見せる。**入った瞬間**は「入りました」、しばらくして**居るあいだ**の
 * 「区域の中」へ切り替える。同じ文言のままだと、いつ入ったのか分からなくなる。
 *
 * ★ 絵だけにしない。**文字でも出す**（NFR-08）。色や見た目だけに意味を持たせると、
 * 小さい画面や色覚によっては伝わらない。
 *
 * ★ 断定しない。判定はタイルの画素で、境界は数十mずれる。
 *
 * ★ **`想定` の印は必ず出す。** これが無いと、いま水が来ていることを示す画面に
 * 読める。防災アプリが災害の発生を思わせる画面を出すことはそれ自体が危険である
 * （FR-08-9 と同じ作法）。1行に収めるため断り書きの文は置けないので、
 * **印だけは落とさない。** 詳しい断り書きは歩行中のまとめ（`WalkGuard`）にあり、
 * 出典は画面下の出典表示（`HAZARD_CREDITS`）にある。
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
      {/* ★ 「想定」の印。実況として読まれてはいけないので、短い表示でも落とさない */}
      <span className="hazardnow__badge">想定</span>
      <span className="hazardnow__title">
        {entered ? HAZARD_ENTERED_TITLE : HAZARD_INSIDE_TITLE}
      </span>
      {/*
        ★ 内訳は幅が足りなければ切り詰める（`text-overflow`）。折り返させると
        状態バーの高さが変わり、地図が動く。**知らせのために画面が跳ねてはいけない。**
        読み上げでは切り詰められないので、全文が読まれる。
      */}
      <span className="hazardnow__parts">
        {parts}
        {withCharacter && '／足元が濡れています'}
      </span>
    </div>
  )
}
