import type { FogStyle } from './palette.js'
/**
 * 8bit 風ドット絵調表示の spike。
 *
 * `?retro=1` を付けたときだけ有効になる。既定の表示には一切影響しない。
 *
 * ## 作り
 *
 * 地図は**通常の解像度のまま描かせる**。そのうえで
 *
 *   地図キャンバス + 霧キャンバス → 縮小して合成 → パレットへ丸める → 拡大して表示
 *
 * という後処理を毎フレーム挟む（renderer.ts / quantize.ts）。
 * 縮小してから丸めるので、1 ドットが必ずパレットのどれか 1 色になり、境界が 1 ドットで切り替わる。
 *
 * 地名・施設名は**この後処理を通さず**、別レイヤーとして素の解像度で上に重ねる（labels.ts）。
 * 地図だけがドット絵になり、文字とスポットのピンはそのまま読める。
 *
 * ## 以前の版との違い
 *
 * 最初は `window.devicePixelRatio` を差し替えて Mapbox 自体に粗く描かせていたが、
 * それだとラベルも一緒に潰れて救えないため、後処理での縮小に変えた。
 * 非公式なやり方が 1 つ消え、細い道が描画時に消える問題も和らいでいる
 * （縮小時に平均されるので、1 ドット未満の線も色として残る）。
 */

export { createLabelOverlay } from './labels.js'
export type { FogStyle } from './palette.js'
export { createRetroRenderer, type RetroRenderer } from './renderer.js'
export { simplifyForRetro } from './simplify.js'

/**
 * ドットの細かさ（横に並ぶドットの数）の既定値。
 *
 * ファミコンの横解像度に合わせている。地図の表示幅に関わらずこの数へ寄せるので、
 * 画面が大きいほど 1 ドットが大きくなり、見た目の粗さは端末によらずだいたい揃う。
 */
const DEFAULT_DOT_WIDTH = 256

/** 受け付ける範囲。小さすぎると地図にならず、大きすぎるとドットが見えない */
const MIN_DOT_WIDTH = 64
const MAX_DOT_WIDTH = 1024

export interface RetroOptions {
  enabled: boolean
  /** 横に並ぶドットの数。`?retroWidth=` で変えられる */
  dotWidth: number
  /** 地名・施設名を素の解像度で重ねるか。`?retroLabels=0` で消せる */
  showLabels: boolean
  /** 未踏エリアの見せ方。`?retroFog=dither` で市松模様に戻せる */
  fogStyle: FogStyle
}

function readDotWidth(raw: string | null): number {
  // Number(null) と Number('') は 0 になる。指定なしと 0 指定を混同しないよう先に弾く
  if (raw === null || raw.trim() === '') return DEFAULT_DOT_WIDTH
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_DOT_WIDTH
  return Math.min(MAX_DOT_WIDTH, Math.max(MIN_DOT_WIDTH, Math.round(parsed)))
}

function isOn(raw: string | null): boolean {
  return raw === '1' || raw === 'true'
}

/**
 * URL から表示の指定を読む。
 *
 * 見た目の好みは実物を見ないと決められないので、粗さとラベルの有無を URL で振れるようにしてある。
 * 例: `?retro=1&retroWidth=160&retroLabels=0`
 */
export function readRetroOptions(search: string = window.location.search): RetroOptions {
  const params = new URLSearchParams(search)
  const labels = params.get('retroLabels')
  return {
    enabled: isOn(params.get('retro')),
    dotWidth: readDotWidth(params.get('retroWidth')),
    // 既定は表示。消したいときだけ明示的に 0 を渡す
    showLabels: labels === null ? true : isOn(labels),
    fogStyle: params.get('retroFog') === 'dither' ? 'dither' : 'shade',
  }
}
