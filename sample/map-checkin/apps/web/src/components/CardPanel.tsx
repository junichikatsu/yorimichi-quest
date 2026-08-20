import {
  CARD_KIND_LABELS,
  CARD_KIND_ORDER,
  ITEM_DEFS,
  ITEM_SLOTS,
  ITEM_SLOT_LABELS,
  isItemKey,
  parseCardId,
  type CardKind,
  type CardsResponse,
  type CardView,
  type Equipment,
} from '@map-checkin/shared'
import { useState } from 'react'

interface CardPanelProps {
  cards: CardsResponse | undefined
  busy: boolean
  onEquip: (equipment: Equipment) => void
}

type Filter = CardKind | 'all'

/**
 * カード一覧（FR-14）。
 *
 * 未達成のカードも枠として並べる。「持っていない」ではなく
 * 「**まだ自分のものになっていない**」として見せ、何が残っているかを常に見せる。
 *
 * 中身（`body`）は達成後にだけサーバーから届く。未達成では undefined なので、
 * ここで隠す処理は要らない（そもそも手元に無い）。
 */
export function CardPanel({ cards, busy, onEquip }: CardPanelProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')

  if (!cards) {
    return (
      <section className="panel" aria-label="カード">
        <h2 className="panel__title">カード</h2>
        <p className="panel__note">読み込み中…</p>
      </section>
    )
  }

  const visible = filter === 'all' ? cards.cards : cards.cards.filter((card) => card.kind === filter)

  /** 道具カードは装備できる。カード一覧から直接切り替えられるようにする */
  const toggleEquip = (card: CardView): void => {
    const parsed = parseCardId(card.cardId)
    if (!parsed || parsed.kind !== 'tool' || !isItemKey(parsed.key)) return

    const slot = ITEM_DEFS[parsed.key].slot
    onEquip({
      ...cards.equipment,
      [slot]: cards.equipment[slot] === parsed.key ? null : parsed.key,
    })
  }

  const isEquipped = (card: CardView): boolean => {
    const parsed = parseCardId(card.cardId)
    if (!parsed || parsed.kind !== 'tool' || !isItemKey(parsed.key)) return false
    return cards.equipment[ITEM_DEFS[parsed.key].slot] === parsed.key
  }

  return (
    <section className="panel" aria-label="カード">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">カード</h2>
          <p className="panel__category">
            {cards.summary.achieved} / {cards.summary.total} 枚
          </p>
        </div>
      </div>

      <div className="cardfilter" role="group" aria-label="カードの種類でしぼる">
        <button
          type="button"
          className={`cardfilter__button${filter === 'all' ? ' cardfilter__button--on' : ''}`}
          onClick={() => setFilter('all')}
        >
          すべて
        </button>
        {CARD_KIND_ORDER.map((kind) => {
          const progress = cards.summary.byKind[kind]
          return (
            <button
              key={kind}
              type="button"
              className={`cardfilter__button${filter === kind ? ' cardfilter__button--on' : ''}`}
              onClick={() => setFilter(kind)}
            >
              {CARD_KIND_LABELS[kind]} {progress.achieved}/{progress.total}
            </button>
          )
        })}
      </div>

      <ul className="cards">
        {visible.map((card) => (
          <li
            key={card.cardId}
            className={`card card--${card.kind}${card.achieved ? '' : ' card--pending'}${
              isEquipped(card) ? ' card--equipped' : ''
            }`}
          >
            <div className="card__head">
              <span className="card__kind">{CARD_KIND_LABELS[card.kind]}</span>
              {card.achieved ? (
                <span className="card__state card__state--achieved">達成</span>
              ) : (
                <span className="card__state">仮に所持</span>
              )}
            </div>

            <p className="card__title">{card.title}</p>

            {card.achieved ? (
              <>
                {/* 達成後にだけ届く中身 */}
                <p className="card__body">{card.body}</p>
                {card.kind === 'tool' && (
                  <div className="card__foot">
                    <button
                      type="button"
                      className="button button--subtle"
                      disabled={busy}
                      onClick={() => toggleEquip(card)}
                    >
                      {isEquipped(card) ? 'はずす' : 'そうびする'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="card__condition">{card.condition}</p>
            )}
          </li>
        ))}
      </ul>

      <dl className="equip">
        {ITEM_SLOTS.map((slot) => {
          const equipped = cards.equipment[slot]
          return (
            <div key={slot}>
              <dt>{ITEM_SLOT_LABELS[slot]}</dt>
              <dd>{equipped ? ITEM_DEFS[equipped].name : '—'}</dd>
            </div>
          )
        })}
      </dl>

      <p className="panel__note">
        道具カードを装備すると、地図上のキャラクターの見た目に反映されます。
      </p>
    </section>
  )
}
