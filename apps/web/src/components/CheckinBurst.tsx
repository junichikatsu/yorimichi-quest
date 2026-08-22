import type { CheckinResponse } from '@imanouchi/shared'
import { useEffect } from 'react'

interface CheckinBurstProps {
  result: CheckinResponse
  /** 端末の中だけの記録か（おためし）。隠さずに書く */
  localOnly: boolean
  /**
   * このあとに続くものがあるか（カード・アンケート）。
   *
   * ★ 続くときは短く切り上げる。**待たせたいのではなく、重ねたくないだけ**である
   * （判定は `overlay.ts` の `hasNextAfterBurst`）。
   */
  hasNext: boolean
  onDone: () => void
}

/**
 * 演出を出しておく時間。読み終えられる程度に留め、操作を長く止めない。
 *
 * ★ 後ろに続きがあるときは短くする。順に出す形にしたため、初回訪問では
 * ポイント → 場所カード → アンケートと並び、**足した待ち時間がそのまま
 * アンケートに着くまでの遅れになる。** 重ねないことと、待たせないことは
 * 両立させる必要がある。
 *
 * ★ 短いほうも、入りのアニメーション（0.28秒）と点数を読む時間は残してある。
 * これ以上詰めると「出たことに気づく前に消える」側の失敗になる。
 */
const VISIBLE_MS = 3200
const VISIBLE_MS_WITH_NEXT = 1800

/**
 * チェックインの演出（FR-03-2）。
 *
 * ★ 操作を止めない。地図の上に重ねて数秒で消え、閉じる操作を要求しない。
 * 「演出のためにタップさせる」形にすると、歩きながら遊べなくなる（NFR-14）。
 *
 * ★ 内訳を出す。合計だけだと初回ボーナスに気づかれず、**別の場所へ行く動機に
 * ならない**（同じ場所へ通っても増えないことが伝わらない）。
 */
export function CheckinBurst({
  result,
  localOnly,
  hasNext,
  onDone,
}: CheckinBurstProps): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDone, hasNext ? VISIBLE_MS_WITH_NEXT : VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [onDone, result, hasNext])

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
