import {
  CLOTH_COLORS,
  HAIR_COLORS,
  SKIN_COLORS,
  type Avatar,
  type Equipment,
  type ItemKey,
} from '@map-checkin/shared'

/**
 * キャラクターの描画。
 *
 * `battle-prototype` はドット絵だったが、こちらは**2頭身のなめらかな2Dキャラクター**として描く。
 * 幅広い年齢層に親しみを持ってもらうことを狙っており（設計原則 G-3）、
 * 角の立ったドットより丸みのある形のほうが目的に合う。
 *
 * 座標は 48×56 の論理単位で、拡大は drawSprite が行う。
 * ベクタで描いているため、どの倍率でも輪郭がぼやけない。
 */

export const SPRITE_WIDTH = 48
export const SPRITE_HEIGHT = 56

/** 体の中心 X。すべてのパーツはここを基準に置く */
const CX = 24
/** 顔の中心 Y と半径。2頭身に見せるため頭を大きく取る */
const HEAD_CY = 17
const HEAD_R = 13

/** 線画の色。真っ黒にすると硬くなるので、少し紫に寄せた濃色にする */
const LINE = '#40323f'
const LINE_W = 1.4

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

/* ------------------------------------------------------------------ *
 * 描画ヘルパー
 * ------------------------------------------------------------------ */

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
  return `#${((1 << 24) + ((r & 255) << 16) + ((g & 255) << 8) + ((b | 0) & 255)).toString(16).slice(1)}`
}

/** 塗り＋輪郭。輪郭を省くと地図の上で背景に溶ける */
function paint(g: Ctx, fill: string, outline = true): void {
  g.fillStyle = fill
  g.fill()
  if (!outline) return
  g.strokeStyle = LINE
  g.lineWidth = LINE_W
  g.lineJoin = 'round'
  g.stroke()
}

function circle(g: Ctx, cx: number, cy: number, r: number): void {
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
}

function ellipse(g: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
}

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

/** 頭の丸の内側だけに描くためのクリップ */
function withHeadClip(g: Ctx, dy: number, draw: () => void): void {
  g.save()
  circle(g, CX, HEAD_CY + dy, HEAD_R)
  g.clip()
  draw()
  g.restore()
}

/* ------------------------------------------------------------------ *
 * 髪型
 * ------------------------------------------------------------------ */

/** 頭の丸の上半分を覆う基本の髪。すべての髪型の土台になる */
function hairCap(g: Ctx, dy: number, hair: string): void {
  g.beginPath()
  g.arc(CX, HEAD_CY + dy, HEAD_R, Math.PI, Math.PI * 2)
  g.lineTo(CX + HEAD_R, HEAD_CY + dy - 1)
  g.quadraticCurveTo(CX, HEAD_CY + dy + 3, CX - HEAD_R, HEAD_CY + dy - 1)
  g.closePath()
  paint(g, hair)
}

