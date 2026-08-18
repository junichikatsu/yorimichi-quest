import type { Rgb } from './nes-palette.js'
import { nearestNesColor } from './nes-palette.js'

/**
 * 出来上がった画をファミコンのパレットへ丸める。
 *
 * **ドット絵らしさの本体はここ**。丸めずに解像度だけ落とすと、アンチエイリアスや
 * レイヤーの合成で生まれた中間色が「隣り合う 2 色を混ぜた大きな正方形」として並ぶ。
 * それはモザイクの作り方そのもので、ドット絵にはならない。
 */

/** 1 チャンネルあたりの段階数。8bit のうち上位 5bit を対応表の添字に使う */
export const NES_TABLE_LEVELS = 32

let table: Uint8Array | undefined

/**
 * 「上位 5bit の RGB → もっとも近いファミコンの色」の対応表。
 * 32768 通りを総当たりで作るので 30ms ほどかかる。一度だけ作って使い回す。
 */
export function nesLookupTable(): Uint8Array {
  if (table) return table

  const next = new Uint8Array(NES_TABLE_LEVELS ** 3 * 3)
  const step = 255 / (NES_TABLE_LEVELS - 1)

  for (let r = 0; r < NES_TABLE_LEVELS; r += 1) {
    for (let g = 0; g < NES_TABLE_LEVELS; g += 1) {
      for (let b = 0; b < NES_TABLE_LEVELS; b += 1) {
        const color = nearestNesColor({ r: r * step, g: g * step, b: b * step })
        const at = ((r << 10) | (g << 5) | b) * 3
        next[at] = color.r
        next[at + 1] = color.g
        next[at + 2] = color.b
      }
    }
  }

  table = next
  return next
}

/** 対応表の添字。RGB それぞれの上位 5bit を並べる */
export function nesTableIndex(r: number, g: number, b: number): number {
  return (((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) * 3
}

export interface FogOverlay {
  /** 霧の濃さ。縮小済みで、画素の並びは pixels と同じ */
  mask: Uint8ClampedArray
  /** 霧として塗る色 */
  color: Rgb
  /** マスクの不透明度がこれを超えたら霧とみなす */
  threshold: number
}

/**
 * 画素をパレットへ丸める（その場で書き換える）。霧があれば同時に重ねる。
 *
 * 霧は市松模様（1 ドットおき）で塗る。半透明で混ぜないのは、混ぜた時点で
 * 中間色が生まれ、地物ごとに決めた色が失われるため。実機も同じ理由で市松模様を使っていた。
 *
 * @param width 1 行のドット数。市松の位相を出すのに要る
 */
export function quantizeToNes(
  pixels: Uint8ClampedArray,
  width: number,
  fog?: FogOverlay,
): void {
  const lookup = nesLookupTable()

  for (let i = 0; i < pixels.length; i += 4) {
    const pixel = i >> 2
    if (fog && (fog.mask[i + 3] ?? 0) > fog.threshold) {
      // 4 ドットに 1 つを霧の色で塗る。
      // 1 つおき（50%）だと画面全体が網戸のようになり、地図が読めなくなる。
      const x = pixel % width
      const y = (pixel - x) / width
      if (x % 2 === 0 && y % 2 === 0) {
        pixels[i] = fog.color.r
        pixels[i + 1] = fog.color.g
        pixels[i + 2] = fog.color.b
        continue
      }
    }

    const at = nesTableIndex(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!)
    pixels[i] = lookup[at]!
    pixels[i + 1] = lookup[at + 1]!
    pixels[i + 2] = lookup[at + 2]!
  }
}
