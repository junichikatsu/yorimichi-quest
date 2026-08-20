import { formatDistance } from '@imanouchi/core'
import { SPOT_CATEGORY_LABELS, type SpotWithDistance } from '@imanouchi/shared'

interface SpotPanelProps {
  spot: SpotWithDistance
  onClose: () => void
}

/**
 * スポット詳細（FR-02-2）。
 *
 * ★ 属性が空のときに「設備なし」とは書かない。オープンデータの空欄は
 * 「設備が無い」ではなく「未記入」であり、そこがこのサービスで埋める対象である（FR-12）。
 * 断定すると、無いはずのものを無いと言い切ったことになる。
 */
export function SpotPanel({ spot, onClose }: SpotPanelProps): React.JSX.Element {
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

      {spot.address !== '' && <p className="panel__address">{spot.address}</p>}

      {spot.distanceM !== null && (
        <p className="panel__distance">現在地から {formatDistance(spot.distanceM)}</p>
      )}

      {spot.attributes.length > 0 ? (
        <ul className="tags">
          {spot.attributes.map((attribute) => (
            <li key={attribute} className="tags__item">
              {attribute}
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel__note">
          設備の情報が公開データに記載されていません。現地で確かめられる項目です。
        </p>
      )}

      {spot.source !== '' && (
        <p className="panel__source">
          出典 {spot.source}
          {spot.fetchedAt !== '' && `（取得 ${spot.fetchedAt}）`}
        </p>
      )}
    </section>
  )
}
