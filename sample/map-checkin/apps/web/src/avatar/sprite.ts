import {
  CLOTH_COLORS,
  HAIR_COLORS,
  SKIN_COLORS,
  type Avatar,
  type Equipment,
  type ItemKey,
} from '@map-checkin/shared'

/**
 * ドット絵キャラクターの描画。
 *
 * `sample/battle-prototype/index.html` の描画処理を TypeScript へ移植したもの。
 * 座標はすべて 28×36 のスプライト内のピクセル単位で、拡大は描画側が
 * `image-rendering: pixelated` 相当（drawImage + imageSmoothingEnabled=false）で行う。
 */

export const SPRITE_WIDTH = 28
export const SPRITE_HEIGHT = 36
/** スプライト内の中心 X。すべてのパーツはここを基準に置く */
const CX = 14

export type Direction = 'down' | 'up' | 'left' | 'right'

export interface SpriteOptions {
  avatar: Avatar
  equipment: Equipment
  /** 歩行アニメーションのコマ。4 コマ周期 */
  frame: number
  moving: boolean
  direction: Direction
}

type Ctx = CanvasRenderingContext2D

/** 色を明るく（amt > 0）／暗く（amt < 0）する */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  if (amt > 0) {
    r += (255 - r) * amt
    g += (255 - g) * amt
    b += (255 - b) * amt
  } else {
    r *= 1 + amt
    g *= 1 + amt
    b *= 1 + amt
  }
  return `#${((1 << 24) + ((r & 255) << 16) + ((g & 255) << 8) + (b | 0 & 255)).toString(16).slice(1)}`
}

/** 上辺を明るく、下辺を暗くした立体感のある矩形 */
function block(g: Ctx, x: number, y: number, w: number, h: number, base: string, oy: number): void {
  const top = y + oy
  g.fillStyle = base
  g.fillRect(x, top, w, h)
  g.fillStyle = shade(base, 0.2)
  g.fillRect(x, top, w, 1)
  g.fillStyle = shade(base, 0.1)
  g.fillRect(x, top + 1, 1, h - 2)
  g.fillStyle = shade(base, -0.24)
  g.fillRect(x, top + h - 1, w, 1)
  g.fillStyle = shade(base, -0.16)
  g.fillRect(x + w - 1, top + 1, 1, h - 2)
}

