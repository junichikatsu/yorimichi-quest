import { quantizeToNes } from './quantize.js'

/**
 * 地図と霧を低解像度のまま合成し、パレットへ丸めて表示するキャンバス。
 *
 * 地図のキャンバスは devicePixelRatio の差し替えですでに粗く描かれている。
 * ここではそれを等倍で受け取り、霧を重ねてから丸めるだけで、拡大は CSS に任せる
 * （表示側のキャンバスは低解像度のまま、image-rendering: pixelated で引き伸ばされる）。
 *
 * 霧を**丸める前に**重ねるのが要点。あとから半透明で重ねると、せっかく丸めた色の上に
 * 中間色が乗ってしまう。
 */

export interface RetroRenderer {
  /** 1 フレーム描く。地図の render イベントから呼ぶ */
  draw: () => void
}

export function createRetroRenderer(
  mapCanvas: HTMLCanvasElement,
  fogCanvas: HTMLCanvasElement,
  display: HTMLCanvasElement,
): RetroRenderer {
  // 毎フレーム getImageData を呼ぶので、読み出し向けだと宣言しておく。
  // 指定しないと GPU から読み戻すたびに大きな待ちが入る。
  const ctx = display.getContext('2d', { willReadFrequently: true })

  function draw(): void {
    if (!ctx) return

    const width = mapCanvas.width
    const height = mapCanvas.height
    if (width === 0 || height === 0) return

    if (display.width !== width || display.height !== height) {
      display.width = width
      display.height = height
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(mapCanvas, 0, 0, width, height)

    // 霧のキャンバスは丸め方の違いで 1px ずれることがあるので、大きさを指定して重ねる
    if (fogCanvas.width > 0 && fogCanvas.height > 0) {
      ctx.drawImage(fogCanvas, 0, 0, width, height)
    }

    const image = ctx.getImageData(0, 0, width, height)
    quantizeToNes(image.data)
    ctx.putImageData(image, 0, 0)
  }

  return { draw }
}
