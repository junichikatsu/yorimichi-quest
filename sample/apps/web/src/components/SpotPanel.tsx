import { formatDistance } from '@yorimichi-sample/core'
import { SPOT_CATEGORY_LABELS, type SpotWithDistance } from '@yorimichi-sample/shared'
import type { Position } from '../hooks/useGeolocation.js'

interface SpotPanelProps {
  spot: SpotWithDistance
  checkinRadiusM: number
  position: Position | undefined
  busy: boolean
  onCheckin: () => void
  onSimulateHere: () => void
  onClose: () => void
}

export function SpotPanel({
  spot,
  checkinRadiusM,
  position,
  busy,
  onCheckin,
  onSimulateHere,
  onClose,
}: SpotPanelProps): React.JSX.Element {
  const distance = spot.distanceM
  const inRange = distance !== null && distance <= checkinRadiusM

  return (
    <section className="panel" aria-label="スポット詳細">
      <div className="panel__head">
        <div>
          <p className="panel__category">{SPOT_CATEGORY_LABELS[spot.category]}</p>
          <h2 className="panel__title">{spot.name}</h2>
        </div>
        <button type="button" className="button button--ghost" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      <p className="panel__address">{spot.address}</p>

      {spot.attributes.length > 0 && (
        <ul className="tags">
          {spot.attributes.map((attribute) => (
            <li className="tag" key={attribute}>
              {attribute}
            </li>
          ))}
        </ul>
      )}

      <dl className="stats">
        <div>
          <dt>現在地から</dt>
          <dd>{distance === null ? '位置情報なし' : formatDistance(distance)}</dd>
        </div>
        <div>
          <dt>チェックイン数</dt>
          <dd>{spot.checkinCount}</dd>
        </div>
        <div>
          <dt>ポイント倍率</dt>
          <dd>{spot.unexplored ? `×${spot.pointMultiplier}（未開拓）` : '×1'}</dd>
        </div>
      </dl>

      <button type="button" className="button button--primary" disabled={!inRange || busy} onClick={onCheckin}>
        {busy ? 'チェックイン中…' : inRange ? 'チェックインする' : `半径${checkinRadiusM}m以内で可能`}
      </button>

      {!inRange && (
        <button type="button" className="button button--subtle" onClick={onSimulateHere}>
          デモ用：現在地をこの場所に設定する
        </button>
      )}

      <p className="panel__note">
        出典: {spot.source}（{spot.fetchedAt}）
        {position === undefined && ' ／ 位置情報を許可すると距離が表示されます'}
      </p>
    </section>
  )
}
