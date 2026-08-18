import { nearestNesColor } from './nes-palette.js'

/**
 * 出来上がった画をファミコンのパレットへ丸める。
 *
 * **ドット絵らしさの本体はここ**。color-theme の LUT はレイヤーを描く時点で効くので、
 * レイヤー同士の合成やアンチエイリアスで生まれた中間色は素通りしてしまう。
 * それだけだと「解像度を落としただけの画」＝モザイクに見える。
 * 合成が終わった画に対してここで丸めることで、画面上のすべての画素がパレットの色になり、
 * 色の境界が 1 ドット単位で立つ。
 */

/** 1 チャンネルあたりの段階数。8bit のうち上位 5bit を対応表の添字に使う */
export const NES_TABLE_LEVELS = 32

let table: Uint8Array | undefined

/**
 * 「上位 5bit の RGB → もっとも近いファミコンの色」の対応表。
 *
 * 32768 通りを総当たりで作るので 30ms ほどかかる。一度だけ作って使い回す。
 * cube strip の LUT も同じ対応を使うので、両者で色がずれることはない。
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

/**
 * ImageData の画素をパレットへ丸める（その場で書き換える）。
 * 透明度はそのまま残す。
 */
export function quantizeToNes(pixels: Uint8ClampedArray): void {
  const lookup = nesLookupTable()

  for (let i = 0; i < pixels.length; i += 4) {
    const at = nesTableIndex(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!)
    pixels[i] = lookup[at]!
    pixels[i + 1] = lookup[at + 1]!
    pixels[i + 2] = lookup[at + 2]!
  }
}
