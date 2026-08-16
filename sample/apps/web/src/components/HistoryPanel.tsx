import type { MeResponse } from '@yorimichi-sample/shared'

interface HistoryPanelProps {
  me: MeResponse | undefined
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function HistoryPanel({ me }: HistoryPanelProps): React.JSX.Element {
  const checkins = me?.recentCheckins ?? []

  return (
    <section className="history" aria-label="チェックイン履歴">
      <h2 className="history__title">チェックイン履歴</h2>
      {checkins.length === 0 ? (
        <p className="history__empty">まだチェックインがありません。地図のピンから始めましょう。</p>
      ) : (
        <ul className="history__list">
          {checkins.map((checkin) => (
            <li key={`${checkin.spotId}-${checkin.checkinAt}`} className="history__item">
              <span className="history__name">{checkin.spotName}</span>
              <span className="history__points">+{checkin.pointsEarned}pt</span>
              <span className="history__time">{formatTime(checkin.checkinAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
