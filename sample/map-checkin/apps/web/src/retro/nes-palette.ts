/**
 * ファミコン（NES / RP2C02）が出せる色。
 *
 * 実機のパレットは 64 エントリだが、$xE / $xF は黒のミラーで、$1D も $0D と同じ黒。
 * 重複を落とすとここに並ぶ 55 色になる（$00-$0D / $10-$1C / $20-$2D / $30-$3D）。
 * 「54 色」と書かれることも多く、どのエントリを数えるかで 53〜56 と幅がある。
 *
 * 値は一般に流通している近似値。実機は NTSC 信号を直接作っているため、
 * 「正しい RGB」は 1 つに定まらない。
 *
 * 実機はさらに「8x8 タイルごとに 4 色まで」という制約を持つが、
 * 地図には持ち込みようがないので色数の制約だけを借りている。
 */
const NES_PALETTE_HEX = [
  '#7c7c7c', '#0000fc', '#0000bc', '#4428bc', '#940084', '#a80020', '#a81000',
  '#881400', '#503000', '#007800', '#006800', '#005800', '#004058', '#000000',
  '#bcbcbc', '#0078f8', '#0058f8', '#6844fc', '#d800cc', '#e40058', '#f83800',
  '#e45c10', '#ac7c00', '#00b800', '#00a800', '#00a844', '#008888',
  '#f8f8f8', '#3cbcfc', '#6888fc', '#9878f8', '#f878f8', '#f85898', '#f87858',
  '#fca044', '#f8b800', '#b8f818', '#58d854', '#58f898', '#00e8d8', '#787878',
  '#fcfcfc', '#a4e4fc', '#b8b8f8', '#d8b8f8', '#f8b8f8', '#f8a4c0', '#f0d0b0',
  '#fce0a8', '#f8d878', '#d8f878', '#b8f8b8', '#b8f8d8', '#00fcfc', '#d8d8d8',
] as const

export interface Rgb {
  r: number
  g: number
  b: number
}

function parseHex(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16)
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
}

export const NES_PALETTE: readonly Rgb[] = NES_PALETTE_HEX.map(parseHex)

/**
 * 2 色の距離。
 *
 * 単純なユークリッド距離だと、地図の落ち着いた色が緑や紫へ飛びやすい。
 * ここでは "redmean" と呼ばれる重み付けを使う。赤の平均値で R と B の重みを変える
 * だけの近似だが、目で見た近さにかなり寄る割に計算が軽い。
 * 比較にしか使わないので平方根は取らない。
 */
function colorDistanceSquared(a: Rgb, b: Rgb): number {
  const redMean = (a.r + b.r) / 2
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return (
    (2 + redMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - redMean) / 256) * db * db
  )
}

/** 与えた色にもっとも近いファミコンの色 */
export function nearestNesColor(color: Rgb): Rgb {
  let best = NES_PALETTE[0] as Rgb
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of NES_PALETTE) {
    const distance = colorDistanceSquared(color, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  return best
}
