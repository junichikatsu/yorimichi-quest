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
import { useEffect, useRef, useState } from 'react'
import { CardArt } from './CardArt.js'

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
 * 「**まだ自分のものになっていない**」として、裏向きのカードとして見せる。
 *
 * 中身（`body`）は達成後にだけサーバーから届く。未達成では undefined なので、
 * ここで隠す処理は要らない（そもそも手元に無い）。
 */
export function CardPanel({ cards, busy, onEquip }: CardPanelProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')

  /**
   * 直前に達成済みだったカード。
   *
   * 差分を見て「今回はじめて達成したカード」だけに返る演出を付ける（FR-14-8）。
   * これをやらないと、画面を開くたびに全部のカードが返ってしまう。
   */
  const seenRef = useRef<Set<string> | undefined>(undefined)
  const [flipping, setFlipping] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!cards) return

    const achieved = new Set(cards.cards.filter((card) => card.achieved).map((c) => c.cardId))
    const previous = seenRef.current

    // 初回はすべて既知として扱う（開いた瞬間に全部返らないようにする）
    if (previous === undefined) {
      seenRef.current = achieved
      return
    }

    const fresh = [...achieved].filter((id) => !previous.has(id))
    seenRef.current = achieved
    if (fresh.length === 0) return

    setFlipping(new Set(fresh))
    const timer = setTimeout(() => setFlipping(new Set()), 900)
    return () => clearTimeout(timer)
  }, [cards])

  if (!cards) {
    return (
      <section className="panel" aria-label="カード">
        <h2 className="panel__title">カード</h2>
        <p className="panel__note">読み込み中…</p>
      </section>
    )
  }

  const visible = filter === 'all' ? cards.cards : cards.cards.filter((card) => card.kind === filter)

  const toolKeyOf = (card: CardView): string | undefined => {
    const parsed = parseCardId(card.cardId)
    if (!parsed || parsed.kind !== 'tool' || !isItemKey(parsed.key)) return undefined
    return parsed.key
  }

  /** 道具カードは装備できる。カード一覧から直接切り替えられるようにする */
  const toggleEquip = (card: CardView): void => {
    const key = toolKeyOf(card)
    if (key === undefined || !isItemKey(key)) return

    const slot = ITEM_DEFS[key].slot
    onEquip({
      ...cards.equipment,
      [slot]: cards.equipment[slot] === key ? null : key,
    })
  }

  const isEquipped = (card: CardView): boolean => {
    const key = toolKeyOf(card)
    if (key === undefined || !isItemKey(key)) return false
    return cards.equipment[ITEM_DEFS[key].slot] === key
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
              className={`cardfilter__button cardfilter__button--${kind}${
                filter === kind ? ' cardfilter__button--on' : ''
              }`}
              onClick={() => setFilter(kind)}
            >
              {CARD_KIND_LABELS[kind]} {progress.achieved}/{progress.total}
            </button>
          )
        })}
      </div>

      <ul className="cards">
        {visible.map((card) => (
          <li key={card.cardId} className="cards__slot">
            <article
              className={[
                'card',
                `card--${card.kind}`,
                card.achieved ? 'card--achieved' : 'card--pending',
                isEquipped(card) ? 'card--equipped' : '',
                flipping.has(card.cardId) ? 'card--flip' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <header className="card__top">
                <span className="card__kind">{CARD_KIND_LABELS[card.kind]}</span>
                {card.achieved ? (
                  <span className="card__seal" aria-label="達成">
                    ✓
                  </span>
                ) : (
                  <span className="card__state">未達成</span>
                )}
              </header>

              <div className="card__art">
                <CardArt card={card} />
              </div>

              <div className="card__text">
                <p className="card__title">{card.title}</p>
                {card.achieved ? (
                  <p className="card__body">{card.body}</p>
                ) : (
                  <p className="card__condition">{card.condition}</p>
                )}
              </div>

              {card.achieved && card.kind === 'tool' && (
                <footer className="card__foot">
                  <button
                    type="button"
                    className="card__equip"
                    disabled={busy}
                    onClick={() => toggleEquip(card)}
                  >
                    {isEquipped(card) ? 'はずす' : 'そうびする'}
                  </button>
                </footer>
              )}
            </article>
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
