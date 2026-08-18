import type { FogStyle } from './palette.js'
import { quantizeToNes } from './quantize.js'

/**
 * 未到達エリアだけをドット絵にして、素の地図の上に重ねる。
 *
 * ```
 * 素の地図（そのままの解像度）
 *        ↑ 未到達エリアだけ、縮小してパレットへ丸めた層を最近傍で拡大して重ねる
 * ```
 *
 * 到達エリアはドット層を透明にするので、下の地図がそのまま見える。
 * **粗さの違いがそのまま境目になる**ので、色だけで分けるより境目がはっきりする。
 * マスクはドット解像度で 2 値化してから拡大するため、境目もドット単位で階段状になる。
 *
 * 縮小はブラウザの平滑化に任せる。1 ドット未満の細い道も色として残るので、
 * 低解像度で直接描かせるより消えにくい。
 */

/** 未到達とみなす不透明度のしきい値。縮小の平均で端がぼけるので、真ん中あたりで切る */
const FOG_THRESHOLD = 110

/** dither のときに塗る色（$0C の濃紺） */
const DITHER_COLOR = { r: 0, g: 64, b: 88 }

export interface RetroRenderer {
  /** 1 フレーム描く。地図の render イベントから呼ぶ */
  draw: () => void
}

export function createRetroRenderer(
  mapCanvas: HTMLCanvasElement,
  fogCanvas: HTMLCanvasElement,
  display: HTMLCanvasElement,
  dotWidth: number,
  fogStyle: FogStyle,
): RetroRenderer {
  // 表示側は素の解像度。毎フレーム読まないので、既定の（GPU 側に置ける）文脈でよい
  const ctx = display.getContext('2d')

  // ドット解像度で持つ作業用の 2 枚。こちらは毎フレーム getImageData を呼ぶので、
  // 読み出し向けだと宣言しておく。指定しないと読み戻しのたびに大きな待ちが入る。
  const pixels = document.createElement('canvas')
  const pixelCtx = pixels.getContext('2d', { willReadFrequently: true })
  const fogScratch = document.createElement('canvas')
  const fogCtx = fogScratch.getContext('2d', { willReadFrequently: true })

  function draw(): void {
    if (!ctx || !pixelCtx) return

    const width = mapCanvas.width
    const height = mapCanvas.height
    if (width === 0 || height === 0) return

    // 横のドット数は固定。縦は地図の縦横比から決める
    const dotW = Math.min(dotWidth, width)
    const dotH = Math.max(1, Math.round((dotW * height) / width))

    if (display.width !== width || display.height !== height) {
      display.width = width
      display.height = height
    }
    if (pixels.width !== dotW || pixels.height !== dotH) {
      pixels.width = dotW
      pixels.height = dotH
    }

    // 1. 地図をドット解像度へ落とす
    pixelCtx.imageSmoothingEnabled = true
    pixelCtx.clearRect(0, 0, dotW, dotH)
    pixelCtx.drawImage(mapCanvas, 0, 0, dotW, dotH)

    // 2. 霧も同じ解像度へ落とす（どこが未到達かのマスクとしてだけ使う）
    let fog
    if (fogCanvas.width > 0 && fogCanvas.height > 0 && fogCtx) {
      if (fogScratch.width !== dotW || fogScratch.height !== dotH) {
        fogScratch.width = dotW
        fogScratch.height = dotH
      }
      fogCtx.clearRect(0, 0, dotW, dotH)
      fogCtx.drawImage(fogCanvas, 0, 0, dotW, dotH)
      fog = {
        mask: fogCtx.getImageData(0, 0, dotW, dotH).data,
        threshold: FOG_THRESHOLD,
        style: fogStyle,
        ditherColor: DITHER_COLOR,
      }
    }

    // 3. パレットへ丸める。到達エリアは透明になる
    const image = pixelCtx.getImageData(0, 0, dotW, dotH)
    quantizeToNes(image.data, dotW, fog)
    pixelCtx.putImageData(image, 0, 0)

    // 4. 素の地図の上に、ドット層を最近傍で拡大して重ねる
    // 地図が全面を覆うので clearRect は要らない
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(mapCanvas, 0, 0, width, height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(pixels, 0, 0, dotW, dotH, 0, 0, width, height)
  }

  return { draw }
}
