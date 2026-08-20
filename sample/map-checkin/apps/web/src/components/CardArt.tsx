import {
  DEFAULT_AVATAR,
  EMPTY_EQUIPMENT,
  ITEM_DEFS,
  SPOT_CATEGORY_COLORS,
  SPOT_CATEGORY_GLYPHS,
  isItemKey,
  parseCardId,
  type CardView,
} from '@map-checkin/shared'
import { AvatarCanvas } from './AvatarCanvas.js'

/**
 * カードの絵（FR-14）。
 *
 * 新しい素材を作らず、**すでにあるものを流用して4種すべての絵をそろえている**。
 * - 道具：その道具だけを装備したキャラクターのドット絵（`sprite.ts` の装備レイヤー）
 * - 場所：地図マーカーと同じ配色＋カテゴリの1文字
 * - 行動：対応する出題のカテゴリ色＋記号
 * - ミッション：進捗のリング
 */

interface CardArtProps {
  card: CardView
}

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
        // 12時の位置から時計回りに伸ばす
        transform="rotate(-90 30 30)"
      />
      <text x="30" y="34" className="cardart__ring-text">
        {current}/{total}
      </text>
    </svg>
  )
}

export function CardArt({ card }: CardArtProps): React.JSX.Element {
  const accent = card.category ? SPOT_CATEGORY_COLORS[card.category] : undefined

  if (card.kind === 'tool') {
    const parsed = parseCardId(card.cardId)
    const key = parsed && isItemKey(parsed.key) ? parsed.key : undefined

    // その道具だけを装備した姿を描く。装備の見た目がそのままカードの絵になる
    const equipment = key
      ? { ...EMPTY_EQUIPMENT, [ITEM_DEFS[key].slot]: key }
      : EMPTY_EQUIPMENT

    return (
      <div className="cardart cardart--tool">
        <AvatarCanvas
          avatar={DEFAULT_AVATAR}
          equipment={equipment}
          scale={1.5}
          label={`${card.title} を身につけたすがた`}
        />
      </div>
    )
  }

  if (card.kind === 'mission') {
    return (
      <div className="cardart cardart--mission">
        {card.progress ? <ProgressRing {...card.progress} /> : <span className="cardart__glyph">★</span>}
      </div>
    )
  }

  if (card.kind === 'place') {
    return (
      <div
        className="cardart cardart--place"
        style={accent ? { ['--art-color' as string]: accent } : undefined}
      >
        <span className="cardart__glyph">
          {card.category ? SPOT_CATEGORY_GLYPHS[card.category] : '？'}
        </span>
      </div>
    )
  }

  return (
    <div
      className="cardart cardart--action"
      style={accent ? { ['--art-color' as string]: accent } : undefined}
    >
      <span className="cardart__glyph">！</span>
    </div>
  )
}
