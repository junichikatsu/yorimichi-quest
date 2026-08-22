import type { Avatar } from '@imanouchi/shared'
import { useEffect, useRef } from 'react'
import { SPRITE_HEIGHT, SPRITE_WIDTH, drawSprite } from '../avatar/sprite.js'

interface AvatarCanvasProps {
  avatar: Avatar
  /** 表示倍率。1 点あたりの画素数になる */
  scale: number
  /** 身につけている道具（FR-07-8）。カードの絵で使う */
  equip?: readonly string[]
  label?: string
}

/**
 * ドット絵キャラクターを描くキャンバス。
 *
 * キャラメイク画面・ヘッダー・地図上のマーカーで同じ描画を使うため、
 * 拡大率だけを変えて共有している。
 *
 * ★ 向きと歩行アニメーションは持たない。**正面・静止の1枚だけ**にしてある
 * （4方向×4コマを手描きのドット絵で用意すると数百枚になる）。
 */
export function AvatarCanvas({
  avatar,
  scale,
  equip,
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

    drawSprite(canvas, equip ? { avatar, equip } : { avatar }, scale)
  }, [avatar, scale, equip])

  return (
    <canvas
      ref={canvasRef}
      className="avatar-canvas"
      role="img"
      aria-label={label ?? `${avatar.name} のすがた`}
    />
  )
}
