import { useEffect } from 'react'

/**
 * 出来事の演出（FR-03-2・FR-14-8）。
 *
 * ★ 「起きたこと」を画面でも返す。音（FR-02-10）は歩いている間のためのもので、
 * 立ち止まって画面を見ている間は**何も起きていないように見えていた**。
 *
 * ★ 操作を止めない。数秒で自分から消え、下の地図には指が届く
 * （`pointer-events: none`）。閉じる操作を要求すると、歩きながら遊べなくなる
 * （チェックインの演出と同じ約束・NFR-14）。
 *
 * ★ これは「近づくと演出が出る」報酬ではない。出るのは圏内に入った一度だけで、
 * 場所の危険さや近さで変わらない（G-2）。
 */

export type EventFlashKind = 'arrival' | 'area' | 'quiz'

export interface EventFlashItem {
  /** 表示の識別。同じ内容が続けて起きても別物として数える */
  id: number
  kind: EventFlashKind
  title: string
  /** 場所の名前や増えた点数。空なら出さない */
  detail: string
}

/** 出しておく時間。読み終えられる程度に留め、次の知らせを待たせない */
const VISIBLE_MS = 2400

interface EventFlashProps {
  item: EventFlashItem
  onDone: () => void
}

export function EventFlash({ item, onDone }: EventFlashProps): React.JSX.Element {
  /*
   * ★ id を依存に入れる。中身が同じ知らせが続いたときに、タイマーを張り替えないと
   * **2件目が一瞬で消える**（1件目の残り時間で終わる）。
   */
  useEffect(() => {
    const timer = setTimeout(onDone, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [item.id, onDone])

  return (
    <div className={`flash flash--${item.kind}`} role="status" aria-live="polite">
      <p className="flash__title">{item.title}</p>
      {item.detail !== '' && <p className="flash__detail">{item.detail}</p>}
    </div>
  )
}
