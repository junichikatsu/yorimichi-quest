/**
 * 8bit 風ドット絵調表示の spike。
 *
 * `?retro=1` を付けたときだけ有効になる。既定の表示には一切影響しない。
 * 本採用するかどうかは実物を見てから決めるため、当面はこのフラグの内側に閉じておく。
 *
 * 3 段構えになっている。どれか 1 つでも欠けると「モザイクをかけただけ」に見える。
 *
 * 1. **解像度** — `window.devicePixelRatio` を差し替えて地図キャンバスを粗くする（index.ts）
 * 2. **情報量** — 細い道・縁取り・ラベルを間引き、道路を太らせる（simplify.ts）
 * 3. **色** — 合成後の画をパレットへ丸めて中間色を消す（quantize.ts / renderer.ts）
 *
 * 3 が要。色を丸めずに解像度だけ落とすと、アンチエイリアスの中間色がそのまま残り、
 * ドットの境界が立たないので写真にモザイクをかけた画にしかならない。
 */

export { nesColorThemeLut } from './lut.js'
export { createRetroRenderer, type RetroRenderer } from './renderer.js'
export { simplifyForRetro } from './simplify.js'

/**
 * 目標にするキャンバスの横幅（px）の既定値。
 *
 * ファミコンの横解像度に合わせている。コンテナの CSS 幅に関わらずこの幅へ寄せるので、
 * 画面が大きいほどドットも大きくなり、見た目の粗さは端末によらずだいたい揃う。
 */
const DEFAULT_CANVAS_WIDTH = 256

/** 幅の指定を受け付ける範囲。小さすぎると地図にならず、大きすぎるとドットが見えない */
const MIN_CANVAS_WIDTH = 64
const MAX_CANVAS_WIDTH = 1024

export interface RetroOptions {
  enabled: boolean
  /** 目標とするキャンバスの横幅（px）。`?retroWidth=` で変えられる */
  canvasWidth: number
  /** ラベル（地名・道路名）を残すか。`?retroLabels=1` で残る */
  keepLabels: boolean
}

function readWidth(raw: string | null): number {
  // Number(null) と Number('') は 0 になる。指定なしと 0 指定を混同しないよう先に弾く
  if (raw === null || raw.trim() === '') return DEFAULT_CANVAS_WIDTH
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_CANVAS_WIDTH
  return Math.min(MAX_CANVAS_WIDTH, Math.max(MIN_CANVAS_WIDTH, Math.round(parsed)))
}

function isOn(raw: string | null): boolean {
  return raw === '1' || raw === 'true'
}

/**
 * URL から表示の指定を読む。
 *
 * 見た目の好みは実物を見ないと決められないので、幅とラベルの有無だけ URL で振れるようにしてある。
 * 例: `?retro=1&retroWidth=160&retroLabels=1`
 */
export function readRetroOptions(search: string = window.location.search): RetroOptions {
  const params = new URLSearchParams(search)
  return {
    enabled: isOn(params.get('retro')),
    canvasWidth: readWidth(params.get('retroWidth')),
    keepLabels: isOn(params.get('retroLabels')),
  }
}

/*
 * ここから下は window.devicePixelRatio の差し替え。
 *
 * Mapbox GL JS はキャンバスの大きさを
 *
 *   canvas.width = devicePixelRatio * コンテナの CSS 幅   （バッキングストア）
 *   canvas.style.width = コンテナの CSS 幅                （表示上の大きさ）
 *
 * として決めていて、この devicePixelRatio を内部に保持せず毎回 window から読み直している。
 * つまりここを小さくすると、表示上の大きさはそのままでバッキングストアだけが粗くなる。
 *
 * **Mapbox の公開 API ではない**。実装が変われば効かなくなるので、
 * レトロ表示のときだけ、この 1 ファイルの中だけで完結させている。
 *
 * 霧のキャンバスも同じ window.devicePixelRatio を読んでいるため、
 * 何もしなくても地図と同じドットの粗さに揃う（MapView の drawFog）。
 */

/** 差し替え前のプロパティ。元に戻すために持っておく */
let nativeDescriptor: PropertyDescriptor | undefined
/** 差し替え前に window 自身が持っていた定義（通常は無い。あれば戻す） */
let ownDescriptorBefore: PropertyDescriptor | undefined
/** 実際に返す値。undefined なら本来の値をそのまま返す */
let overrideRatio: number | undefined

/** 差し替えを挟まない、本来の devicePixelRatio */
function nativeRatio(): number {
  const getter = nativeDescriptor?.get
  if (!getter) return 1
  return Number(getter.call(window)) || 1
}

function install(): void {
  if (nativeDescriptor !== undefined) return

  // window 自身ではなく Window.prototype に定義されている。
  // 見つからない環境では、差し替え前の値を返すだけの getter で代用する。
  const captured = window.devicePixelRatio || 1
  nativeDescriptor =
    Object.getOwnPropertyDescriptor(Window.prototype, 'devicePixelRatio') ??
    { get: () => captured, configurable: true }
  ownDescriptorBefore = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')

  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    get: () => overrideRatio ?? nativeRatio(),
  })
}

function uninstall(): void {
  if (nativeDescriptor === undefined) return

  if (ownDescriptorBefore) {
    Object.defineProperty(window, 'devicePixelRatio', ownDescriptorBefore)
  } else {
    // 自分が足した定義を消すと、prototype 側の本来の定義が再び見えるようになる
    delete (window as { devicePixelRatio?: number }).devicePixelRatio
  }

  nativeDescriptor = undefined
  ownDescriptorBefore = undefined
  overrideRatio = undefined
}

function update(container: HTMLElement, canvasWidth: number): void {
  const width = container.clientWidth
  // 端末本来の解像度より細かくはしない（粗くするための仕組みなので）
  overrideRatio = width > 0 ? Math.min(nativeRatio(), canvasWidth / width) : undefined
}

/**
 * 地図キャンバスを粗くする。**地図を作る前に呼ぶこと。**
 *
 * Mapbox 自身もコンテナの大きさを ResizeObserver で見てキャンバスを貼り直す。
 * 先に登録しておけば、Mapbox が読むより前にこちらの比率が更新される。
 *
 * @returns 後始末をする関数。地図を破棄するときに呼ぶ
 */
export function enableRetroPixelRatio(
  container: HTMLElement,
  canvasWidth: number = DEFAULT_CANVAS_WIDTH,
): () => void {
  install()
  update(container, canvasWidth)

  const observer = new ResizeObserver(() => update(container, canvasWidth))
  observer.observe(container)

  return () => {
    observer.disconnect()
    uninstall()
  }
}
