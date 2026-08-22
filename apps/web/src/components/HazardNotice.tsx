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
  /**
   * 押されて消したとき。
   *
   * ★ 出すかどうかの判定は親が持つ（`isHazardNoticeVisible`）。ここで「消した」を
   * 抱えると、**消したまま歩いても出し直せない**（どこで消したかを知らないため）。
   */
  onDismiss: () => void
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
 * ★ **状態バーへ重ね、一番上に出す。** 地図の中に置くとキャラクターや地図の文字と
 * 重なって読めず、状態バーの下に別の帯として置くと区域に入るたびに画面がもう一段
 * 狭くなる（湾岸は広範囲が想定区域なので、ほぼ常時狭くなる）。
 *
 * ★ **押せば消える。** 一番上に出す以上、下にあるもの（キャラメイクを開く操作・
 * 位置情報の表示・有事モードの切替）を覆う。覆ったまま消せないと操作を奪うので、
 * 消す口が必ず要る。帯のどこを押しても消える。
 *
 * ★ 消しても**永久には黙らない**（判定は `isHazardNoticeVisible`）。別の区域へ
 * 入ったとき、深さの区分が変わったとき、100m 歩いたときに出し直す。危ない場所に
 * 居ることの知らせであり、一度消したら二度と出ないのは安全側ではない。
 *
 * ★ 1行に収める。重ねる先は状態バー1行ぶんの高さしかない。内訳は折り返さずに
 * 切り詰める（折り返すと状態バーが伸びて地図が跳ねる）。
 *
 * ★ 二段で見せる。**入った瞬間**は「入りました」、しばらくして**居るあいだ**の
 * 「区域の中」へ切り替える。同じ文言のままだと、いつ入ったのか分からなくなる。
 *
 * ★ 断定しない。判定はタイルの画素で、境界は数十mずれる。
 *
 * ★ **`想定` の印は必ず出す。** これが無いと、いま水が来ていることを示す画面に
 * 読める（FR-08-9 と同じ作法）。1行に収めるため断り書きの文は置けないので、
 * 印だけは落とさない。詳しい断り書きは歩行中のまとめ（`WalkGuard`）にあり、
 * 出典は画面下の出典表示（`HAZARD_CREDITS`）にある。
 *
 * ★ 危ないと知らせるだけで、点数は動かさない（G-2・FR-14-10）。
 */
export function HazardNotice({
  here,
  withCharacter,
  onDismiss,
}: HazardNoticeProps): React.JSX.Element | null {
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

  const title = entered ? HAZARD_ENTERED_TITLE : HAZARD_INSIDE_TITLE
  const detail = withCharacter ? `${parts}／足元が濡れています` : parts

  return (
    <div
      className={entered ? 'hazardnow hazardnow--entered' : 'hazardnow'}
      /*
       * ★ 読み上げは**この入れ物**に持たせる。押す口（下のボタン）に持たせると、
       * ボタンであることが読まれず「押して消せる」ことが伝わらない。
       */
      role="status"
      aria-live="polite"
    >
      {/* ★ 「想定」の印。実況として読まれてはいけないので、短い表示でも落とさない */}
      <span className="hazardnow__badge">想定</span>
      <span className="hazardnow__title">{title}</span>
      {/*
        ★ 内訳は幅が足りなければ切り詰める（`text-overflow`）。折り返させると
        状態バーの高さが変わり、地図が動く。**知らせのために画面が跳ねてはいけない。**
      */}
      <span className="hazardnow__parts">{detail}</span>

      {/*
        ★ 押す口は帯いっぱいに広げる（CSS で `inset: 0`）。× だけを的にすると、
        歩きながら片手で押すには小さすぎる。

        ★ 読み上げ用の名前には**状態も入れる。** 「閉じる」だけでは、何を閉じるのか
        分からない。
      */}
      <button
        type="button"
        className="hazardnow__dismiss"
        aria-label={`${title}（${detail}）の知らせを閉じる`}
        onClick={onDismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
