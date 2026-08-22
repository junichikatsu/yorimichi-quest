import type { CheckinResponse } from '@imanouchi/shared'
import { useEffect } from 'react'

interface CheckinBurstProps {
  result: CheckinResponse
  /** 端末の中だけの記録か（おためし）。隠さずに書く */
  localOnly: boolean
  onDone: () => void
}

/** 演出を出しておく時間。読み終えられる程度に留め、操作を長く止めない */
const VISIBLE_MS = 3200

/**
 * チェックインの演出（FR-03-2）。
 *
 * ★ 操作を止めない。地図の上に重ねて数秒で消え、閉じる操作を要求しない。
 * 「演出のためにタップさせる」形にすると、歩きながら遊べなくなる（NFR-14）。
 *
 * ★ 内訳を出す。合計だけだと初回ボーナスに気づかれず、**別の場所へ行く動機に
 * ならない**（同じ場所へ通っても増えないことが伝わらない）。
 */
export function CheckinBurst({ result, localOnly, onDone }: CheckinBurstProps): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDone, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [onDone, result])

  return (
    <div className="burst" role="status" aria-live="polite">
      <p className="burst__points">+{result.pointsEarned}pt</p>
      <p className="burst__spot">{result.spot.name}</p>
      <p className="burst__breakdown">
        基礎 {result.breakdown.base}pt
        {result.breakdown.firstVisitBonus > 0 && (
          <span className="burst__bonus"> ＋ はじめての場所 {result.breakdown.firstVisitBonus}pt</span>
        )}
      </p>
      {localOnly ? (
        <p className="burst__note">この端末の中だけに記録しました（おためし）</p>
      ) : (
        <p className="burst__note">累計 {result.totalPoints}pt</p>
      )}
    </div>
  )
}