function drawHair(g: Ctx, style: number, dy: number, hair: string, cloth: string): void {
  const y = HEAD_CY + dy
  const hi = shade(hair, 0.28)
  const sh = shade(hair, -0.22)

  switch (style) {
    case 0: // ショート
      hairCap(g, dy, hair)
      ellipse(g, CX - 11, y + 1, 3.2, 5); paint(g, sh)
      ellipse(g, CX + 11, y + 1, 3.2, 5); paint(g, sh)
      break

    case 1: // ロング
      ellipse(g, CX - 12, y + 8, 4.5, 12); paint(g, sh)
      ellipse(g, CX + 12, y + 8, 4.5, 12); paint(g, sh)
      hairCap(g, dy, hair)
      break

    case 2: // ポニーテール
      ellipse(g, CX + 15, y + 8, 4.5, 9); paint(g, sh)
      hairCap(g, dy, hair)
      circle(g, CX + 12, y - 1, 3); paint(g, hi)
      break

    case 3: // ツインテール
      circle(g, CX - 15, y + 6, 5.5); paint(g, sh)
      circle(g, CX + 15, y + 6, 5.5); paint(g, sh)
      hairCap(g, dy, hair)
      circle(g, CX - 12, y - 2, 3); paint(g, hi)
      circle(g, CX + 12, y - 2, 3); paint(g, hi)
      break

    case 4: { // スパイキー
      g.beginPath()
      g.moveTo(CX - 13, y - 3)
      for (let i = 0; i < 5; i += 1) {
        const x0 = CX - 13 + i * 6.5
        g.lineTo(x0 + 3.2, y - 15 + (i % 2) * 3)
        g.lineTo(x0 + 6.5, y - 3)
      }
      g.closePath()
      paint(g, hair)
      hairCap(g, dy, hair)
      break
    }

    case 5: // ボブ
      ellipse(g, CX, y + 3, HEAD_R + 2.5, HEAD_R + 1); paint(g, hair)
      withHeadClip(g, dy, () => {
        ellipse(g, CX, y + 12, HEAD_R, 8)
        g.fillStyle = SKIN_COLORS[0]
        g.fill()
      })
      hairCap(g, dy, hair)
      break

    case 6: // くるくる
      for (let i = 0; i < 7; i += 1) {
        const a = Math.PI + (Math.PI / 6) * i
        circle(g, CX + Math.cos(a) * (HEAD_R - 1), y + Math.sin(a) * (HEAD_R - 1), 4)
        paint(g, i % 2 === 0 ? hair : hi)
      }
      break

    case 7: // キャップ
      hairCap(g, dy, hair)
      g.beginPath()
      g.arc(CX, y, HEAD_R + 1, Math.PI, Math.PI * 2)
      g.closePath()
      paint(g, cloth)
      roundRect(g, CX - 2, y - HEAD_R - 3, 4, 4, 2); paint(g, shade(cloth, -0.2))
      ellipse(g, CX + 2, y - 1, 11, 3.5); paint(g, shade(cloth, -0.12))
      break

    case 8: { // フード
      const hd = shade(cloth, -0.05)
      ellipse(g, CX, y + 1, HEAD_R + 4, HEAD_R + 3); paint(g, hd)
      withHeadClip(g, dy, () => {
        circle(g, CX, y + 2, HEAD_R)
        g.fillStyle = SKIN_COLORS[0]
        g.fill()
      })
      circle(g, CX, y + 1, HEAD_R + 0.5)
      g.strokeStyle = LINE
      g.lineWidth = LINE_W
      g.stroke()
      break
    }

    case 9: // はちまき
      hairCap(g, dy, hair)
      roundRect(g, CX - HEAD_R - 1, y - 6, HEAD_R * 2 + 2, 4.5, 2); paint(g, '#e0574a')
      circle(g, CX - HEAD_R - 1, y - 4, 2.4); paint(g, '#e0574a')
      break

    default:
      hairCap(g, dy, hair)
      break
  }
}

/* ------------------------------------------------------------------ *
 * 服
 * ------------------------------------------------------------------ */

const BODY_X = CX - 9
const BODY_Y = 29
const BODY_W = 18
const BODY_H = 16

