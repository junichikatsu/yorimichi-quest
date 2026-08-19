import {
  ITEM_SLOTS,
  ITEM_SLOT_LABELS,
  type Equipment,
  type ItemKey,
  type ItemsResponse,
} from '@map-checkin/shared'

interface ItemPanelProps {
  items: ItemsResponse | undefined
  busy: boolean
  onEquip: (equipment: Equipment) => void
}

/**
 * 防災リュック（アイテムコレクション / FR-07-8）。
 *
 * 未取得のアイテムも並べて「あと何が残っているか」を見せる。
 * どこで手に入るかを書いておかないと、集める行動につながらない。
 */
export function ItemPanel({ items, busy, onEquip }: ItemPanelProps): React.JSX.Element {
  if (!items) {
    return (
      <section className="panel" aria-label="防災リュック">
        <h2 className="panel__title">防災リュック</h2>
        <p className="panel__note">読み込み中…</p>
      </section>
    )
  }

  const ownedKeys = new Set(items.owned.map((item) => item.itemKey))
  const countOf = (key: ItemKey): number =>
    items.owned.find((item) => item.itemKey === key)?.count ?? 0

  const toggle = (key: ItemKey): void => {
    const slot = items.catalog.find((def) => def.itemKey === key)?.slot
    if (!slot) return
    const next: Equipment = {
      ...items.equipment,
      [slot]: items.equipment[slot] === key ? null : key,
    }
    onEquip(next)
  }

  return (
    <section className="panel" aria-label="防災リュック">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">防災リュック</h2>
          <p className="panel__category">
            {ownedKeys.size} / {items.catalog.length} 種類
          </p>
        </div>
      </div>

      <dl className="equip">
        {ITEM_SLOTS.map((slot) => {
          const equipped = items.equipment[slot]
          const def = equipped ? items.catalog.find((item) => item.itemKey === equipped) : undefined
          return (
            <div key={slot}>
              <dt>{ITEM_SLOT_LABELS[slot]}</dt>
              <dd>{def?.name ?? '—'}</dd>
            </div>
          )
        })}
      </dl>

      <ul className="items">
        {items.catalog.map((def) => {
          const owned = ownedKeys.has(def.itemKey)
          const equipped = items.equipment[def.slot] === def.itemKey
          const count = countOf(def.itemKey)

          return (
            <li
              key={def.itemKey}
              className={`item${owned ? '' : ' item--locked'}${equipped ? ' item--equipped' : ''}`}
            >
              <div className="item__head">
                <span className="item__name">{owned ? def.name : '???'}</span>
                <span className="item__slot">{ITEM_SLOT_LABELS[def.slot]}</span>
              </div>

              {owned ? (
                <>
                  <p className="item__use">{def.use}</p>
                  <div className="item__foot">
                    {count > 1 && <span className="item__count">×{count}</span>}
                    <button
                      type="button"
                      className="button button--subtle"
                      disabled={busy}
                      onClick={() => toggle(def.itemKey)}
                    >
                      {equipped ? 'はずす' : 'そうびする'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="item__use item__use--locked">{hintFor(def.fromCategory)}</p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="panel__note">
        装備すると地図上のキャラクターの見た目に反映されます。
      </p>
    </section>
  )
}

/** 未取得アイテムの入手方法。答えを言わず、どこへ行けばよいかだけ示す */
function hintFor(category: string | null): string {
  switch (category) {
    case 'shelter':
      return '避難所でチェックインすると手に入る'
    case 'aed':
      return 'AEDのあるスポットでチェックインすると手に入る'
    case 'accessible_toilet':
      return 'バリアフリートイレでチェックインすると手に入る'
    case 'water':
      return '給水スポットでチェックインすると手に入る'
    default:
      return '現地のクイズに正解すると手に入る'
  }
}
