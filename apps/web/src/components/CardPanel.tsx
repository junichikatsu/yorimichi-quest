import {
  CARD_KIND_LABELS,
  CARD_KIND_ORDER,
  type CardKind,
  type CardsResponse,
} from '@imanouchi/shared'
import { useState } from 'react'
import { CardArt, cardColorStyle } from './CardArt.js'
import { Spinner } from './Spinner.js'

interface CardPanelProps {
  cards: CardsResponse | undefined
  onClose: () => void
}

type Filter = CardKind | 'all'

/**
 * カードコレクション（FR-14-1）。
 *
 * ★ 未達成は「持っていない」ではなく「**まだ自分のものになっていない**」として見せる。
 * 枠は最初から並んでおり、何が残っているかが常に見えている状態にする。
 *
 * ★ 場所カードは**達成した分だけ**並べ、残りはカテゴリ別の件数で示す。
 * 対象エリアには 371 件あり、未達成をすべて並べると一覧が使えない。
 */
export function CardPanel({ cards, onClose }: CardPanelProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')

  if (!cards) {
    return (
      <section className="panel" aria-label="カード">
        <div className="panel__head">
          <h2 className="panel__title">カード</h2>
          <button type="button" className="button button--ghost" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <p className="panel__note panel__note--loading">
          <Spinner small />
          読み込んでいます…
        </p>
      </section>
    )
  }

  const shown = filter === 'all' ? cards.cards : cards.cards.filter((card) => card.kind === filter)

  return (
    <section className="panel panel--cards" aria-label="カード">
      <div className="panel__head">
        <div>
          <p className="panel__category">
            集めたカード {cards.summary.achieved} / {cards.summary.total}
          </p>
          <h2 className="panel__title">カード</h2>
        </div>
        <button type="button" className="button button--ghost" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      {/* 種類での絞り込み（FR-14-1）。行動が先頭に並ぶ（G-8） */}
      <div className="cardfilter" role="group" aria-label="種類でしぼる">
        <button
          type="button"
          className={filter === 'all' ? 'cardfilter__item cardfilter__item--on' : 'cardfilter__item'}
          onClick={() => setFilter('all')}
        >
          すべて
        </button>
        {CARD_KIND_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            className={
              filter === kind ? 'cardfilter__item cardfilter__item--on' : 'cardfilter__item'
            }
            onClick={() => setFilter(kind)}
          >
            {CARD_KIND_LABELS[kind]}
            <span className="cardfilter__count">
              {cards.summary.byKind[kind].achieved}/{cards.summary.byKind[kind].total}
            </span>
          </button>
        ))}
      </div>

      {/*
        場所カードの残り。
        ★ 371枚を並べる代わりにここで件数を示す。「何が残っているか」は件数で分かる。
      */}
      {(filter === 'all' || filter === 'place') && (
        <ul className="placecount">
          {cards.places.map((place) => (
            <li key={place.category} className="placecount__item">
              <span className="placecount__label">{place.label}</span>
              <span className="placecount__value">
                {place.achieved}
                <span className="placecount__total">/{place.total}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ul className="cardgrid">
        {shown.map((card) => (
          <li key={card.cardId}>
            <article
              className={`card card--${card.kind}${card.achieved ? ' card--achieved' : ''}`}
              style={cardColorStyle(card)}
            >
              <CardArt card={card} />
              <p className="card__kind">
                {CARD_KIND_LABELS[card.kind]}
                {/* ★ ミッションは進捗を数字で出す（絵は旗なので、絵からは進みが分からない） */}
                {card.progress && (
                  <span className="card__progress">
                    {' '}
                    {card.progress.current}/{card.progress.total}
                  </span>
                )}
              </p>
              <h3 className="card__title">{card.title}</h3>
              {/*
                ★ 達成後にだけ中身を出す。未達成では**サーバーが中身を返していない**ので、
                ここで隠しているのではなく、そもそも持っていない（FR-14-3）。
              */}
              {card.achieved ? (
                <p className="card__body">{card.body}</p>
              ) : (
                <p className="card__condition">{card.condition}</p>
              )}
            </article>
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <p className="panel__note">
          まだこの種類のカードはありません。歩いてチェックインすると増えます。
        </p>
      )}
    </section>
  )
}