function drawCloth(g: Ctx, style: number, dy: number, cloth: string): void {
  const y = BODY_Y + dy
  const hi = shade(cloth, 0.22)
  const sh = shade(cloth, -0.2)

  switch (style) {
    case 0: // チュニック
      roundRect(g, CX - 0.8, y + 2, 1.6, BODY_H - 4, 0.8); paint(g, sh, false)
      break
    case 1: // パーカー
      ellipse(g, CX, y + 2, 8, 3.5); paint(g, sh)
      roundRect(g, CX - 5, y + 9, 10, 5, 2.5); paint(g, sh, false)
      break
    case 2: // ジャケット
      g.beginPath(); g.moveTo(CX, y + 1); g.lineTo(CX - 5, y + 3); g.lineTo(CX, y + 9); g.closePath()
      paint(g, '#f3efe4', false)
      g.beginPath(); g.moveTo(CX, y + 1); g.lineTo(CX + 5, y + 3); g.lineTo(CX, y + 9); g.closePath()
      paint(g, '#f3efe4', false)
      break
    case 3: // レインコート
      roundRect(g, BODY_X - 1, y - 1, BODY_W + 2, BODY_H + 2, 7); paint(g, '#f0d75a')
      roundRect(g, CX - 0.8, y + 1, 1.6, BODY_H, 0.8); paint(g, '#cba933', false)
      break
    case 4: // セーラー
      g.beginPath(); g.moveTo(CX - 8, y + 1); g.lineTo(CX, y + 8); g.lineTo(CX + 8, y + 1); g.closePath()
      paint(g, '#f5f2e8')
      circle(g, CX, y + 7, 2.2); paint(g, '#e0574a')
      break
    case 5: // ワンピース
      g.beginPath()
      g.moveTo(BODY_X + 1, y + 7)
      g.lineTo(BODY_X - 3, y + BODY_H + 3)
      g.lineTo(BODY_X + BODY_W + 3, y + BODY_H + 3)
      g.lineTo(BODY_X + BODY_W - 1, y + 7)
      g.closePath()
      paint(g, hi)
      break
    case 6: // リュック
      roundRect(g, CX - 7, y + 1, 3, BODY_H - 3, 1.5); paint(g, '#8a6a44', false)
      roundRect(g, CX + 4, y + 1, 3, BODY_H - 3, 1.5); paint(g, '#8a6a44', false)
      break
    case 7: // はっぴ
      roundRect(g, CX - 1, y, 2, BODY_H, 1); paint(g, '#f7f4ea', false)
      roundRect(g, BODY_X, y + BODY_H - 5, BODY_W, 2.5, 1); paint(g, '#3a4256', false)
      break
    case 8: // 防災ベスト
      roundRect(g, BODY_X + 1, y + 1, BODY_W - 2, BODY_H - 2, 5); paint(g, '#ffd45c')
      roundRect(g, BODY_X + 1, y + 5, BODY_W - 2, 2, 1); paint(g, '#f4f6ef', false)
      roundRect(g, BODY_X + 1, y + 10, BODY_W - 2, 2, 1); paint(g, '#f4f6ef', false)
      break
    case 9: // ローブ
      g.beginPath()
      g.moveTo(BODY_X + 1, y + 5)
      g.lineTo(BODY_X - 4, y + BODY_H + 9)
      g.lineTo(BODY_X + BODY_W + 4, y + BODY_H + 9)
      g.lineTo(BODY_X + BODY_W - 1, y + 5)
      g.closePath()
      paint(g, sh)
      break
    default:
      break
  }
}

/* ------------------------------------------------------------------ *
 * 装備
 * ------------------------------------------------------------------ */

