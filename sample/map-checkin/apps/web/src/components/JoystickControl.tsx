import { useCallback, useEffect, useRef, useState } from 'react'

interface JoystickControlProps {
  /** 1 フレームぶんの移動量（m）。east は東、north は北が正 */
  onMove: (eastM: number, northM: number) => void
  onClose: () => void
}

/** 中心からの最大引き出し距離（px）。これで倒し具合を正規化する */
const RADIUS = 44
/**
 * 最大まで倒したときの速さ（m/秒）。
 *
 * デバッグでスポット間を移動するための操作なので、徒歩の速さに寄せる意味はない。
 * 32m/秒（約115km/h）あれば、サンプルエリア（半径1.5km）の端から端まで 1 分弱で動ける。
 */
const MAX_SPEED_MPS = 32
/** この割合まではあそび。指を置いただけで動き出さないようにする */
const DEAD_ZONE = 0.12

interface Vector {
  x: number
  y: number
}

const ZERO: Vector = { x: 0, y: 0 }

/**
 * デバッグ用の仮想ジョイスティック。
 *
 * 位置情報が取れない環境（PC のブラウザ、権限を拒否した端末）でも、
 * チェックイン半径やクイズの導線を実際に歩かずに確認するためのもの。
 * 本番の機能ではないため、位置情報が有効なときは表示しない。
 */
export function JoystickControl({ onMove, onClose }: JoystickControlProps): React.JSX.Element {
  const baseRef = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState<Vector>(ZERO)

  // rAF から読むので ref に持つ。state だと 1 フレーム古い値を使ってしまう
  const vectorRef = useRef<Vector>(ZERO)
  const onMoveRef = useRef(onMove)
  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current
    if (!base) return

    const rect = base.getBoundingClientRect()
    const dx = clientX - (rect.left + rect.width / 2)
    const dy = clientY - (rect.top + rect.height / 2)
    const length = Math.hypot(dx, dy)

    // 円の外へ引っ張っても、つまみは縁で止める
    const clamped = length > RADIUS ? RADIUS / length : 1
    const next = { x: dx * clamped, y: dy * clamped }

    setKnob(next)
    vectorRef.current = next
  }, [])

  const release = useCallback(() => {
    setKnob(ZERO)
    vectorRef.current = ZERO
  }, [])

  /**
   * 倒している間だけ動かし続ける。
   *
   * pointermove のたびに動かすと、指を止めた瞬間に移動も止まってしまう。
   * ジョイスティックは「倒し続けている間ずっと動く」ものなので、
   * 毎フレーム経過時間ぶんだけ進める。
   */
  useEffect(() => {
    let handle = 0
    let last = performance.now()

    const tick = (now: number): void => {
      const deltaSec = Math.min(0.1, (now - last) / 1000)
      last = now

      const { x, y } = vectorRef.current
      const ratio = Math.hypot(x, y) / RADIUS

      if (ratio > DEAD_ZONE) {
        // あそびのぶんを差し引いてから正規化する（動き出しが滑らかになる）
        const power = ((ratio - DEAD_ZONE) / (1 - DEAD_ZONE)) ** 1.5
        const speed = MAX_SPEED_MPS * power * deltaSec
        const length = Math.hypot(x, y) || 1
        // 画面の下方向は南なので、north は符号を反転する
        onMoveRef.current((x / length) * speed, (-y / length) * speed)
      }

      handle = requestAnimationFrame(tick)
    }

    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [])

  return (
    <div className="joystick" role="group" aria-label="デバッグ用の移動操作">
      <div className="joystick__head">
        <span className="joystick__label">デバッグ移動</span>
        <button
          type="button"
          className="joystick__close"
          onClick={onClose}
          aria-label="デバッグ移動を閉じる"
        >
          ×
        </button>
      </div>

      <div
        ref={baseRef}
        className="joystick__base"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          updateFromPointer(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          updateFromPointer(event.clientX, event.clientY)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        // 地図のパンやページのスクロールに取られないようにする
        style={{ touchAction: 'none' }}
      >
        <span className="joystick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
    </div>
  )
}
