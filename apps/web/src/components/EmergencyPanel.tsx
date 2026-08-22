import { formatDistance } from '@imanouchi/core'
import { SPOT_CATEGORY_COLORS, SPOT_CATEGORY_GLYPHS, type SpotId } from '@imanouchi/shared'
import { lifelineGroups } from '../emergency.js'
import type { SpotWithDistance } from '@imanouchi/shared'

interface EmergencyPanelProps {
  spots: SpotWithDistance[]
  selectedSpotId: SpotId | undefined
  onSelectSpot: (spotId: SpotId) => void
  /** バリアフリーの記載があるものだけに絞るか（FR-08-4） */
  accessibleOnly: boolean
  onToggleAccessibleOnly: (next: boolean) => void
  /** 現在地が取れているか。取れていないと距離が出せない */
  hasPosition: boolean
}

/** カテゴリごとに出す件数。多すぎると選べない */
const PER_CATEGORY = 3

/**
 * 有事モードのライフライン一覧（FR-08-3）。
 *
 * ★ 平時の「近くのスポット」と並べ方を変えている。距離順で全体を並べると
 * AED（224 件）が上位を埋めて**避難所が画面から消える**。カテゴリごとに近いものを出す。
 *
 * ★ 操作は平時と同じ。押すと地図のピンと同じ詳細が開く（FR-08-7）。
 * 有事に初出の操作を要求しない。
 */
export function EmergencyPanel({
  spots,
  selectedSpotId,
  onSelectSpot,
  accessibleOnly,
  onToggleAccessibleOnly,
  hasPosition,
}: EmergencyPanelProps): React.JSX.Element {
  const groups = lifelineGroups(spots, { perCategory: PER_CATEGORY, accessibleOnly })
  const hidden = groups.reduce((total, group) => total + group.hiddenByFilter, 0)

  return (
    <section className="lifeline" aria-label="近くのライフライン">
      <h2 className="lifeline__title">近くのライフライン</h2>

      {!hasPosition && (
        <p className="lifeline__warn" role="status">
          現在地が取れていないため、近い順に並べられません。エリア内のスポットを表示しています。
        </p>
      )}

      {/* FR-08-4。★ 絞り込みであって「対応・非対応の判定」ではない */}
      <label className="lifeline__filter">
        <input
          type="checkbox"
          checked={accessibleOnly}
          onChange={(event) => onToggleAccessibleOnly(event.target.checked)}
        />
        バリアフリーの記載があるものだけ
      </label>

      {accessibleOnly && (
        <p className="lifeline__note">
          記載が無いものを{hidden}件隠しています。
          <strong>記載が無いことは「設備が無い」ではありません</strong>（未記入です）。
        </p>
      )}

      {groups.map((group) => (
        <div key={group.category} className="lifeline__group">
          <p className="lifeline__group-title">
            <span
              className="lifeline__glyph"
              style={{ '--marker-color': SPOT_CATEGORY_COLORS[group.category] } as React.CSSProperties}
              aria-hidden="true"
            >
              {SPOT_CATEGORY_GLYPHS[group.category]}
            </span>
            {group.label}
          </p>

          {group.spots.length === 0 ? (
            // ★ 空欄を隠さない。「近くに無い」ことも有事には情報である
            <p className="lifeline__empty">
              {accessibleOnly ? '記載があるものは見つかりません。' : 'この近くにはありません。'}
            </p>
          ) : (
            <ul className="lifeline__list">
              {group.spots.map((spot) => (
                <li key={spot.spotId}>
                  <button
                    type="button"
                    className={
                      spot.spotId === selectedSpotId
                        ? 'lifeline__item lifeline__item--selected'
                        : 'lifeline__item'
                    }
                    onClick={() => onSelectSpot(spot.spotId)}
                  >
                    <span className="lifeline__name">{spot.name}</span>
                    <span className="lifeline__distance">
                      {spot.distanceM === null ? '距離不明' : formatDistance(spot.distanceM)}
                    </span>
                    {spot.attributes.length > 0 && (
                      <span className="lifeline__attributes">{spot.attributes.join('・')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <p className="lifeline__note">
        属性は公開オープンデータの記載です。空欄は「設備が無い」ではなく「未記入」で、
        現地で確かめられる項目です。
      </p>
    </section>
  )
}
