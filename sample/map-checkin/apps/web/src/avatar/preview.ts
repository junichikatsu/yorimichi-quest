import {
  CARD_KIND_LABELS,
  CLOTH_NAMES,
  DEFAULT_AVATAR,
  EMPTY_EQUIPMENT,
  HAIR_NAMES,
  ITEM_DEFS,
  ITEM_KEYS,
  MISSION_DEFS,
  SPOT_CATEGORY_COLORS,
  SPOT_CATEGORY_GLYPHS,
  toCardId,
  type Avatar,
  type Equipment,
} from '@map-checkin/shared'
import { SPRITE_HEIGHT, SPRITE_WIDTH, drawSprite, type Direction } from './sprite.js'

// toCardId は本体の識別子と同じ形を確認するために読み込んでいる（プレビューでは表示しない）
void toCardId

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

/**
 * カード1枚の確認用。
 *
 * 本体は React だが、このページは素の DOM で組んでいる。
 * CSS クラスは本体と同じものを使うので、見た目のずれは出ない。
 */
function cardCell(options: {
  kind: 'action' | 'tool' | 'place' | 'mission'
  title: string
  text: string
  achieved: boolean
  art: HTMLElement
}): HTMLElement {
  const slot = document.createElement('div')
  slot.className = 'cards__slot'

  const card = document.createElement('article')
  card.className = `card card--${options.kind} ${options.achieved ? 'card--achieved' : 'card--pending'}`

  const top = document.createElement('header')
  top.className = 'card__top'
  const kind = document.createElement('span')
  kind.className = 'card__kind'
  kind.textContent = CARD_KIND_LABELS[options.kind]
  const state = document.createElement('span')
  if (options.achieved) {
    state.className = 'card__seal'
    state.textContent = '✓'
  } else {
    state.className = 'card__state'
    state.textContent = '未達成'
  }
  top.append(kind, state)

  const art = document.createElement('div')
  art.className = 'card__art'
  art.append(options.art)

  const text = document.createElement('div')
  text.className = 'card__text'
  const title = document.createElement('p')
  title.className = 'card__title'
  title.textContent = options.title
  const body = document.createElement('p')
  body.className = options.achieved ? 'card__body' : 'card__condition'
  body.textContent = options.text
  text.append(title, body)

  card.append(top, art, text)
  slot.append(card)
  return slot
}

function glyphArt(kind: 'action' | 'place', glyph: string, color: string): HTMLElement {
  const el = document.createElement('div')
  el.className = `cardart cardart--${kind}`
  el.style.setProperty('--art-color', color)
  const span = document.createElement('span')
  span.className = 'cardart__glyph'
  span.textContent = glyph
  el.append(span)
  return el
}

function toolArt(itemKey: (typeof ITEM_KEYS)[number]): HTMLElement {
  const el = document.createElement('div')
  el.className = 'cardart cardart--tool'
  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  const scale = 1.5
  canvas.width = Math.round(SPRITE_WIDTH * scale * dpr)
  canvas.height = Math.round(SPRITE_HEIGHT * scale * dpr)
  canvas.style.width = `${SPRITE_WIDTH * scale}px`
  canvas.style.height = `${SPRITE_HEIGHT * scale}px`
  canvas.className = 'avatar-canvas'

  const def = ITEM_DEFS[itemKey]
  drawSprite(
    canvas,
    {
      avatar: DEFAULT_AVATAR,
      equipment: { ...EMPTY_EQUIPMENT, [def.slot]: itemKey },
      frame: 0,
      moving: false,
      direction: 'down',
    },
    scale,
  )
  el.append(canvas)
  return el
}

function ringArt(current: number, total: number): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'cardart cardart--mission'
  const r = 22
  const c = 2 * Math.PI * r
  const ratio = total > 0 ? Math.min(current / total, 1) : 0
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 60 60')
  svg.setAttribute('class', 'cardart__ring')
  const mk = (cls: string, dash?: string): SVGCircleElement => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    el.setAttribute('cx', '30'); el.setAttribute('cy', '30'); el.setAttribute('r', String(r))
    el.setAttribute('class', cls)
    if (dash) { el.setAttribute('stroke-dasharray', dash); el.setAttribute('transform', 'rotate(-90 30 30)') }
    return el
  }
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  label.setAttribute('x', '30'); label.setAttribute('y', '34')
  label.setAttribute('class', 'cardart__ring-text')
  label.textContent = `${current}/${total}`
  svg.append(mk('cardart__ring-track'), mk('cardart__ring-value', `${c * ratio} ${c}`), label)
  wrap.append(svg)
  return wrap
}

function renderCards(root: HTMLElement): void {
  const sec = section('カード（FR-14）', '上段が達成、下段が未達成。同じCSSを本体と共有しています')
  const grid = document.createElement('div')
  grid.className = 'cards'

  const samples: { kind: 'action' | 'tool' | 'place' | 'mission'; title: string; body: string; condition: string; art: () => HTMLElement }[] = [
    {
      kind: 'action', title: '大きな地震の直後',
      body: '頭を守って身を低くし、揺れが収まるまで動かない',
      condition: 'このスポットのクイズに正解する',
      art: () => glyphArt('action', '！', SPOT_CATEGORY_COLORS.shelter),
    },
    {
      kind: 'tool', title: ITEM_DEFS.helmet.name,
      body: ITEM_DEFS.helmet.use, condition: '避難所でチェックインして手に入れる',
      art: () => toolArt('helmet'),
    },
    {
      kind: 'place', title: '日比谷公園',
      body: '避難所・避難場所／千代田区日比谷公園1-6',
      condition: 'この場所でチェックインする',
      art: () => glyphArt('place', SPOT_CATEGORY_GLYPHS.shelter, SPOT_CATEGORY_COLORS.shelter),
    },
    {
      kind: 'mission', title: MISSION_DEFS[1]!.title,
      body: MISSION_DEFS[1]!.body, condition: MISSION_DEFS[1]!.condition,
      art: () => ringArt(2, 3),
    },
  ]

  for (const achieved of [true, false]) {
    for (const s of samples) {
      grid.append(
        cardCell({
          kind: s.kind,
          title: s.title,
          text: achieved ? s.body : s.condition,
          achieved,
          art: s.art(),
        }),
      )
    }
  }

  sec.append(grid)
  root.append(sec)
}

function render(): void {
  const root = document.getElementById('root')
  if (!root) return

  renderCards(root)

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
