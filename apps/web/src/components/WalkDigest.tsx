import type { SpotId } from '@imanouchi/shared'
import type { WalkLog } from '../walk-log.js'

interface WalkDigestProps {
  log: WalkLog
  /** 着いた場所を開く。押したら閉じる（そのままスポット詳細へ渡す） */
  onSelectSpot: (spotId: SpotId) => void
  onClose: () => void
}

/**
 * 覆いが外れたときのまとめ（FR-02-9・FR-02-10）。
 *
 * ★ 歩いている間は画面を覆っているので、その間の出来事は**音だけで流れていく**。
 * 音は聞き逃す（車の音・イヤホン無し・鞄の中）。立ち止まって画面を開いた人に、
 * 見ていなかった間に何があったかをここで渡す。
 *
 * ★ 自動で消さない。数秒で消える演出（`EventFlash`）と役割が違う。
 * **見ていなかった人に向けた控え**なので、読む前に消えてはいけない。
 *
 * ★ 「着いた場所」は押せるようにする。立ち止まって開いた直後なので、
 * ここから記録するのは歩きスマホにならない（止まっている前提の導線である）。
 */
export function WalkDigest({ log, onSelectSpot, onClose }: WalkDigestProps): React.JSX.Element {
  const arrivals = log.events.filter((event) => event.kind === 'arrival')
  const areas = log.events.filter((event) => event.kind === 'area')

  return (
    <section className="walkdigest" role="status" aria-label="歩いている間の記録">
      <div className="walkdigest__head">
        <p className="walkdigest__title">歩いている間にありました</p>
        <button
          type="button"
          className="button button--ghost walkdigest__close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
      </div>

      {arrivals.length > 0 && (
        <div className="walkdigest__group">
          <p className="walkdigest__group-title">チェックインできる場所に着きました</p>
          <ul className="walkdigest__list">
            {arrivals.map((event) => (
              <li key={`arrival-${event.key}`}>
                <button
                  type="button"
                  className="walkdigest__spot"
                  onClick={() => {
                    if (event.spotId) onSelectSpot(event.spotId)
                  }}
                >
                  {event.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {areas.length > 0 && (
        <div className="walkdigest__group">
          <p className="walkdigest__group-title">歩ききった町丁目</p>
          <ul className="walkdigest__list walkdigest__list--plain">
            {areas.map((event) => (
              <li key={`area-${event.key}`}>{event.name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ★ 上限で落としたぶんも書く。黙って減らすと「これだけしか無かった」と読める */}
      {log.dropped > 0 && (
        <p className="walkdigest__note">ほかに {log.dropped} 件ありました（表示は最新の分だけです）。</p>
      )}
    </section>
  )
}