function paintChar(g: Ctx, o: SpriteOptions): void {
  const { avatar } = o
  const skin = SKIN_COLORS[avatar.skin] ?? SKIN_COLORS[0]
  const hair = HAIR_COLORS[avatar.hairColor] ?? HAIR_COLORS[0]
  const cloth = CLOTH_COLORS[avatar.clothColor] ?? CLOTH_COLORS[0]
  const lighten = (c: string): string => shade(c, 0.22)

  const f = o.frame | 0
  const moving = o.moving
  const dir = o.direction

  const leg = moving ? ([0, 2, 0, -2][f % 4] ?? 0) : 0
  const arm = moving ? ([0, 1, 0, -1][f % 4] ?? 0) : 0
  const bob = moving ? (f % 4 === 1 || f % 4 === 3 ? -1 : 0) : 0

  const P = (x: number, y: number, w: number, h: number, c: string): void => {
    g.fillStyle = c
    g.fillRect(x, y + bob, w, h)
  }

  // 影
  g.save()
  g.globalAlpha = 0.32
  g.fillStyle = '#20263a'
  g.beginPath()
  g.ellipse(CX, 33.4, 7, 2.1, 0, 0, 7)
  g.fill()
  g.restore()

  // 脚・靴
  const shoe = '#41372c'
  const shoeHi = '#5a4c3b'
  const pants = '#39405a'
  block(g, CX - 4, 26, 3, 5, pants, bob)
  block(g, CX + 1, 26, 3, 5, pants, bob)
  P(CX - 4, 31 - (leg > 0 ? 1 : 0), 3, 2 + (leg > 0 ? 1 : 0), shoe)
  P(CX - 4, 31 - (leg > 0 ? 1 : 0), 3, 1, shoeHi)
  P(CX + 1, 31 - (leg < 0 ? 1 : 0), 3, 2 + (leg < 0 ? 1 : 0), shoe)
  P(CX + 1, 31 - (leg < 0 ? 1 : 0), 3, 1, shoeHi)

  // 胴・腕
  block(g, CX - 5, 15, 10, 11, cloth, bob)
  P(CX - 5, 15, 10, 1, lighten(cloth))
  P(CX - 1, 16, 2, 9, shade(cloth, -0.1))
  block(g, CX - 7, 16 + arm, 2, 7, shade(cloth, -0.06), bob)
  block(g, CX + 5, 16 - arm, 2, 7, shade(cloth, -0.06), bob)
  P(CX - 7, 16 + arm + 7, 2, 1, skin)
  P(CX + 5, 16 - arm + 7, 2, 1, skin)
  P(CX - 2, 13, 4, 2, shade(skin, -0.16))

  // 頭
  block(g, CX - 5, 4, 10, 10, skin, bob)
  const clr = (x: number, y: number, w: number, h: number): void => {
    g.clearRect(x, y + bob, w, h)
  }
  clr(CX - 5, 4, 2, 1)
  clr(CX - 5, 4, 1, 2)
  clr(CX + 3, 4, 2, 1)
  clr(CX + 4, 4, 1, 2)
  clr(CX - 5, 13, 2, 1)
  clr(CX - 5, 12, 1, 1)
  clr(CX + 3, 13, 2, 1)
  clr(CX + 4, 12, 1, 1)
  P(CX - 5, 10, 1, 3, shade(skin, -0.16))
  P(CX + 4, 10, 1, 3, shade(skin, -0.16))

  if (dir !== 'up') {
    const ex = dir === 'left' ? -2 : dir === 'right' ? 2 : 0
    P(CX - 4, 11, 2, 1, '#e79a92')
    P(CX + 2, 11, 2, 1, '#e79a92')
    const eye = (x: number): void => {
      P(x, 8, 2, 3, '#fbf7ef')
      P(x, 9, 2, 2, '#3a2f4a')
      P(x, 9, 1, 1, '#8a7bd8')
    }
    eye(CX - 4 + ex)
    eye(CX + 2 + ex)
    P(CX - 4 + ex, 7, 2, 1, shade(hair, -0.2))
    P(CX + 2 + ex, 7, 2, 1, shade(hair, -0.2))
    if (dir === 'down') {
      P(CX, 10, 1, 1, shade(skin, -0.22))
      P(CX - 1, 12, 3, 1, '#c8635f')
    }
  } else {
    P(CX - 4, 6, 8, 7, hair)
    P(CX - 4, 6, 8, 1, shade(hair, 0.2))
    P(CX - 1, 9, 2, 3, shade(hair, -0.2))
  }

  // 髪型
  const hHi = lighten(hair)
  const hSh = shade(hair, -0.28)
  const H = (x: number, y: number, w: number, h: number, c?: string): void => {
    P(x, y, w, h, c ?? hair)
  }
  switch (avatar.hair) {
    case 0:
      H(CX - 5, 2, 10, 4); H(CX - 6, 3, 1, 4); H(CX + 5, 3, 1, 4)
      H(CX - 5, 2, 10, 1, hHi); H(CX - 5, 5, 2, 1, hSh); H(CX + 3, 5, 2, 1, hSh)
      break
    case 1:
      H(CX - 5, 2, 10, 4); H(CX - 6, 3, 1, 10); H(CX + 5, 3, 1, 10)
      H(CX - 6, 13, 2, 2, hSh); H(CX + 4, 13, 2, 2, hSh); H(CX - 5, 2, 10, 1, hHi)
      break
    case 2:
      H(CX - 5, 2, 10, 4); H(CX - 6, 3, 1, 4); H(CX + 5, 3, 1, 7)
      H(CX + 6, 6, 1, 6, hSh); H(CX + 5, 11, 2, 2, hSh); H(CX - 5, 2, 9, 1, hHi)
      break
    case 3:
      H(CX - 5, 2, 10, 4); H(CX - 7, 4, 2, 7); H(CX + 5, 4, 2, 7)
      H(CX - 7, 10, 2, 2, hSh); H(CX + 5, 10, 2, 2, hSh); H(CX - 5, 2, 10, 1, hHi)
      break
    case 4:
      H(CX - 5, 3, 10, 3); H(CX - 4, 1, 2, 3); H(CX - 1, 0, 2, 4); H(CX + 2, 1, 2, 3)
      H(CX + 4, 2, 2, 3); H(CX - 6, 4, 1, 3); H(CX + 5, 4, 1, 3); H(CX - 1, 0, 2, 1, hHi)
      break
    case 5:
      H(CX - 6, 2, 12, 4); H(CX - 6, 4, 1, 6); H(CX + 5, 4, 1, 6)
      H(CX - 6, 9, 2, 1, hSh); H(CX + 4, 9, 2, 1, hSh); H(CX - 6, 2, 12, 1, hHi)
      break
    case 6:
      H(CX - 6, 2, 12, 4); H(CX - 7, 3, 1, 3); H(CX + 6, 3, 1, 3)
      H(CX - 5, 3, 1, 1, hHi); H(CX - 1, 2, 2, 1, hHi); H(CX + 4, 3, 1, 1, hHi)
      H(CX - 6, 5, 1, 1, hSh); H(CX + 5, 5, 1, 1, hSh)
      break
    case 7: {
      const cap = cloth
      H(CX - 5, 3, 10, 1, hair)
      block(g, CX - 6, 1, 12, 3, cap, bob)
      P(CX - 6, 4, 9, 1, shade(cap, -0.3))
      P(CX - 6, 1, 12, 1, shade(cap, 0.25))
      break
    }
    case 8: {
      const hd = shade(cloth, -0.05)
      block(g, CX - 6, 1, 12, 4, hd, bob)
      P(CX - 7, 3, 1, 9, shade(hd, -0.2))
      P(CX + 6, 3, 1, 9, shade(hd, -0.2))
      P(CX - 6, 1, 12, 1, shade(hd, 0.2))
      H(CX - 4, 4, 8, 1, hair)
      break
    }
    case 9:
      H(CX - 5, 2, 10, 4); H(CX - 6, 3, 1, 4); H(CX + 5, 3, 1, 4)
      P(CX - 6, 4, 12, 1, '#d8503f'); P(CX + 5, 5, 2, 3, '#d8503f'); H(CX - 5, 2, 10, 1, hHi)
      break
    default:
      break
  }

  // 服の意匠
  const cHi = lighten(cloth)
  const cSh = shade(cloth, -0.22)
  switch (avatar.cloth) {
    case 0:
      P(CX - 1, 15, 2, 10, cSh)
      break
    case 1:
      P(CX - 5, 14, 10, 2, cSh); P(CX - 2, 16, 4, 3, cSh)
      P(CX - 5, 20, 1, 3, cHi); P(CX + 4, 20, 1, 3, cHi)
      break
    case 2:
      P(CX - 1, 15, 2, 10, '#efe9db'); P(CX - 4, 15, 1, 10, cSh); P(CX + 3, 15, 1, 10, cSh)
      break
    case 3:
      block(g, CX - 5, 15, 10, 11, '#e8d24a', bob)
      P(CX - 5, 15, 10, 1, '#fff3b8'); P(CX - 1, 16, 2, 9, '#c9a92f')
      break
    case 4:
      P(CX - 5, 15, 10, 2, '#f2eee2'); P(CX - 1, 17, 2, 4, '#c8503f'); P(CX - 5, 15, 10, 1, '#ffffff')
      break
    case 5:
      P(CX - 6, 24, 12, 4, cloth); P(CX - 6, 27, 12, 1, cSh); P(CX - 6, 24, 12, 1, cHi)
      break
    case 6:
      P(CX - 7, 15, 2, 8, '#7a5c3a'); P(CX + 5, 16, 1, 7, '#5b4429'); P(CX - 2, 15, 4, 2, '#5b4429')
      break
    case 7:
      P(CX - 1, 15, 2, 10, '#f2eee2'); P(CX - 5, 20, 10, 1, '#2f3446'); P(CX - 5, 15, 10, 1, cHi)
      break
    case 8:
      P(CX - 5, 17, 10, 1, '#f7f7e8'); P(CX - 5, 20, 10, 1, '#f7f7e8')
      P(CX - 5, 15, 10, 1, '#ffd451'); P(CX - 4, 16, 2, 8, shade('#ffd451', -0.1))
      break
    case 9:
      P(CX - 5, 24, 10, 4, cSh); P(CX - 1, 15, 2, 13, cSh); P(CX - 5, 15, 10, 1, cHi)
      break
    default:
      break
  }

  // 右上からの光を表すハイライト
  const highlight = '#fff6df'
  g.save()
  g.globalAlpha = 0.5
  P(CX + 4, 4, 1, 3, highlight)
  P(CX + 3, 3, 2, 1, highlight)
  P(CX + 4, 15, 1, 5, highlight)
  g.restore()
}

