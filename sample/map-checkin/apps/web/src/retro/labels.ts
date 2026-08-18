import mapboxgl from 'mapbox-gl'
import type { Map as MapboxMap } from 'mapbox-gl'

/**
 * 地名・施設名だけを、素の解像度で地図の上に重ねる。
 *
 * ドット絵の後処理は地図キャンバスを丸ごと縮小するので、文字も一緒に潰れて読めなくなる。
 * かといって文字だけ後処理から外すことは、1 枚のキャンバスに描かれている以上できない。
 *
 * そこで**ラベル専用の地図をもう 1 枚**作り、背景と塗り・線をすべて消して文字だけを描かせ、
 * 位置を本体へ追従させている。地図はドット絵、文字は素のまま、という重ね方になる。
 *
 * 代償として Mapbox の地図インスタンスが 2 つになり、同じベクタタイルを 2 回取りに行く。
 * spike なので割り切っているが、本採用するなら
 * 「ドットフォントを用意して 1 枚に戻す」か「文字だけ自前で描く」を検討すること。
 */

/** 文字は残す。それ以外は背景も含めて消す */
const KEPT_TYPE = 'symbol'

function stripToLabels(map: MapboxMap): void {
  const layers = map.getStyle()?.layers
  if (!layers) return

  for (const layer of layers) {
    if (layer.type === KEPT_TYPE) continue
    try {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
    } catch {
      // 1 レイヤーの失敗で全体を止めない
    }
  }
}

/**
 * @param base 位置を合わせる本体の地図
 * @param container ラベル用の地図を置く要素
 * @returns 後始末をする関数
 */
export function createLabelOverlay(
  base: MapboxMap,
  container: HTMLElement,
  style: string,
): () => void {
  const labelMap = new mapboxgl.Map({
    container,
    style,
    center: base.getCenter(),
    zoom: base.getZoom(),
    bearing: base.getBearing(),
    pitch: base.getPitch(),
    projection: 'mercator',
    // 操作は本体だけが受ける。こちらは表示専用
    interactive: false,
    // 帰属表示とロゴは本体側に出ている。二重に出さない
    attributionControl: false,
  })

  labelMap.on('style.load', () => stripToLabels(labelMap))

  // move は本体が動いている間ずっと発火する。jumpTo なので遅れずに追従する
  const sync = (): void => {
    labelMap.jumpTo({
      center: base.getCenter(),
      zoom: base.getZoom(),
      bearing: base.getBearing(),
      pitch: base.getPitch(),
    })
  }

  base.on('move', sync)
  base.on('resize', () => labelMap.resize())

  return () => {
    base.off('move', sync)
    labelMap.remove()
  }
}
