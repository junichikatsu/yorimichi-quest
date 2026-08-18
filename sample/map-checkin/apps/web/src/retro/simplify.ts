import type { Map as MapboxMap } from 'mapbox-gl'

/**
 * 地図の情報量を落とす。
 *
 * ドット絵に見えない原因の半分は解像度ではなく**描かれている量**にある。
 * streets-v12 は細い道・縁取り・POI アイコン・ラベルを大量に持っていて、
 * 横 256px まで落とすとそれらが 1 ドット未満の粒になり、ただのノイズになる。
 * ファミコンの地図画面が読めるのは、最初から大きく単純な形だけで描かれているから。
 *
 * 本来はカスタムスタイルを書き起こすべきところだが、spike なので
 * 読み込み済みのスタイルから機械的に間引く。判定はレイヤーの種類と id の規則だけで、
 * 個別のレイヤー名には依存しない（スタイル更新で名前が変わっても壊れないように）。
 */

/** まるごと消す種類。ラベル（symbol）は keepLabels のときだけ残す */
const HIDDEN_TYPES = new Set(['fill-extrusion', 'hillshade', 'heatmap', 'sky'])

/** 道路の縁取り。太い線の上に細い線を重ねる表現で、粗い画では汚れにしか見えない */
const CASE_SUFFIX = '-case'

/** 道路の太さの倍率。低解像度でも 1 ドット以上の幅を保たせる */
const ROAD_WIDTH_SCALE = 2.5

function hide(map: MapboxMap, layerId: string): void {
  try {
    map.setLayoutProperty(layerId, 'visibility', 'none')
  } catch {
    // スタイル側の都合で消えていることがある。1 レイヤーの失敗で全体を止めない
  }
}

function widen(map: MapboxMap, layerId: string): void {
  try {
    const width: unknown = map.getPaintProperty(layerId, 'line-width')
    // 数値か式のときだけ包める。旧形式の stops オブジェクトは触らない
    if (typeof width !== 'number' && !Array.isArray(width)) return
    map.setPaintProperty(layerId, 'line-width', ['*', width, ROAD_WIDTH_SCALE])
  } catch {
    // 同上
  }
}

export function simplifyForRetro(map: MapboxMap, keepLabels: boolean): void {
  const layers = map.getStyle()?.layers
  if (!layers) return

  for (const layer of layers) {
    if (HIDDEN_TYPES.has(layer.type)) {
      hide(map, layer.id)
      continue
    }

    if (layer.type === 'symbol') {
      // ラベルは Mapbox 配信の SDF フォントで描かれるため、粗くするとほぼ読めない。
      // ドットフォントに差し替えるところまでやらない限り、消したほうが画は締まる。
      if (!keepLabels) hide(map, layer.id)
      continue
    }

    if (layer.id.endsWith(CASE_SUFFIX)) {
      hide(map, layer.id)
      continue
    }

    if (layer.type === 'line' && layer.id.startsWith('road')) {
      widen(map, layer.id)
    }
  }
}