/**
 * 装備レイヤー。素体の上に重ねる。座標系は paintChar と同一。
 *
 * アイテムキーと 1 対 1 で対応させているため、
 * 装備を変えるとその場で見た目が変わる（FR-07-8 の「集めた実感」）。
 */
const EQUIP_LAYERS: Partial<Record<ItemKey, (g: Ctx) => void>> = {
  helmet(g) {
    const c = '#f2c33a'
    g.fillStyle = shade(c, -0.15); g.fillRect(CX - 6, 3, 12, 4)
    g.fillStyle = c; g.fillRect(CX - 5, 1, 10, 4)
    g.fillStyle = shade(c, 0.25); g.fillRect(CX - 5, 1, 10, 1)
    g.fillStyle = shade(c, -0.3); g.fillRect(CX - 6, 6, 12, 1)
    g.fillStyle = '#d84f3f'; g.fillRect(CX - 1, 2, 2, 3)
  },
  zukin(g) {
    const c = '#3a4a72'
    g.fillStyle = c; g.fillRect(CX - 5, 2, 10, 4)
    g.clearRect(CX - 5, 2, 1, 1); g.clearRect(CX + 4, 2, 1, 1)
    g.fillStyle = shade(c, 0.22); g.fillRect(CX - 5, 2, 10, 1)
    g.fillStyle = shade(c, -0.06)
    g.fillRect(CX - 6, 5, 2, 9); g.fillRect(CX + 4, 5, 2, 9)
    g.fillRect(CX - 5, 5, 2, 1); g.fillRect(CX + 3, 5, 2, 1)
    g.fillStyle = shade(c, -0.32); g.fillRect(CX - 4, 6, 1, 6); g.fillRect(CX + 3, 6, 1, 6)
    g.fillStyle = shade(c, -0.22); g.fillRect(CX - 6, 12, 12, 2)
  },
  headlight(g) {
    g.fillStyle = '#2c3242'; g.fillRect(CX - 6, 4, 12, 2)
    g.fillStyle = '#e8e2d0'; g.fillRect(CX - 2, 3, 4, 3)
    g.fillStyle = '#fff7cf'; g.fillRect(CX - 1, 4, 2, 1)
    g.save()
    g.globalAlpha = 0.5
    g.fillStyle = '#fff3b0'
    g.beginPath(); g.moveTo(CX, 5); g.lineTo(CX - 6, -3); g.lineTo(CX + 6, -3); g.closePath(); g.fill()
    g.restore()
  },
  raincoat(g) {
    const c = '#e8d24a'
    g.fillStyle = c; g.fillRect(CX - 6, 14, 12, 13)
    g.fillStyle = shade(c, 0.22); g.fillRect(CX - 6, 14, 12, 1)
    g.fillStyle = shade(c, -0.18); g.fillRect(CX - 1, 15, 2, 12)
    g.fillStyle = shade(c, -0.1); g.fillRect(CX - 7, 15, 2, 8); g.fillRect(CX + 5, 15, 2, 8)
    g.fillStyle = shade(c, -0.2); g.fillRect(CX - 5, 13, 10, 2)
  },
  gloves(g) {
    const c = '#e6e0cf'
    g.fillStyle = c; g.fillRect(CX - 7, 22, 3, 3); g.fillRect(CX + 4, 22, 3, 3)
    g.fillStyle = shade(c, -0.2); g.fillRect(CX - 7, 24, 3, 1); g.fillRect(CX + 4, 24, 3, 1)
  },
  tank(g) {
    const c = '#5aa8d8'
    g.fillStyle = c; g.fillRect(CX + 4, 23, 5, 6)
    g.fillStyle = shade(c, 0.2); g.fillRect(CX + 4, 23, 5, 1)
    g.fillStyle = shade(c, -0.25); g.fillRect(CX + 4, 28, 5, 1)
    g.fillStyle = '#3a4a55'; g.fillRect(CX + 5, 22, 3, 1)
    g.fillStyle = '#eaf4fb'; g.fillRect(CX + 5, 25, 1, 2)
  },
  book(g) {
    g.fillStyle = '#c85a3f'; g.fillRect(CX - 9, 22, 5, 6)
    g.fillStyle = '#f2ead9'; g.fillRect(CX - 8, 23, 4, 4)
    g.fillStyle = '#3a7a4a'; g.fillRect(CX - 8, 24, 4, 1)
    g.fillStyle = '#3f7fb0'; g.fillRect(CX - 8, 26, 4, 1)
  },
  whistle(g) {
    g.fillStyle = '#d8503f'; g.fillRect(CX - 1, 14, 2, 4)
    g.fillStyle = '#e0b24a'; g.fillRect(CX - 2, 17, 4, 3)
    g.fillStyle = shade('#e0b24a', 0.25); g.fillRect(CX - 2, 17, 4, 1)
  },
  radio(g) {
    const c = '#4a5170'
    g.fillStyle = c; g.fillRect(CX - 8, 16, 3, 7)
    g.fillStyle = shade(c, 0.2); g.fillRect(CX - 8, 16, 3, 1)
    g.fillStyle = '#e0b24a'; g.fillRect(CX - 7, 17, 1, 1)
    g.fillStyle = '#8fe6c0'; g.fillRect(CX - 8, 15, 1, 2)
  },
  potatoilet(g) {
    const c = '#6f9a5a'
    g.fillStyle = c; g.fillRect(CX + 5, 17, 3, 6)
    g.fillStyle = shade(c, 0.2); g.fillRect(CX + 5, 17, 3, 1)
    g.fillStyle = '#eef0e0'; g.fillRect(CX + 6, 19, 1, 2)
  },
}

