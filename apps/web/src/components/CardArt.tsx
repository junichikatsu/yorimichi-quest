import {
  CARD_KIND_LABELS,
  ITEM_DEFS,
  ITEM_SLOT_LABELS,
  SPOT_CATEGORY_COLORS,
  SPOT_CATEGORY_GLYPHS,
  isItemKey,
  parseCardId,
  type CardView,
} from '@imanouchi/shared'

interface CardArtProps {
  card: CardView
}

/**
 * カードの絵（FR-14）。
 *
 * ★ **画像を持たず、コードで描く。** 同一オリジン配信なので画像は ZIP と配信サイズに
 * そのまま乗る（Lambda の応答上限 6MB に対して余裕は減っている）。既にあるもの
 * （地図マーカーの配色・カテゴリの1文字・道具のスロット）を流用して4種を揃える。
 *
 * ★ 記号に絵文字を使わない。環境による字形の差が出るため、地図マーカーと同じく
 * 漢字・かなで表す（NFR-08）。
 */

/** ミッションの進捗リング。SVG の円周を dash で切って表す */
function ProgressRing({ current, total }: { current: number; total: number }): React.JSX.Element {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const ratio = total > 0 ? Math.min(current / total, 1) : 0

  return (
    <svg className="cardart__ring" viewBox="0 0 60 60" role="img" aria-label={`${current} / ${total}`}>
      <circle cx="30" cy="30" r={radius} className="cardart__ring-track" />
      <circle
        cx="30"
        cy="30"
        r={radius}
        className="cardart__ring-value"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
        transform="rotate(-90 30 30)"
      />
      <text x="30" y="35" className="cardart__ring-text">
        {current}/{total}
      </text>
    </svg>
  )
}

/** 種類ごとの1文字。カテゴリを持つものは地図マーカーと同じ字を使う */
function glyphOf(card: CardView): string {
  if (card.category) return SPOT_CATEGORY_GLYPHS[card.category]

  const parsed = parseCardId(card.cardId)
  if (parsed?.kind === 'tool' && isItemKey(parsed.key)) {
    // 道具は身につける場所を出す（頭・体・手・背中）。何に使うものかの手がかりになる
    return ITEM_SLOT_LABELS[ITEM_DEFS[parsed.key].slot]
  }

  return CARD_KIND_LABELS[card.kind].slice(0, 1)
}

export function CardArt({ card }: CardArtProps): React.JSX.Element {
  // 場所・行動はカテゴリの色、道具とミッションは種類ごとの色（CSS 側で決める）
  const style = card.category ? { ['--card-color' as string]: SPOT_CATEGORY_COLORS[card.category] } : undefined

  return (
    <div className={`cardart cardart--${card.kind}`} style={style} aria-hidden="true">
      {card.progress ? (
        <ProgressRing current={card.progress.current} total={card.progress.total} />
      ) : (
        <span className="cardart__glyph">{glyphOf(card)}</span>
      )}
    </div>
  )
}
