import { formatDistance } from '@imanouchi/core'
import {
  SPOT_CATEGORY_GLYPHS,
  SPOT_CATEGORY_LABELS,
  type SpotId,
  type SpotWithDistance,
} from '@imanouchi/shared'

interface SpotListProps {
  spots: SpotWithDistance[]
  selectedSpotId: SpotId | undefined
  onSelectSpot: (spotId: SpotId) => void
}

/**
 * スポット一覧。
 *
 * 地図が使えないとき（トークン未設定・地図の読み込み失敗）の代替でもあり、
 * 地図と併用する一覧でもある。**地図が出ないと何も分からない状態にしない。**
 */
export function SpotList({ spots, selectedSpotId, onSelectSpot }: SpotListProps): React.JSX.Element {
  if (spots.length === 0) {
    return <p className="panel__note">この範囲にスポットがありません。</p>
  }

  return (
    <ul className="spotlist">
      {spots.map((spot) => (
        <li key={spot.spotId}>
          <button
            type="button"
            className={`spotlist__item${spot.spotId === selectedSpotId ? ' spotlist__item--on' : ''}`}
            onClick={() => onSelectSpot(spot.spotId)}
          >
            <span className={`spotlist__glyph spotlist__glyph--${spot.category}`} aria-hidden="true">
              {SPOT_CATEGORY_GLYPHS[spot.category]}
            </span>
            <span className="spotlist__body">
              <span className="spotlist__name">{spot.name}</span>
              <span className="spotlist__meta">
                {SPOT_CATEGORY_LABELS[spot.category]}
                {spot.distanceM !== null && ` ・ ${formatDistance(spot.distanceM)}`}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
