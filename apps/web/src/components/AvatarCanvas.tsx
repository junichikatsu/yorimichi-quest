import type { Avatar } from '@imanouchi/shared'
import { useEffect, useRef } from 'react'
import {
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  drawSprite,
  type Condition,
  type Direction,
} from '../avatar/sprite.js'

interface AvatarCanvasProps {
  avatar: Avatar
  /** 表示倍率。1 点あたりの画素数になる */
  scale: number
  /** 身につけている道具（FR-07-8）。地図とキャラメイクで姿に出す */
  equip?: readonly string[]
  /** 歩行アニメーションを再生するか */
  animated?: boolean
  direction?: Direction
  /** 状態（#72）。浸水想定区域の中では濡れた見た目にする */
  condition?: Condition
  label?: string
}

/** 4 コマの歩行アニメーションの 1 コマあたりの時間（ms） */
const FRAME_DURATION_MS = 220

/**
 * ドット絵キャラクターを描くキャンバス。
 *
 * キャラメイク画面・ヘッダー・地図上のマーカー・歩行中の覆いで同じ描画を使うため、
 * 拡大率だけを変えて共有している。
 *
 * ★ 向きと歩行は**正面の絵を加工して作る**（`faceArt` と上下動）。方向ごとに
 * 絵を持たない。4方向×4コマを手描きのドット絵で用意すると数百枚になる。
 */
export function AvatarCanvas({
  avatar,
  scale,
  equip,
  animated = false,
  direction = 'down',
  condition = 'dry',
  label,
}: AvatarCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /*
     * ★ 実寸は 1 点 = scale 画素で確保する（devicePixelRatio は掛けない）。
     * ドット絵は点の大きさが揃っていることが要点で、端末ごとに実寸を変えると
     * 点の境目が不均等になる。
     */
    canvas.width = SPRITE_WIDTH * scale
    canvas.height = SPRITE_HEIGHT * scale
    canvas.style.width = `${SPRITE_WIDTH * scale}px`
    canvas.style.height = `${SPRITE_HEIGHT * scale}px`

    const base = { avatar, direction, condition, ...(equip ? { equip } : {}) }

    /*
     * 静止画なら 1 回描いて終わり。requestAnimationFrame を回し続けない。
     *
     * ★ 動きを減らす設定のときも回さない（NFR-08）。**出ること自体は変えず**、
     * 歩くアニメーションだけを止める。歩行中の覆いの上で回り続けると、
     * 見せたくない動きが画面の中央で延々と続く。
     */
    const still = !animated || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (still) {
      drawSprite(canvas, { ...base, frame: 0, moving: false }, scale)
      return
    }

    let handle = 0
    const start = performance.now()

    const tick = (now: number): void => {
      const frame = Math.floor((now - start) / FRAME_DURATION_MS)
      drawSprite(canvas, { ...base, frame, moving: true }, scale)
      handle = requestAnimationFrame(tick)
    }

    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [avatar, scale, equip, animated, direction, condition])

  return (
    <canvas
      ref={canvasRef}
      className="avatar-canvas"
      role="img"
      aria-label={label ?? `${avatar.name} のすがた`}
    />
  )
}
