import { useEffect, useRef, useState } from 'react'

interface MapPointsProps {
  /**
   * 累計ポイント（FR-01-3・FR-03-2）。**undefined なら出さない。**
   *
   * ★ `user.totalPoints` を直接読まない。おためしではサーバーが累計を持たず、
   * 端末の中の値を出す必要がある。出どころの違いは親に寄せてある。
   *
   * ★ 有事モードでは親が undefined を渡す（FR-08-2）。ここで `emergency` を
   * 見て分岐すると、隠す判定が画面ごとに散る。
   */
  totalPoints: number | undefined
}

/** 跳ねている時間。CSS のアニメーションと同じ長さにそろえる */
const BUMP_MS = 700

/**
 * 累計ポイント（FR-03-2）。
 *
 * ★ **状態バーから地図の中へ移してある。** 上の帯にハザードの知らせを出すように
 * したため、状態バーに置いたままだと横に並んで押し合う（スマホでは折り返して
 * 状態バーが画面を占める）。地図の左上なら、帯の下に空いた場所がある。
 *
 * ★ 地図の絵の上に重ねるので、**小さく・1行**に留める。ここを大きくすると
 * 以前のハザード表示と同じ問題（キャラクターや地図の文字と重なる）を作る。
 */
export function MapPoints({ totalPoints }: MapPointsProps): React.JSX.Element | null {
  /*
   * 増えた瞬間だけ跳ねさせる（FR-03-2）。
   *
   * ★ 演出は地図の上に数秒で消えるが、累計はここに残る。数字が静かに置き換わる
   * だけだと、**増えたことに気づかない**。減ることは無いので、増えたときだけ動かす。
   *
   * ★ 動きは CSS 側で `prefers-reduced-motion` に従って落とす（NFR-08）。
   * 印を出すこと自体は変えない。
   */
  const [bumped, setBumped] = useState(false)
  const previousRef = useRef(totalPoints)

  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = totalPoints
    if (previous === undefined || totalPoints === undefined || totalPoints <= previous) return

    setBumped(true)
    const timer = setTimeout(() => setBumped(false), BUMP_MS)
    return () => clearTimeout(timer)
  }, [totalPoints])

  // ★ 有事モードでは親が undefined を渡す。枠だけ残さない（FR-08-2）
  if (totalPoints === undefined) return null

  return (
    <p className={bumped ? 'mappoints mappoints--bumped' : 'mappoints'}>
      <span className="mappoints__value">{totalPoints}</span>
      <span className="mappoints__unit">pt</span>
    </p>
  )
}
