import { nearestNesColor, type Rgb } from './nes-palette.js'
import { SHADOW_FACTOR, shadowOverrideFor, type FogStyle } from './palette.js'

/**
 * 出来上がった画をファミコンのパレットへ丸める。
 *
 * **ドット絵らしさの本体はここ**。丸めずに解像度だけ落とすと、アンチエイリアスや
 * レイヤーの合成で生まれた中間色が「隣り合う 2 色を混ぜた大きな正方形」として並ぶ。
 * それはモザイクの作り方そのもので、ドット絵にはならない。
 */

/** 1 チャンネルあたりの段階数。8bit のうち上位 5bit を対応表の添字に使う */
export const NES_TABLE_LEVELS = 32

/** 対応表の添字。RGB それぞれの上位 5bit を並べる */
export function nesTableIndex(r: number, g: number, b: number): number {
  return (((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) * 3
}

function toHex({ r, g, b }: Rgb): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

function fromHex(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16)
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
}

let normal: Uint8Array | undefined
let shadow: Uint8Array | undefined

/**
 * 対応表を作る。32768 通りを総当たりするので 30ms ほどかかる。一度だけ作って使い回す。
 *
 * - normal: もっとも近いファミコンの色
 * - shadow: そのさらに暗い版（未踏エリア用）
 */
function buildTables(): void {
  if (normal && shadow) return

  const nextNormal = new Uint8Array(NES_TABLE_LEVELS ** 3 * 3)
  const nextShadow = new Uint8Array(NES_TABLE_LEVELS ** 3 * 3)
  const step = 255 / (NES_TABLE_LEVELS - 1)
  // 同じパレット色に落ちる添字は多いので、暗い版は色ごとに一度だけ求める
  const shadowByColor = new Map<string, Rgb>()

  for (let r = 0; r < NES_TABLE_LEVELS; r += 1) {
    for (let g = 0; g < NES_TABLE_LEVELS; g += 1) {
      for (let b = 0; b < NES_TABLE_LEVELS; b += 1) {
        const color = nearestNesColor({ r: r * step, g: g * step, b: b * step })
        const hex = toHex(color)

        let dark = shadowByColor.get(hex)
        if (!dark) {
          const override = shadowOverrideFor(hex)
          dark = override
            ? fromHex(override)
            : nearestNesColor({
                r: color.r * SHADOW_FACTOR,
                g: color.g * SHADOW_FACTOR,
                b: color.b * SHADOW_FACTOR,
              })
          shadowByColor.set(hex, dark)
        }

        const at = ((r << 10) | (g << 5) | b) * 3
        nextNormal[at] = color.r
        nextNormal[at + 1] = color.g
        nextNormal[at + 2] = color.b
        nextShadow[at] = dark.r
        nextShadow[at + 1] = dark.g
        nextShadow[at + 2] = dark.b
      }
    }
  }

  normal = nextNormal
  shadow = nextShadow
}

export interface FogOverlay {
  /** 霧の濃さ。縮小済みで、画素の並びは pixels と同じ */
  mask: Uint8ClampedArray
  /** マスクの不透明度がこれを超えたら未到達とみなす */
  threshold: number
  /** 未到達エリアの見せ方。shade は暗いパレット、dither は市松模様 */
  style: FogStyle
  /** dither のときに塗る色 */
  ditherColor: Rgb
}

/** 市松模様の 1 マスの大きさ（ドット）。1 だと細かすぎて画面がちらつく */
const DITHER_CELL = 2

/**
 * 画素をパレットへ丸める（その場で書き換える）。
 *
 * 霧を渡すと、**到達エリアの画素は透明になる**。
 * この結果を素の地図の上へ重ねるので、到達エリアは下の地図がそのまま見え、
 * 未到達エリアだけがドット絵で覆われる。境目はドット単位で切り替わる。
 *
 * @param width 1 行のドット数。市松の位相を出すのに要る
 */
export function quantizeToNes(
  pixels: Uint8ClampedArray,
  width: number,
  fog?: FogOverlay,
): void {
  buildTables()
  const normalTable = normal!
  const shadowTable = shadow!

  for (let i = 0; i < pixels.length; i += 4) {
    if (fog !== undefined && (fog.mask[i + 3] ?? 0) <= fog.threshold) {
      // 到達エリア。透明にして、下の素の地図を見せる
      pixels[i + 3] = 0
      continue
    }

    const at = nesTableIndex(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!)
    const fogged = fog !== undefined

    if (fogged && fog.style === 'dither') {
      const pixel = i >> 2
      const x = pixel % width
      const y = (pixel - x) / width
      if ((Math.floor(x / DITHER_CELL) + Math.floor(y / DITHER_CELL)) % 2 === 0) {
        pixels[i] = fog.ditherColor.r
        pixels[i + 1] = fog.ditherColor.g
        pixels[i + 2] = fog.ditherColor.b
        continue
      }
    }

    const table = fogged ? shadowTable : normalTable
    pixels[i] = table[at]!
    pixels[i + 1] = table[at + 1]!
    pixels[i + 2] = table[at + 2]!
  }
}
