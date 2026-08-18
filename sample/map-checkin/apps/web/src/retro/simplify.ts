import type { Map as MapboxMap } from 'mapbox-gl'

/**
 * 地図の情報量を落とす。
 *
 * ドット絵に見えない原因の半分は解像度ではなく**描かれている量**にある。
 * streets-v12 は細い道・縁取り・POI アイコンを大量に持っていて、
 * 横 256 ドットまで落とすとそれらが 1 ドット未満の粒になり、ただのノイズになる。
 * ファミコンの地図画面が読めるのは、最初から大きく単純な形だけで描かれているから。
 *
 * 本来はカスタムスタイルを書き起こすべきところだが、spike なので
 * 読み込み済みのスタイルから機械的に間引く。判定はレイヤーの種類と id の規則だけで、
 * 個別のレイヤー名には依存しない（スタイル更新で名前が変わっても壊れないように）。
 *
 * 文字は別レイヤー（labels.ts）で素の解像度のまま重ねるので、ここでは消す。
 */

/** まるごと消す種類 */
const HIDDEN_TYPES = new Set(['symbol', 'fill-extrusion', 'hillshade', 'heatmap', 'sky'])

/** 道路の縁取り。太い線の上に細い線を重ねる表現で、粗い画では汚れにしか見えない */
const CASE_SUFFIX = '-case'

/** 道路の太さの倍率 */
const ROAD_WIDTH_SCALE = 2.5

/**
 * 道路の最低の太さ（ドット数）。
 *
 * ズームアウトすると道路は 1 ドットより細くなり、縮小の平均に溶けて消えてしまう。
 * 倍率だけでは足りないので、ドット数での下限も持たせる。
 */
const MIN_ROAD_DOTS = 1.5

function hide(map: MapboxMap, layerId: string): void {
  try {
    map.setLayoutProperty(layerId, 'visibility', 'none')
  } catch {
    // スタイル側の都合で消えていることがある。1 レイヤーの失敗で全体を止めない
  }
}

function widen(map: MapboxMap, layerId: string, minWidthPx: number): void {
  try {
    const width: unknown = map.getPaintProperty(layerId, 'line-width')
    // 数値か式のときだけ包める。旧形式の stops オブジェクトは触らない
    if (typeof width !== 'number' && !Array.isArray(width)) return
    map.setPaintProperty(layerId, 'line-width', [
      'max',
      ['*', width, ROAD_WIDTH_SCALE],
      minWidthPx,
    ])
  } catch {
    // 同上
  }
}

/**
 * @param dotScale 1 ドットが地図上の何 px にあたるか（地図の表示幅 ÷ 横のドット数）
 */
export function simplifyForRetro(map: MapboxMap, dotScale: number): void {
  const layers = map.getStyle()?.layers
  if (!layers) return

  // line-width は地図の座標系（CSS px）で指定するので、ドット数から換算する
  const minWidthPx = MIN_ROAD_DOTS * dotScale

  for (const layer of layers) {
    if (HIDDEN_TYPES.has(layer.type) || layer.id.endsWith(CASE_SUFFIX)) {
      hide(map, layer.id)
      continue
    }

    if (layer.type === 'line' && layer.id.startsWith('road')) {
      widen(map, layer.id, minWidthPx)
    }
  }
}
