import mapboxgl from 'mapbox-gl'
import type { Map as MapboxMap } from 'mapbox-gl'

/**
 * 地名・施設名だけを、素の解像度で地図の上に重ねる。
 *
 * ドット絵の後処理は地図キャンバスを丸ごと縮小するので、文字も一緒に潰れて読めなくなる。
 * かといって文字だけ後処理から外すことは、1 枚のキャンバスに描かれている以上できない。
 *
 * そこで**ラベル専用の地図をもう 1 枚**作り、塗りと線をすべて消して文字だけを描かせ、
 * 位置を本体へ追従させている。地図はドット絵、文字は素のまま、という重ね方になる。
 *
 * 代償として Mapbox の地図インスタンスが 2 つになり、同じベクタタイルを 2 回取りに行く。
 * spike なので割り切っているが、本採用するなら
 * 「ドットフォントを用意して 1 枚に戻す」か「文字だけ自前で描く」を検討すること。
 */

/**
 * 文字も消すレイヤー。
 *
 * 標識・矢印・踏切は記号であって名前ではない。ドット絵の地図の上に乗せると
 * 情報量だけが増えて読みにくくなるので、名前だけを残す。
 */
const NOISY_LABEL_PATTERNS = [/shield/, /oneway-arrow/, /level-crossing/, /golf-hole/]

/** 背の高い建物名などは密度が上がりすぎるので、この大きさを下回るものは出さない */
const MIN_TEXT_SIZE = 11

/**
 * 出す POI の上限。Mapbox Streets の poi_label は filterrank（1 が最も目立つ）を持つ。
 * 既定のままだとコンビニまで全部出て、ドット絵の地図の上では騒がしくなる。
 */
const MAX_POI_RANK = 2

function stripToLabels(map: MapboxMap): void {
  // スタイルの fog（大気表現）は白一色で全画面を覆う。これを消さないと
  // 塗りを全部隠しても真っ白な面が残り、下のドット絵が見えなくなる。
  try {
    map.setFog(null)
  } catch {
    // fog を持たないスタイルもある
  }

  const layers = map.getStyle()?.layers
  if (!layers) return

  for (const layer of layers) {
    const noise =
      layer.type !== 'symbol' || NOISY_LABEL_PATTERNS.some((pattern) => pattern.test(layer.id))

    if (noise) {
      try {
        map.setLayoutProperty(layer.id, 'visibility', 'none')
      } catch {
        // 1 レイヤーの失敗で全体を止めない
      }
      continue
    }

    if (layer.id.startsWith('poi-label')) {
      try {
        map.setFilter(layer.id, ['<=', ['get', 'filterrank'], MAX_POI_RANK])
      } catch {
        // filterrank を持たないスタイルもある。そのときは全部出す
      }
    }

    // ドット絵の地図は色数が多く模様も細かい。既定の細い縁取りでは文字が沈むので、
    // 白で太く縁を取って、どの地物の上でも読めるようにする。
    try {
      map.setPaintProperty(layer.id, 'text-color', '#101010')
      map.setPaintProperty(layer.id, 'text-halo-color', '#ffffff')
      map.setPaintProperty(layer.id, 'text-halo-width', 2)
      map.setPaintProperty(layer.id, 'text-halo-blur', 0)
      // アイコンは出さない。名前だけでよい
      map.setPaintProperty(layer.id, 'icon-opacity', 0)
      // 日本語名があれば優先する。既定は英語表記で、日本の地図としては読みづらい
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', 'name_ja'],
        ['get', 'name'],
      ])
      // text-size は数値・式・未設定のいずれもありうる。
      // 未設定のまま式へ差し込むと 'undefined' value invalid で弾かれるので、数値のときだけ触る。
      const size: unknown = map.getLayoutProperty(layer.id, 'text-size')
      if (typeof size === 'number' && size < MIN_TEXT_SIZE) {
        map.setLayoutProperty(layer.id, 'text-size', MIN_TEXT_SIZE)
      }
    } catch {
      // アイコンだけのレイヤーなど、当てられないものは飛ばす
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
