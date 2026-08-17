/**
 * レトロ表示（8bit 風ドット絵調）の spike。
 *
 * `?retro=1` を付けたときだけ有効になる。既定の表示には一切影響しない。
 * 本採用するかどうかは実物を見てから決めるため、当面はこのフラグの内側に閉じておく。
 *
 * やっていることは 2 つだけ:
 *
 * 1. **色** — ファミコンのパレットへ寄せる LUT を `map.setColorTheme()` へ渡す
 * 2. **解像度** — `window.devicePixelRatio` を差し替えて地図キャンバスを粗くする
 *
 * ラベルのフォント、道路の太さ、マーカー、霧の形は手つかず。
 */

export { nesColorThemeLut } from './lut.js'

/**
 * レトロ表示で目標にするキャンバスの横幅（px）。
 *
 * ファミコンの横解像度に合わせている。コンテナの CSS 幅に関わらずこの幅へ寄せるので、
 * 画面が大きいほどドットが大きくなり、見た目の粗さは端末によらずだいたい揃う。
 */
const RETRO_CANVAS_WIDTH = 256

/** `?retro=1` が付いているか */
export function isRetroEnabled(search: string = window.location.search): boolean {
  const value = new URLSearchParams(search).get('retro')
  return value === '1' || value === 'true'
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
 * あとは canvas に image-rendering: pixelated を当てれば最近傍で拡大されてドットが立つ。
 *
 * **Mapbox の公開 API ではない**。実装が変われば効かなくなるので、
 * レトロ表示のときだけ、この 1 ファイルの中だけで完結させている。
 *
 * なお霧のキャンバスも同じ window.devicePixelRatio を読んでいるため、
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

function update(container: HTMLElement): void {
  const width = container.clientWidth
  // 端末本来の解像度より細かくはしない（粗くするための仕組みなので）
  overrideRatio = width > 0 ? Math.min(nativeRatio(), RETRO_CANVAS_WIDTH / width) : undefined
}

/**
 * 地図キャンバスを粗くする。**地図を作る前に呼ぶこと。**
 *
 * Mapbox 自身もコンテナの大きさを ResizeObserver で見てキャンバスを貼り直す。
 * 先に登録しておけば、Mapbox が読むより前にこちらの比率が更新される。
 *
 * @returns 後始末をする関数。地図を破棄するときに呼ぶ
 */
export function enableRetroPixelRatio(container: HTMLElement): () => void {
  install()
  update(container)

  const observer = new ResizeObserver(() => update(container))
  observer.observe(container)

  return () => {
    observer.disconnect()
    uninstall()
  }
}