/** 素体の上に重ねる装備。`dy` は歩行時の上下動 */
const EQUIP_LAYERS: Partial<Record<ItemKey, (g: Ctx, dy: number) => void>> = {
  helmet(g, dy) {
    const y = HEAD_CY + dy
    g.beginPath()
    g.arc(CX, y - 1, HEAD_R + 1.5, Math.PI, Math.PI * 2)
    g.closePath()
    paint(g, '#f5c53c')
    roundRect(g, CX - HEAD_R - 3, y - 3, HEAD_R * 2 + 6, 3.5, 1.8); paint(g, shade('#f5c53c', -0.18))
    roundRect(g, CX - 1.6, y - HEAD_R - 2, 3.2, 8, 1.4); paint(g, '#e0574a', false)
  },
  zukin(g, dy) {
    const y = HEAD_CY + dy
    ellipse(g, CX, y, HEAD_R + 3.5, HEAD_R + 2.5); paint(g, '#4a5a86')
    withHeadClip(g, dy, () => {
      circle(g, CX, y + 3, HEAD_R - 0.5)
      g.fillStyle = SKIN_COLORS[0]
      g.fill()
    })
    roundRect(g, CX - HEAD_R - 3, y + 6, 5, 12, 2.5); paint(g, shade('#4a5a86', -0.12))
    roundRect(g, CX + HEAD_R - 2, y + 6, 5, 12, 2.5); paint(g, shade('#4a5a86', -0.12))
  },
  headlight(g, dy) {
    const y = HEAD_CY + dy
    roundRect(g, CX - HEAD_R - 1, y - 8, HEAD_R * 2 + 2, 4, 2); paint(g, '#39405a')
    roundRect(g, CX - 3.5, y - 9.5, 7, 6, 2.5); paint(g, '#f2ecdb')
    circle(g, CX, y - 6.5, 1.8); paint(g, '#fff3b0', false)
  },
  raincoat(g, dy) {
    const y = BODY_Y + dy
    g.beginPath()
    g.moveTo(BODY_X - 2, y + 1)
    g.lineTo(BODY_X - 4, y + BODY_H + 4)
    g.lineTo(BODY_X + BODY_W + 4, y + BODY_H + 4)
    g.lineTo(BODY_X + BODY_W + 2, y + 1)
    g.quadraticCurveTo(CX, y - 4, BODY_X - 2, y + 1)
    g.closePath()
    paint(g, '#f0d75a')
    roundRect(g, CX - 0.8, y + 2, 1.6, BODY_H, 0.8); paint(g, '#cba933', false)
  },
  gloves(g, dy) {
    const y = BODY_Y + dy
    circle(g, CX - 12, y + 12, 3.4); paint(g, '#efe9d8')
    circle(g, CX + 12, y + 12, 3.4); paint(g, '#efe9d8')
  },
  tank(g, dy) {
    const y = BODY_Y + dy
    roundRect(g, CX + 10, y + 8, 8, 10, 2.5); paint(g, '#69b6e2')
    roundRect(g, CX + 12.5, y + 6, 3, 2.5, 1); paint(g, '#3f4a58', false)
    roundRect(g, CX + 12, y + 11, 2, 4, 1); paint(g, '#eaf5fc', false)
  },
  book(g, dy) {
    const y = BODY_Y + dy
    roundRect(g, CX - 19, y + 8, 9, 10, 1.8); paint(g, '#d1674a')
    roundRect(g, CX - 17.5, y + 9.5, 6, 7, 1); paint(g, '#f5eddc', false)
    roundRect(g, CX - 17, y + 11, 5, 1.4, 0.7); paint(g, '#4a8a5a', false)
    roundRect(g, CX - 17, y + 13.5, 5, 1.4, 0.7); paint(g, '#4a86b6', false)
  },
  whistle(g, dy) {
    const y = BODY_Y + dy
    g.beginPath()
    g.moveTo(CX - 6, y + 1)
    g.quadraticCurveTo(CX, y + 8, CX + 6, y + 1)
    g.strokeStyle = LINE
    g.lineWidth = 1.1
    g.stroke()
    roundRect(g, CX - 2.5, y + 6, 5, 3.5, 1.6); paint(g, '#e8b24e')
  },
  radio(g, dy) {
    const y = BODY_Y + dy
    roundRect(g, CX - 17, y + 2, 6, 10, 2); paint(g, '#5a6280')
    roundRect(g, CX - 15.5, y - 1, 1.4, 4, 0.7); paint(g, '#8fe6c0', false)
    circle(g, CX - 14, y + 5, 1.3); paint(g, '#e8b24e', false)
  },
  potatoilet(g, dy) {
    const y = BODY_Y + dy
    roundRect(g, CX + 10, y + 3, 6, 8, 2); paint(g, '#7fa96a')
    roundRect(g, CX + 12, y + 5.5, 2, 3, 1); paint(g, '#eef2e2', false)
  },
}

/* ------------------------------------------------------------------ *
 * 本体
 * ------------------------------------------------------------------ */

