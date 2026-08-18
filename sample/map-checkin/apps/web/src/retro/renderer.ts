import type { FogStyle } from './palette.js'
import { quantizeToNes } from './quantize.js'

/**
 * 地図と霧を縮小して合成し、パレットへ丸めて表示するキャンバス。
 *
 * 表示側のキャンバスは**バッキングストアがドット数そのまま**で、CSS で引き伸ばす。
 * 拡大は `image-rendering: pixelated` に任せるので、ここで拡大処理は書かない。
 *
 * 縮小はブラウザの平滑化に任せる。1 ドット未満の細い道も色として残るので、
 * 低解像度で直接描かせるより消えにくい。
 *
 * 霧は**縮小してから、丸めと同時に**重ねる。
 * 半透明で先に重ねてしまうと全部の色が濁るので、暗いパレットへ落とす（quantize.ts）。
 */

/** 霧とみなす不透明度のしきい値。縮小の平均で端がぼけるので、真ん中あたりで切る */
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
  // 毎フレーム getImageData を呼ぶので、読み出し向けだと宣言しておく。
  // 指定しないと GPU から読み戻すたびに大きな待ちが入る。
  const ctx = display.getContext('2d', { willReadFrequently: true })

  // 霧を縮小して受けるだけの作業用キャンバス
  const fogScratch = document.createElement('canvas')
  const fogCtx = fogScratch.getContext('2d', { willReadFrequently: true })

  function draw(): void {
    if (!ctx) return
    if (mapCanvas.width === 0 || mapCanvas.height === 0) return

    // 横のドット数は固定。縦は地図の縦横比から決める
    const width = Math.min(dotWidth, mapCanvas.width)
    const height = Math.max(1, Math.round((width * mapCanvas.height) / mapCanvas.width))

    if (display.width !== width || display.height !== height) {
      display.width = width
      display.height = height
    }

    ctx.imageSmoothingEnabled = true
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(mapCanvas, 0, 0, width, height)

    let fog
    if (fogCanvas.width > 0 && fogCanvas.height > 0 && fogCtx) {
      if (fogScratch.width !== width || fogScratch.height !== height) {
        fogScratch.width = width
        fogScratch.height = height
      }
      fogCtx.clearRect(0, 0, width, height)
      fogCtx.drawImage(fogCanvas, 0, 0, width, height)
      fog = {
        mask: fogCtx.getImageData(0, 0, width, height).data,
        threshold: FOG_THRESHOLD,
        style: fogStyle,
        ditherColor: DITHER_COLOR,
      }
    }

    const image = ctx.getImageData(0, 0, width, height)
    quantizeToNes(image.data, width, fog)
    ctx.putImageData(image, 0, 0)
  }

  return { draw }
}
