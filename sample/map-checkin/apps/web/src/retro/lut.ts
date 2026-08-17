import type { Rgb } from './nes-palette.js'
import { nearestNesColor } from './nes-palette.js'

/**
 * Mapbox の color-theme に渡す LUT（ルックアップテーブル）を作る。
 *
 * color-theme は「この色が来たらこの色を出す」という 3D テーブルで、地図のレイヤーを
 * 1 つも書き換えずに基本地図まるごとを別のパレットへ寄せられる。
 *
 * Mapbox が受け取る形式（mapbox-gl のソースで確認）:
 * - base64 の PNG（cube strip 形式）
 * - 高さは 32px 以下、幅は高さの 2 乗
 * - 渡すとタイルが全再読み込みされる
 *
 * cube strip は「1 辺 SIZE の正方形を SIZE 枚、横に並べた帯」で、
 * 何枚目が青、正方形の中の x が赤、y が緑にあたる。
 *
 *   画像の列 = 青 * SIZE + 赤
 *   画像の行 = 緑
 */

/**
 * LUT の 1 辺。Mapbox の上限が 32 で、粗くすると隣のセルとの補間が効いて
 * せっかくパレットへ丸めた色が中間色へ戻ってしまうため、上限をそのまま使う。
 */
const LUT_SIZE = 32

/**
 * cube strip の (列, 行) が表している入力色。
 *
 * **色がおかしいときに最初に疑うのはここ**。軸の対応を取り違えると
 * 地図全体の色が入れ替わる。根拠は mapbox-gl のシェーダ
 * `applyLUT(lut, col)` が `col.rbg` と入れ替えて 3D テクスチャを引いている点。
 */
export function cubeStripInput(size: number, column: number, row: number): Rgb {
  // 先に 255 を掛ける。step を先に割ると端が 255.00000000000003 になる
  const scale = (index: number): number => (index * 255) / (size - 1)
  return {
    r: scale(column % size),
    g: scale(row),
    b: scale(Math.floor(column / size)),
  }
}

/** 生成に数十 ms かかる。値は変わらないので一度だけ作る */
let cached: string | undefined

function render(): string {
  const width = LUT_SIZE * LUT_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = LUT_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D コンテキストを取得できませんでした')

  const image = ctx.createImageData(width, LUT_SIZE)

  for (let row = 0; row < LUT_SIZE; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const mapped = nearestNesColor(cubeStripInput(LUT_SIZE, column, row))
      const offset = (row * width + column) * 4
      image.data[offset] = mapped.r
      image.data[offset + 1] = mapped.g
      image.data[offset + 2] = mapped.b
      image.data[offset + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)

  // Mapbox は data URL でもそのままの base64 でも受け付けるが、
  // ドキュメントの例にあわせて接頭辞を落として渡す。
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
}

/** ファミコンのパレットへ寄せる LUT を base64 の PNG で返す */
export function nesColorThemeLut(): string {
  cached ??= render()
  return cached
}