function paintChar(g: Ctx, o: SpriteOptions): void {
  const { avatar } = o
  const skin = SKIN_COLORS[avatar.skin] ?? SKIN_COLORS[0]
  const hair = HAIR_COLORS[avatar.hairColor] ?? HAIR_COLORS[0]
  const cloth = CLOTH_COLORS[avatar.clothColor] ?? CLOTH_COLORS[0]

  const f = o.frame | 0
  // 歩くと上下に弾む。丸い体を跳ねさせると一気に生き物らしくなる
  const dy = o.moving ? ([0, -1.5, 0, -0.6][f % 4] ?? 0) : 0
  const swing = o.moving ? ([0, 2.2, 0, -2.2][f % 4] ?? 0) : 0

  // 影。跳ねている間は小さくして浮いて見せる
  ellipse(g, CX, 53, 11 - Math.abs(dy) * 1.2, 3.2 - Math.abs(dy) * 0.4)
  g.fillStyle = 'rgba(40, 44, 60, 0.22)'
  g.fill()

  // 脚
  const legY = BODY_Y + dy + BODY_H - 2
  roundRect(g, CX - 6, legY, 5, 8 + swing * 0.4, 2.5); paint(g, shade(cloth, -0.42))
  roundRect(g, CX + 1, legY, 5, 8 - swing * 0.4, 2.5); paint(g, shade(cloth, -0.42))
  ellipse(g, CX - 3.5, legY + 8 + swing * 0.4, 3.4, 2.4); paint(g, '#4a3f39')
  ellipse(g, CX + 3.5, legY + 8 - swing * 0.4, 3.4, 2.4); paint(g, '#4a3f39')

  // 胴
  roundRect(g, BODY_X, BODY_Y + dy, BODY_W, BODY_H, 7); paint(g, cloth)
  drawCloth(g, avatar.cloth, dy, cloth)

  // 腕。丸い手先まで含めて短く描くと幼い印象になる
  const armY = BODY_Y + dy + 3
  roundRect(g, CX - 13, armY + swing * 0.5, 5, 11, 2.5); paint(g, shade(cloth, -0.1))
  roundRect(g, CX + 8, armY - swing * 0.5, 5, 11, 2.5); paint(g, shade(cloth, -0.1))
  circle(g, CX - 10.5, armY + 11 + swing * 0.5, 3); paint(g, skin)
  circle(g, CX + 10.5, armY + 11 - swing * 0.5, 3); paint(g, skin)

  // 頭
  circle(g, CX, HEAD_CY + dy, HEAD_R); paint(g, skin)

  const y = HEAD_CY + dy
  if (o.direction === 'up') {
    // 後ろ姿。顔は描かず、髪だけで見せる
    circle(g, CX, y, HEAD_R - 0.5)
    g.fillStyle = hair
    g.fill()
  } else {
    const ex = o.direction === 'left' ? -2.2 : o.direction === 'right' ? 2.2 : 0

    // ほお。目より先に置いて、目の下に薄く残す
    ellipse(g, CX - 8 + ex * 0.5, y + 4.5, 3.2, 2); g.fillStyle = 'rgba(240, 150, 150, 0.5)'; g.fill()
    ellipse(g, CX + 8 + ex * 0.5, y + 4.5, 3.2, 2); g.fillStyle = 'rgba(240, 150, 150, 0.5)'; g.fill()

    // 目。大きめの楕円にハイライトを 2 つ入れる
    const eye = (x: number): void => {
      ellipse(g, x, y + 1.5, 3, 3.6)
      g.fillStyle = '#3b3140'
      g.fill()
      circle(g, x - 0.9, y + 0.2, 1.1); g.fillStyle = '#ffffff'; g.fill()
      circle(g, x + 1, y + 2.6, 0.6); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill()
    }
    eye(CX - 5.5 + ex)
    eye(CX + 5.5 + ex)

    // 口。小さな弧にとどめる
    g.beginPath()
    g.arc(CX + ex, y + 6, 2.2, 0.15 * Math.PI, 0.85 * Math.PI)
    g.strokeStyle = LINE
    g.lineWidth = 1.1
    g.lineCap = 'round'
    g.stroke()
  }

  drawHair(g, avatar.hair, dy, hair, cloth)

  // 装備は最後に重ねる
  for (const key of Object.values(o.equipment)) {
    if (key === null) continue
    EQUIP_LAYERS[key]?.(g, dy)
  }
}

/**
 * キャンバスへキャラクターを描く。
 *
 * ベクタで描くため、`scale` は整数でなくてもよい（ドット絵と違ってにじまない）。
 * 高精細ディスプレイでぼやけないよう、呼び出し側が devicePixelRatio を掛けた
 * 大きさのキャンバスを渡してもそのまま扱える。
 */
export function drawSprite(target: HTMLCanvasElement, options: SpriteOptions, scale: number): void {
  const ctx = target.getContext('2d')
  if (!ctx) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, target.width, target.height)

  // 論理座標（48×56）で描けるように、キャンバスの実寸へ合わせて拡大する
  const usedScale = target.width / SPRITE_WIDTH || scale
  ctx.scale(usedScale, usedScale)
  ctx.imageSmoothingEnabled = true

  paintChar(ctx, options)
}