/**
 * 作業用キャンバスは 2 枚だけ使い回す。
 *
 * 呼び出しのたびに createElement すると、歩行アニメーション（毎フレーム）で
 * キャンバスが積み上がってメモリを食う。
 */
let workCanvas: HTMLCanvasElement | undefined
let outCanvas: HTMLCanvasElement | undefined

function context(canvas: HTMLCanvasElement): Ctx {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D コンテキストを取得できませんでした')
  ctx.imageSmoothingEnabled = false
  return ctx
}

/**
 * スプライトを描き、輪郭線を付けて返す。
 *
 * 戻り値は使い回しのキャンバスなので、呼び出し側は受け取った直後に
 * drawImage で転送すること（保持すると次の呼び出しで上書きされる）。
 */
export function bakeSprite(options: SpriteOptions): HTMLCanvasElement {
  if (!workCanvas) {
    workCanvas = document.createElement('canvas')
    workCanvas.width = SPRITE_WIDTH
    workCanvas.height = SPRITE_HEIGHT
  }
  if (!outCanvas) {
    outCanvas = document.createElement('canvas')
    outCanvas.width = SPRITE_WIDTH
    outCanvas.height = SPRITE_HEIGHT
  }

  const work = context(workCanvas)
  const out = context(outCanvas)

  work.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT)
  paintChar(work, options)

  const equipped = Object.values(options.equipment).filter((key): key is ItemKey => key !== null)
  if (equipped.length > 0) {
    const f = options.frame | 0
    const bob = options.moving ? (f % 4 === 1 || f % 4 === 3 ? -1 : 0) : 0
    work.save()
    work.translate(0, bob)
    for (const key of equipped) {
      EQUIP_LAYERS[key]?.(work)
    }
    work.restore()
  }

  // 1px の輪郭を付ける。地図の上に置くと背景に溶けるため、縁取りで形を保つ
  const src = work.getImageData(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT).data
  const dst = out.createImageData(SPRITE_WIDTH, SPRITE_HEIGHT)
  const dd = dst.data
  const alphaAt = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= SPRITE_WIDTH || y >= SPRITE_HEIGHT ? 0 : (src[(y * SPRITE_WIDTH + x) * 4 + 3] ?? 0)

  for (let y = 0; y < SPRITE_HEIGHT; y += 1) {
    for (let x = 0; x < SPRITE_WIDTH; x += 1) {
      const i = (y * SPRITE_WIDTH + x) * 4
      if ((src[i + 3] ?? 0) > 20) {
        dd[i] = src[i] ?? 0
        dd[i + 1] = src[i + 1] ?? 0
        dd[i + 2] = src[i + 2] ?? 0
        dd[i + 3] = src[i + 3] ?? 0
      } else if (
        alphaAt(x - 1, y) || alphaAt(x + 1, y) || alphaAt(x, y - 1) || alphaAt(x, y + 1) ||
        alphaAt(x - 1, y - 1) || alphaAt(x + 1, y - 1) || alphaAt(x - 1, y + 1) || alphaAt(x + 1, y + 1)
      ) {
        dd[i] = 36
        dd[i + 1] = 28
        dd[i + 2] = 44
        dd[i + 3] = 255
      }
    }
  }

  out.putImageData(dst, 0, 0)
  return outCanvas
}

/** スプライトを任意のキャンバスへ等倍の整数倍で描く */
export function drawSprite(
  target: HTMLCanvasElement,
  options: SpriteOptions,
  scale: number,
): void {
  const ctx = context(target)
  ctx.clearRect(0, 0, target.width, target.height)
  const sprite = bakeSprite(options)
  const w = SPRITE_WIDTH * scale
  const h = SPRITE_HEIGHT * scale
  ctx.drawImage(
    sprite,
    0, 0, SPRITE_WIDTH, SPRITE_HEIGHT,
    Math.round((target.width - w) / 2), Math.round((target.height - h) / 2), w, h,
  )
}
