import { quantizeToNes } from './quantize.js'

/**
 * 地図と霧を縮小して合成し、パレットへ丸めて表示するキャンバス。
 *
 * 表示側のキャンバスは**バッキングストアがドット数そのまま**で、CSS で引き伸ばす。
 * 拡大は `image-rendering: pixelated` に任せるので、ここで拡大処理は書かない。
 *
 * 順番に意味がある。
 *
 * 1. 縮小してから重ねる — 元の解像度で重ねてから縮小すると計算量が数十倍になる
 * 2. 霧は**丸める前に**重ねる — あとから半透明で重ねると、丸めた色の上に中間色が乗る
 * 3. 縮小はブラウザの平滑化に任せる — 1 ドット未満の細い道も色として残り、消えにくい
 */

export interface RetroRenderer {
  /** 1 フレーム描く。地図の render イベントから呼ぶ */
  draw: () => void
}

export function createRetroRenderer(
  mapCanvas: HTMLCanvasElement,
  fogCanvas: HTMLCanvasElement,
  display: HTMLCanvasElement,
  dotWidth: number,
): RetroRenderer {
  // 毎フレーム getImageData を呼ぶので、読み出し向けだと宣言しておく。
  // 指定しないと GPU から読み戻すたびに大きな待ちが入る。
  const ctx = display.getContext('2d', { willReadFrequently: true })

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

    if (fogCanvas.width > 0 && fogCanvas.height > 0) {
      ctx.drawImage(fogCanvas, 0, 0, width, height)
    }

    const image = ctx.getImageData(0, 0, width, height)
    quantizeToNes(image.data)
    ctx.putImageData(image, 0, 0)
  }

  return { draw }
}
