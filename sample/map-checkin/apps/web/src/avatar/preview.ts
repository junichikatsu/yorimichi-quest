import {
  CLOTH_NAMES,
  DEFAULT_AVATAR,
  EMPTY_EQUIPMENT,
  HAIR_NAMES,
  ITEM_DEFS,
  ITEM_KEYS,
  type Avatar,
  type Equipment,
} from '@map-checkin/shared'
import { SPRITE_HEIGHT, SPRITE_WIDTH, drawSprite, type Direction } from './sprite.js'

/**
 * キャラクターの見た目を一覧で確認するためのページ（開発用）。
 *
 * 髪型10種 × 服10種 × 装備10種を実装から直接描くので、
 * ブラウザで `public/avatar-preview.html` を開けば全パターンを一度に見比べられる。
 * 本体のバンドルには含めない（別エントリでビルドしている）。
 */

const SCALE = 2

function cell(avatar: Avatar, equipment: Equipment, caption: string, options?: {
  animated?: boolean
  direction?: Direction
}): HTMLElement {
  const wrap = document.createElement('figure')
  wrap.className = 'cell'

  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(SPRITE_WIDTH * SCALE * dpr)
  canvas.height = Math.round(SPRITE_HEIGHT * SCALE * dpr)
  canvas.style.width = `${SPRITE_WIDTH * SCALE}px`
  canvas.style.height = `${SPRITE_HEIGHT * SCALE}px`

  const direction = options?.direction ?? 'down'

  if (options?.animated) {
    const start = performance.now()
    const tick = (now: number): void => {
      drawSprite(
        canvas,
        { avatar, equipment, frame: Math.floor((now - start) / 220), moving: true, direction },
        SCALE,
      )
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  } else {
    drawSprite(canvas, { avatar, equipment, frame: 0, moving: false, direction }, SCALE)
  }

  const label = document.createElement('figcaption')
  label.textContent = caption

  wrap.append(canvas, label)
  return wrap
}

function section(title: string, note?: string): HTMLElement {
  const el = document.createElement('section')
  const h = document.createElement('h2')
  h.textContent = title
  el.append(h)
  if (note !== undefined) {
    const p = document.createElement('p')
    p.className = 'note'
    p.textContent = note
    el.append(p)
  }
  return el
}

function grid(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'grid'
  return el
}

function render(): void {
  const root = document.getElementById('root')
  if (!root) return

  /* 基本 */
  const basics = section('基本', '左から: 正面・歩行（アニメーション）・左向き・右向き・後ろ姿')
  const basicGrid = grid()
  basicGrid.append(
    cell(DEFAULT_AVATAR, EMPTY_EQUIPMENT, '正面'),
    cell(DEFAULT_AVATAR, EMPTY_EQUIPMENT, '歩行', { animated: true }),
    cell(DEFAULT_AVATAR, EMPTY_EQUIPMENT, '左向き', { direction: 'left' }),
    cell(DEFAULT_AVATAR, EMPTY_EQUIPMENT, '右向き', { direction: 'right' }),
    cell(DEFAULT_AVATAR, EMPTY_EQUIPMENT, '後ろ姿', { direction: 'up' }),
  )
  basics.append(basicGrid)
  root.append(basics)

  /* 髪型 */
  const hairs = section('かみがた（10種）')
  const hairGrid = grid()
  HAIR_NAMES.forEach((name, index) => {
    hairGrid.append(cell({ ...DEFAULT_AVATAR, hair: index }, EMPTY_EQUIPMENT, `${index} ${name}`))
  })
  hairs.append(hairGrid)
  root.append(hairs)

  /* 服 */
  const cloths = section('ふく（10種）')
  const clothGrid = grid()
  CLOTH_NAMES.forEach((name, index) => {
    clothGrid.append(cell({ ...DEFAULT_AVATAR, cloth: index }, EMPTY_EQUIPMENT, `${index} ${name}`))
  })
  cloths.append(clothGrid)
  root.append(cloths)

  /* 装備 */
  const equips = section('そうび（10種）', '素体の上に重ねたところ')
  const equipGrid = grid()
  for (const key of ITEM_KEYS) {
    const def = ITEM_DEFS[key]
    const equipment: Equipment = { ...EMPTY_EQUIPMENT, [def.slot]: key }
    equipGrid.append(cell(DEFAULT_AVATAR, equipment, def.name))
  }
  equips.append(equipGrid)
  root.append(equips)

  /* 全部乗せ */
  const full = section('フル装備', '頭・体・手・背中をすべて埋めた状態')
  const fullGrid = grid()
  fullGrid.append(
    cell(
      { ...DEFAULT_AVATAR, hair: 3, cloth: 8, hairColor: 2, clothColor: 3, skin: 0 },
      { head: 'helmet', body: 'raincoat', hand: 'tank', back: 'radio' },
      'ヘルメット＋レインコート＋給水タンク＋ラジオ',
      { animated: true },
    ),
    cell(
      { ...DEFAULT_AVATAR, hair: 8, cloth: 3, hairColor: 5, clothColor: 6, skin: 2 },
      { head: 'zukin', body: null, hand: 'book', back: 'potatoilet' },
      '防炎ずきん＋ハザードマップ手帳＋携帯トイレ',
      { animated: true },
    ),
    cell(
      { ...DEFAULT_AVATAR, hair: 4, cloth: 6, hairColor: 7, clothColor: 0, skin: 3 },
      { head: 'headlight', body: null, hand: 'gloves', back: 'whistle' },
      'ヘッドライト＋軍手＋ホイッスル',
      { animated: true },
    ),
  )
  full.append(fullGrid)
  root.append(full)

  /* 色の組み合わせ */
  const colors = section('いろの組み合わせ', '肌・髪・服の色を変えたところ')
  const colorGrid = grid()
  for (let i = 0; i < 8; i += 1) {
    colorGrid.append(
      cell(
        { ...DEFAULT_AVATAR, hair: i % 10, cloth: (i * 3) % 10, hairColor: i, clothColor: (i + 3) % 8, skin: i % 4 },
        EMPTY_EQUIPMENT,
        `パターン ${i + 1}`,
      ),
    )
  }
  colors.append(colorGrid)
  root.append(colors)
}

render()
