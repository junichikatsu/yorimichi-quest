import {
  AVATAR_ART_HEIGHT,
  AVATAR_ART_WIDTH,
  CLOTH_COLORS,
  composeAvatarArt,
  HAIR_COLORS,
  ITEM_COLORS,
  isItemKey,
  SKIN_COLORS,
  type Avatar,
} from '@imanouchi/shared'

/**
 * キャラクターの描画（FR-01-5・FR-02-8）。
 *
 * ★ **ドット絵で描く。** カードを 8bit のドット絵にしたので、キャラだけ滑らかだと
 * 世界観がずれる。以前はなめらかなベクタで描いており、コメントにもその判断が
 * 書かれていたが、**カードの見た目を決めた時点で前提が変わった**ため置き換えた。
 *
 * ★ 絵は `packages/shared/src/avatar-art.ts` に層で持つ。ここは
 * **文字を色に置き換えて打つだけ**にする。髪・服・肌の色は利用者が選ぶので、
 * 色を焼き込んだ絵を組み合わせぶん持つことはできない（256通りになる）。
 *
 * ★ 拡大は canvas の実寸ではなく `imageSmoothingEnabled = false` と倍率で行う。
 * 大きな canvas に太い四角を描くと、端末の拡大率で点の大きさが揃わない。
 */

export const SPRITE_WIDTH = AVATAR_ART_WIDTH
export const SPRITE_HEIGHT = AVATAR_ART_HEIGHT

/** 線画の色。真っ黒にすると硬くなるので、少し紫に寄せた濃色にする */
const LINE = '#2f2733'
/** 目の白 */
const EYE_WHITE = '#fbf7f4'
/** 瞳 */
const EYE_DARK = '#241f27'

export interface SpriteOptions {
  avatar: Avatar
  /**
   * 身につけている道具（FR-07-8）。
   *
   * ★ カードの絵では「その道具だけを装備した姿」を描くために使う。
   * 装備を選んで保存する機能そのものは別（#66 の B）。
   */
  equip?: readonly string[]
}

function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]

  const mixed = channels.map((channel) =>
    amount > 0
      ? Math.round(channel + (255 - channel) * amount)
      : Math.round(channel * (1 + amount)),
  )

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** 2色を混ぜる。頬のように「肌に少し寄せた色」を作るために使う */
function blend(a: string, b: string, ratio: number): string {
  const parse = (hex: string): number[] => {
    const value = Number.parseInt(hex.slice(1), 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  }

  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const mix = (x: number, y: number): number => Math.round(x + (y - x) * ratio)

  return `#${[mix(ar!, br!), mix(ag!, bg!), mix(ab!, bb!)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

/** 装備の主色。複数持っているときは最初のものに合わせる（層は別々に塗れない） */
function equipColor(equip: readonly string[] | undefined): string {
  const key = equip?.find((value) => isItemKey(value))
  return key && isItemKey(key) ? ITEM_COLORS[key] : '#a9a2b5'
}

export function drawSprite(
  target: HTMLCanvasElement,
  options: SpriteOptions,
  scale: number,
): void {
  const context = target.getContext('2d')
  if (!context) return

  const { avatar } = options
  const skin = SKIN_COLORS[avatar.skin] ?? SKIN_COLORS[0]!
  const hair = HAIR_COLORS[avatar.hairColor] ?? HAIR_COLORS[0]!
  const cloth = CLOTH_COLORS[avatar.clothColor] ?? CLOTH_COLORS[0]!
  const equip = equipColor(options.equip)

  const palette: Record<string, string> = {
    o: LINE,
    s: skin,
    S: shade(skin, -0.18),
    // ★ 頬は肌に赤みを混ぜる。固定のピンクにすると濃い肌色で浮く
    p: blend(skin, '#d8686a', 0.34),
    h: hair,
    H: shade(hair, -0.22),
    c: cloth,
    C: shade(cloth, -0.2),
    e: equip,
    E: shade(equip, -0.24),
    w: EYE_WHITE,
    k: EYE_DARK,
  }

  const art = composeAvatarArt({
    hair: avatar.hair,
    cloth: avatar.cloth,
    ...(options.equip ? { equip: options.equip } : {}),
  })

  const size = target.width / SPRITE_WIDTH || scale
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, target.width, target.height)

  for (const [y, row] of art.entries()) {
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x]
      if (ch === undefined || ch === '.') continue

      const fill = palette[ch]
      if (!fill) continue

      context.fillStyle = fill
      /*
       * ★ 端を整数に丸める。丸めないと拡大率が小数のときに点の間に隙間が出て、
       * 背景の色が線になって見える。
       */
      const left = Math.round(x * size)
      const top = Math.round(y * size)
      context.fillRect(left, top, Math.round((x + 1) * size) - left, Math.round((y + 1) * size) - top)
    }
  }
}
