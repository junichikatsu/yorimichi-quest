import type { Avatar, Equipment } from '@map-checkin/shared'
import { useEffect, useRef } from 'react'
import {
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  drawSprite,
  type Direction,
} from '../avatar/sprite.js'

interface AvatarCanvasProps {
  avatar: Avatar
  equipment: Equipment
  /** 拡大率。整数にしないとドットがにじむ */
  scale: number
  /** 歩行アニメーションを再生するか */
  animated?: boolean
  direction?: Direction
  label?: string
}

/** 4 コマの歩行アニメーションの 1 コマあたりの時間（ms） */
const FRAME_DURATION_MS = 220

/**
 * ドット絵キャラクターを描くキャンバス。
 *
 * キャラメイク画面・マイページ・地図上のマーカーで同じ描画を使うため、
 * 拡大率だけを変えて共有している。
 */
export function AvatarCanvas({
  avatar,
  equipment,
  scale,
  animated = false,
  direction = 'down',
  label,
}: AvatarCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 静止画なら 1 回描いて終わり。requestAnimationFrame を回し続けない
    if (!animated) {
      drawSprite(canvas, { avatar, equipment, frame: 0, moving: false, direction }, scale)
      return
    }

    let handle = 0
    const start = performance.now()

    const tick = (now: number): void => {
      const frame = Math.floor((now - start) / FRAME_DURATION_MS)
      drawSprite(canvas, { avatar, equipment, frame, moving: true, direction }, scale)
      handle = requestAnimationFrame(tick)
    }

    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [avatar, equipment, scale, animated, direction])

  return (
    <canvas
      ref={canvasRef}
      className="avatar-canvas"
      width={SPRITE_WIDTH * scale}
      height={SPRITE_HEIGHT * scale}
      role="img"
      aria-label={label ?? `${avatar.name} のすがた`}
    />
  )
}
