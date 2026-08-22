import {
  PIXEL_ART,
  PIXEL_SIZE,
  parseCardId,
  pixelArtKeyOf,
  SPOT_CATEGORY_COLORS,
  type CardView,
} from '@imanouchi/shared'
import { useEffect, useRef } from 'react'

interface CardArtProps {
  card: CardView
}

/**
 * カードの絵（FR-14）。24×24 のドット絵を canvas へ打つ。
 *
 * ★ **画像を持たない。** 同一オリジン配信で外部へ置けず、ZIP と配信サイズにそのまま
 * 乗る。点の並びは `packages/shared/src/pixel-art.ts` にあり、寸法はテストで固定してある。
 *
 * ★ 拡大は `image-rendering: pixelated` に任せ、**canvas の実寸は 24×24 のまま**にする。
 * 大きな canvas に太い四角を描くと、端末の拡大率で点の大きさが揃わない。
 *
 * ★ 未達成は**中身の絵を出さず「？」を出す**（決定した案B）。何のカードかはタイトルで
 * 分かるようにしたうえで、絵は達成後のお楽しみにする。枠だけの空白にはしない
 * （空白は「壊れている」ように見え、「まだ自分のものになっていない」が伝わらない）。
 *
 * ★ **カードは道具そのものの絵を描く。** 「その道具を装備したキャラクター」も試したが、
 * カードの中では人が主役に見えてしまい、何の道具かが伝わりにくかった。
 * 装備した姿は地図とキャラメイクの側で見せる（そちらは人が主役でよい）。
 */

/** 未達成のカードに出す絵 */
const LOCKED_ART = 'locked-unknown'

/** 主色から影と明るい面を作る。CSS の色を1つ渡すだけで済ませるため */
function shadesOf(color: string): { main: string; dark: string; light: string } {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (!match) return { main: color, dark: color, light: color }

  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const mix = (v: number, target: number, ratio: number) => Math.round(v + (target - v) * ratio)

  return {
    main: `rgb(${r}, ${g}, ${b})`,
    dark: `rgb(${mix(r, 0, 0.35)}, ${mix(g, 0, 0.35)}, ${mix(b, 0, 0.35)})`,
    light: `rgb(${mix(r, 255, 0.45)}, ${mix(g, 255, 0.45)}, ${mix(b, 255, 0.45)})`,
  }
}

const FIXED: Record<string, string> = {
  o: '#241f27',
  w: 'rgba(255, 255, 255, 0.94)',
  g: '#8e8896',
  y: '#f0c04a',
  r: '#d0453a',
  s: '#e7b487',
}

export function CardArt({ card }: CardArtProps): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const parsed = parseCardId(card.cardId)
  const artKey = card.achieved
    ? pixelArtKeyOf({
        kind: parsed?.kind ?? card.kind,
        key: parsed?.key ?? '',
        category: card.category,
      })
    : LOCKED_ART


  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const rows = PIXEL_ART[artKey] ?? []
    context.clearRect(0, 0, PIXEL_SIZE, PIXEL_SIZE)

    /*
     * ★ 主色は CSS 側で決めた値を読む（種類ごとの色を JS に二重で持たない）。
     * 未達成は灰色にする。
     */
    const resolved = getComputedStyle(canvas).getPropertyValue('--art-color').trim()
    const shades = shadesOf(card.achieved ? resolved : 'rgb(150, 145, 155)')

    for (const [y, row] of rows.entries()) {
      for (let x = 0; x < row.length; x += 1) {
        const ch = row[x]
        if (ch === undefined || ch === '.') continue

        /*
         * ★ 未達成は**全部を灰色の濃淡にする。** 主色だけ灰色にしても、輪郭（黒）や
         * 明かり（黄）が残ると「色が付いている」ように見えて、達成との差が出ない。
         */
        const fill = card.achieved
          ? ch === 'm'
            ? shades.main
            : ch === 'd'
              ? shades.dark
              : ch === 'l'
                ? shades.light
                : FIXED[ch]
          : ch === 'o'
            ? shades.dark
            : ch === 'w' || ch === 'l'
              ? shades.light
              : shades.main
        if (!fill) continue

        context.fillStyle = fill
        context.fillRect(x, y, 1, 1)
      }
    }
  }, [artKey, card.achieved])

  return (
    <div className={`cardart cardart--${card.kind}`}>
      <canvas
        ref={ref}
        className="cardart__canvas"
        width={PIXEL_SIZE}
        height={PIXEL_SIZE}
        aria-hidden="true"
      />
    </div>
  )
}

/**
 * カード1枚の色。
 *
 * ★ **色は article（カード）側に置く。** 枠・種類名・絵の地をまとめて決めるため。
 * 絵の側に置くと、枠だけ別の色という食い違いが起きる。
 *
 * ★ 未達成では色を渡さない（CSS 側が灰色にする）。ここで渡すとインラインの方が強く、
 * 「未達成は灰色」という指定が効かなくなる。
 */
export function cardColorStyle(card: CardView): React.CSSProperties | undefined {
  if (!card.achieved || !card.category) return undefined
  return { ['--card-color' as string]: SPOT_CATEGORY_COLORS[card.category] }
}
