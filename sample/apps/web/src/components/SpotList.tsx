import { formatDistance } from '@yorimichi-sample/core'
import { SPOT_CATEGORY_LABELS, type SpotWithDistance } from '@yorimichi-sample/shared'

interface SpotListProps {
  spots: SpotWithDistance[]
  selectedSpotId: string | undefined
  onSelectSpot: (spotId: string) => void
}

/** 地図が使えないとき（Mapbox トークン未設定・MOCK_MODE）のフォールバック表示 */
export function SpotList({ spots, selectedSpotId, onSelectSpot }: SpotListProps): React.JSX.Element {
  return (
    <ul className="spot-list" aria-label="スポット一覧">
      {spots.map((spot) => (
        <li key={spot.spotId}>
          <button
            type="button"
            className={`spot-list__item${spot.spotId === selectedSpotId ? ' is-selected' : ''}`}
            onClick={() => onSelectSpot(spot.spotId)}
          >
            <span className={`chip chip--${spot.category}`}>
              {SPOT_CATEGORY_LABELS[spot.category]}
            </span>
            <span className="spot-list__name">{spot.name}</span>
            <span className="spot-list__meta">
              {spot.distanceM === null ? '—' : formatDistance(spot.distanceM)}
              {spot.unexplored ? ` ／ ×${spot.pointMultiplier}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
