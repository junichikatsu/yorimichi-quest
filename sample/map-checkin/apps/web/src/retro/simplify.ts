import type { DataDrivenPropertyValueSpecification, Map as MapboxMap } from 'mapbox-gl'
import { GAME_COLORS } from './palette.js'

/**
 * 地図をゲーム画面らしく塗り替え、情報量を落とす。
 *
 * ドット絵に見えない原因の半分は解像度ではなく**何がどう描かれているか**にある。
 * streets-v12 は細い道・縁取り・地下の通路まで持っていて、横 256 ドットでは
 * それらが 1 ドット未満の粒＝ノイズになる。色も現実の地図向けで、近い色ばかり並ぶ。
 *
 * ここでやること
 *
 * 1. 地物ごとに色を決め打ちする（palette.ts）
 * 2. 道路の太さを**ズームに依らないドット数**で固定する
 * 3. 地下・歩道・鉄道・境界など、粗い画では読めないものを消す
 *
 * 本来はカスタムスタイルを書き起こすところだが、spike なので読み込み済みのスタイルを書き換える。
 * 判定は id の規則だけで、個別のレイヤー名の一覧には依存しない。
 */

/** 消すもの。粗い画では読めないか、ノイズにしかならないもの */
const HIDDEN_PATTERNS = [
  /^tunnel-/, // 地下は見えなくてよい
  /-case$/, // 道路の縁取り。ベタ塗りにしたいので邪魔
  /-bg$/,
  /shadow|-depth|underground|-outline/,
  /path|steps|pedestrian|construction|golf|ferry|aerialway|turning-feature/,
  /rail/,
  // 路地・私道まで描くと道路だけで画面の 3 分の 1 が埋まる。
  // ゲームの地図が読めるのは、通れる道を絞って描いているから。
  /^road-minor|^bridge-minor|-street-low$/,
  /crosswalk/,
  /^admin-/,
  /hillshade|aeroway|land-structure/,
]

/** 消すレイヤー種別。文字は別レイヤー（labels.ts）で素の解像度のまま重ねる */
const HIDDEN_TYPES = new Set(['symbol', 'fill-extrusion', 'hillshade', 'heatmap', 'sky'])

/**
 * 道路の太さ（ドット数）。**ズームに依らない固定値**にする。
 *
 * 元のスタイルは line-width をズームの式で持っている。ズームアウトすると 1 ドットより細くなり、
 * 縮小の平均に溶けて消えてしまう。「ズームアウトすると分かりづらい」の主因がこれ。
 *
 * なお元の式に倍率を掛ける形（`['*', 元の式, 2.5]`）は**使えない**。
 * Mapbox は zoom 式が step / interpolate の最上位にあることを要求するため、
 * 掛け算で包むと式ごと拒否される（以前の実装はこれで全滅していた）。
 */
const ROAD_DOTS: readonly (readonly [RegExp, number])[] = [
  [/motorway|trunk/, 4],
  [/primary/, 3],
  [/secondary|tertiary/, 2],
  [/-street/, 1.5],
  [/link/, 1.5],
]

/**
 * この太さ以上を幹線とみなし、琥珀で塗る。
 *
 * 彩度が高い色なので、面積が増えると目が疲れる。高速道路と国道だけに絞る。
 */
const MAJOR_ROAD_DOTS = 4

function isHidden(id: string, type: string): boolean {
  if (HIDDEN_TYPES.has(type)) return true
  return HIDDEN_PATTERNS.some((pattern) => pattern.test(id))
}

/** 道路系のレイヤーか。橋も地上の道路として扱う */
function roadDots(id: string): number | undefined {
  if (!id.startsWith('road-') && !id.startsWith('bridge-')) return undefined
  for (const [pattern, dots] of ROAD_DOTS) {
    if (pattern.test(id)) return dots
  }
  return undefined
}

/**
 * 緑で塗る土地の種別。
 *
 * landuse レイヤーは公園だけでなく住宅地・商業地・病院なども抱えている。
 * ここを一律に緑へ塗ると都心が森になってしまうので、種別で振り分ける。
 */
const GREEN_CLASSES = [
  'park',
  'grass',
  'pitch',
  'garden',
  'playground',
  'cemetery',
  'wood',
  'scrub',
  'agriculture',
  'national_park',
  'golf_course',
]

function colorOf(id: string, type: string): ColorValue | undefined {
  if (type === 'background' || id === 'land') return GAME_COLORS.land
  if (/water/.test(id)) return GAME_COLORS.water
  if (/landcover|national-park/.test(id)) return GAME_COLORS.green
  // 種別で緑か地面かを決める。該当しない土地は地面に溶かして、図と地を単純に保つ
  if (/landuse/.test(id)) {
    return ['match', ['get', 'class'], GREEN_CLASSES, GAME_COLORS.green, GAME_COLORS.land]
  }
  if (/building/.test(id)) return GAME_COLORS.building
  return undefined
}

/**
 * 色として渡せるもの。単色か、地物の属性で振り分ける式。
 *
 * 式の型は Mapbox 側が細かく分けているが、ここで組み立てるのは match 1 種類だけなので、
 * setPaintProperty へ渡すところで受け側の型に合わせる。
 */
type ColorValue = string | DataDrivenPropertyValueSpecification<string>

type ColorProperty = 'background-color' | 'fill-color' | 'line-color'

function paintPropertyFor(type: string): ColorProperty | undefined {
  if (type === 'background') return 'background-color'
  if (type === 'fill') return 'fill-color'
  if (type === 'line') return 'line-color'
  return undefined
}

/** 失敗しても 1 レイヤーで止める。スタイル更新で構成が変わっても全体は動かしたい */
function tryApply(label: string, apply: () => void): void {
  try {
    apply()
  } catch (error) {
    console.warn(`[retro] ${label} をスキップしました`, error)
  }
}

/**
 * @param dotScale 1 ドットが地図上の何 px にあたるか（地図の表示幅 ÷ 横のドット数）
 */
export function simplifyForRetro(map: MapboxMap, dotScale: number): void {
  // スタイルの fog（大気表現）は白一色。地物の色の上に薄く乗って彩度を落とすので消す
  tryApply('fog', () => map.setFog(null))

  const layers = map.getStyle()?.layers
  if (!layers) return

  for (const layer of layers) {
    const { id, type } = layer

    if (isHidden(id, type)) {
      tryApply(`hide ${id}`, () => map.setLayoutProperty(id, 'visibility', 'none'))
      continue
    }

    const dots = roadDots(id)
    if (dots !== undefined) {
      tryApply(`width ${id}`, () => map.setPaintProperty(id, 'line-width', dots * dotScale))
      tryApply(`color ${id}`, () =>
        map.setPaintProperty(
          id,
          'line-color',
          dots >= MAJOR_ROAD_DOTS ? GAME_COLORS.roadMajor : GAME_COLORS.roadMinor,
        ),
      )
      // 破線や透明度のズーム式が残っていると、粗い画では点線が粒になる
      tryApply(`opacity ${id}`, () => map.setPaintProperty(id, 'line-opacity', 1))
      continue
    }

    const color = colorOf(id, type)
    const property = paintPropertyFor(type)
    if (color && property) {
      tryApply(`color ${id}`, () => map.setPaintProperty(id, property, color))
      // 塗りの縁取りは中と同じ色にしておく。既定のままだと 1 ドットの筋が残る
      if (type === 'fill') {
        tryApply(`outline ${id}`, () => map.setPaintProperty(id, 'fill-outline-color', color))
        tryApply(`opacity ${id}`, () => map.setPaintProperty(id, 'fill-opacity', 1))
      }
    }
  }
}
