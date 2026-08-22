import {
  classifyPixel,
  hazardTileUrl,
  worseSample,
  type HazardLayer,
  type HazardSample,
  type TilePoint,
} from './hazard.js'

/**
 * ハザードタイルの読み込みと画素の読み取り（#72）。
 *
 * ★ 表示と判定で**同じタイルを使う**。別の出どころにすると、絵と文言が食い違う
 * （地図では区域の外に見えるのに「区域内です」と出る、が起きる）。
 *
 * ★ `crossOrigin = 'anonymous'` を必ず付ける。付けないとキャンバスが汚染され、
 * **画素を読めなくなる**（判定が丸ごと死ぬ）。配信側は `Access-Control-Allow-Origin: *`
 * を返すことを確認している（2026-08-22）。
 *
 * ★ 読めなかったタイルは**覚えて二度と取りに行かない**。歩くたびに再試行すると、
 * 区域外（404 が正しい応答）で延々とリクエストを出し続ける。
 */

interface CachedTile {
  image: HTMLImageElement
  /** 読み込みに失敗した（区域外の 404 を含む） */
  failed: boolean
}

const tiles = new Map<string, CachedTile>()

/** 画素を読むための作業用キャンバス。1枚を使い回す */
let scratch: HTMLCanvasElement | undefined

function keyOf(layer: HazardLayer, z: number, x: number, y: number): string {
  return `${layer.id}/${z}/${x}/${y}`
}

/**
 * タイルを1枚得る。まだ無ければ読み込みを始めて undefined を返す。
 *
 * `onReady` は読み込めたときに呼ぶ（描き直しのきっかけにする）。
 */
export function getHazardTile(
  layer: HazardLayer,
  z: number,
  x: number,
  y: number,
  onReady?: () => void,
): HTMLImageElement | undefined {
  const key = keyOf(layer, z, x, y)
  const cached = tiles.get(key)

  if (cached) {
    if (cached.failed) return undefined
    return cached.image.complete && cached.image.naturalWidth > 0 ? cached.image : undefined
  }

  if (typeof document === 'undefined') return undefined

  const image = new Image()
  const entry: CachedTile = { image, failed: false }
  tiles.set(key, entry)

  // ★ src より先に立てる。後から付けても効かない
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.addEventListener('load', () => onReady?.())
  image.addEventListener('error', () => {
    // 区域が無いところは 404 が正しい応答である。失敗として覚え、再試行しない
    entry.failed = true
  })
  image.src = hazardTileUrl(layer, z, x, y)

  return undefined
}

/**
 * その地点の判定。
 *
 * ★ 1点だけでなく**周囲も見る**。区域の境界に立っているときに、1px の当たり外れで
 * 出たり消えたりするのを避ける。深い側を採る（`worseSample` と同じ理由で安全側）。
 */
export function readHazardSample(
  layer: HazardLayer,
  point: TilePoint,
  onReady?: () => void,
): HazardSample | undefined {
  const image = getHazardTile(layer, point.z, point.x, point.y, onReady)
  if (!image) return undefined

  if (typeof document === 'undefined') return undefined
  scratch ??= document.createElement('canvas')
  scratch.width = 256
  scratch.height = 256

  const ctx = scratch.getContext('2d', { willReadFrequently: true })
  if (!ctx) return undefined

  ctx.clearRect(0, 0, 256, 256)
  ctx.drawImage(image, 0, 0)

  // 3×3（約7m四方）を読む。端でも範囲から出ないように寄せる
  const x = Math.min(254, Math.max(1, point.px))
  const y = Math.min(254, Math.max(1, point.py))

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(x - 1, y - 1, 3, 3).data
  } catch {
    // 汚染されている（CORS が通らなかった）。判定はあきらめ、表示だけ続ける
    return undefined
  }

  let result: HazardSample = { inside: false }
  for (let i = 0; i < data.length; i += 4) {
    const sample = classifyPixel(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0)
    result = worseSample(result, sample)
  }

  return result
}
