/**
 * キャラクターのドット絵（FR-01-5・FR-02-8）。16×22。
 *
 * ★ 縦は 22 にしてある。20 にしていたときは**髪型と服の差が出なかった**
 * （髪は横1列、服は色面だけの違いになり、地図の大きさではほぼ同じに見えた）。
 * 参考にした絵も 22 ドットあり、胴と裾に余裕があることが差を作っていた。
 *
 * ★ **絵柄は MOTHER2 の作り方に寄せている。** 実際に比べて決めた（開発用の比較
 * ページで7案を並べた）。効いていた要素は次の4つで、どれを外しても急に幼さが消える。
 *
 * | 要素 | 理由 |
 * | :--- | :--- |
 * | 頭を大きく取る（全体の約6割） | 2頭身に近いほど親しみが出る（設計原則 G-3） |
 * | 目は **1×2 の黒い棒だけ** | 白目とハイライトを入れると「実物寄り」になり険しく見える |
 * | **口を描かない** | 小さな口を描くと表情が固定される。無いほうが柔らかい |
 * | 頬に赤み（`p`） | これだけで血色が出る |
 *
 * ★ **層を重ねて1体を作る。** 髪・服・肌の色は利用者が選ぶため、色を焼き込んだ絵を
 * 組み合わせぶん持つことはできない（髪8色 × 服8色 × 肌4色 = 256通り）。
 * 点の**役割**を文字で持ち、描画のときに選ばれた色を当てる。
 *
 * ★ 左右対称のものは左半分（8列）を書いて鏡像にする（`mirror`）。手で 16 列を並べると
 * 数え間違いで対称が崩れ、それが見た目の質を最も落とす。片手に下げる道具のように
 * 対称にできないものは 16 列を直接書く。
 *
 * ★ 空行を並べない。層は `top`（何行目から始まるか）と中身だけを持つ。
 *
 * ★ 寸法は `avatar-art.test.ts` が検査する。1行でも長さが違うと描画時にずれる。
 *
 * 文字の意味:
 * | 文字 | 役割 |
 * | :--- | :--- |
 * | `.` | 透明（下の層を見せる） |
 * | `o` | 輪郭（黒に近い濃色） |
 * | `s` / `S` | 肌 / 肌の影 |
 * | `p` | 頬（肌に赤みを混ぜた色） |
 * | `h` / `H` | 髪 / 髪の影 |
 * | `c` / `C` | 服 / 服の影（縞や裾に使う） |
 * | `e` / `E` | 装備 / 装備の影 |
 * | `w` | 白 |
 * | `k` | 黒（目） |
 */

export const AVATAR_ART_WIDTH = 16
export const AVATAR_ART_HEIGHT = 22

export const AVATAR_ART_CHARS = [
  '.', 'o', 's', 'S', 'p', 'h', 'H', 'c', 'C', 'e', 'E', 'w', 'k',
] as const

export type AvatarArtChar = (typeof AVATAR_ART_CHARS)[number]

/** 1つの層。`top` 行目から `rows` を置く */
export interface AvatarLayer {
  top: number
  rows: string[]
}

/** 左半分（8列）の幅 */
const HALF = AVATAR_ART_WIDTH / 2

/** 行を作る。**長さは組み立て時に検査する**（数え間違いをここで止める） */
function row(...parts: string[]): string {
  const value = parts.join('')
  if (value.length !== HALF) {
    throw new Error(`avatar-art: 左半分は ${HALF} 文字にすること（${value.length}）: ${value}`)
  }
  return value
}

const dot = (n: number): string => '.'.repeat(n)
const line = (n: number): string => 'o'.repeat(n)
const skin = (n: number): string => 's'.repeat(n)
const hair = (n: number): string => 'h'.repeat(n)
const hairDark = (n: number): string => 'H'.repeat(n)
const cloth = (n: number): string => 'c'.repeat(n)
const clothDark = (n: number): string => 'C'.repeat(n)
const gear = (n: number): string => 'e'.repeat(n)
const gearDark = (n: number): string => 'E'.repeat(n)

/** 左半分を鏡像にして 16 列にする */
function mirror(top: number, rows: readonly string[]): AvatarLayer {
  return { top, rows: rows.map((value) => value + [...value].reverse().join('')) }
}

/* ------------------------------------------------------------------ *
 * 体（顔と手足）
 * ------------------------------------------------------------------ */

/**
 * 土台。頭が全体の約6割を占める。
 *
 * ★ 髪と服の既定も含めてある。層が短くても**下から既定が見えるので穴があかない**。
 */
export const AVATAR_BASE: AvatarLayer = mirror(0, [
  row(dot(8)),
  row(dot(2), line(6)),
  row(dot(1), line(1), hair(6)),
  row(dot(1), line(1), hair(6)),
  row(dot(1), line(1), hairDark(6)),
  row(dot(1), line(1), skin(6)),
  row(dot(1), line(1), skin(2), 'k', skin(3)),
  row(dot(1), line(1), skin(2), 'k', skin(3)),
  row(dot(1), line(1), skin(6)),
  row(dot(1), line(1), 'pp', skin(4)),
  row(dot(1), line(1), skin(6)),
  row(dot(2), line(6)),
  row(dot(3), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(2), line(2), cloth(4)),
  row(dot(3), line(1), cloth(4)),
  row(dot(3), line(1), clothDark(4)),
  row(dot(4), line(1), skin(2), dot(1)),
  row(dot(4), line(1), skin(2), dot(1)),
  row(dot(3), line(4), dot(1)),
  row(dot(8)),
])

/* ------------------------------------------------------------------ *
 * 髪型
 * ------------------------------------------------------------------ */

/** 頭の上（すべての髪型で共通の土台） */
const HAIR_TOP = [
  row(dot(2), line(6)),
  row(dot(1), line(1), hair(6)),
  row(dot(1), line(1), hair(6)),
  row(dot(1), line(1), hairDark(6)),
]

/** ショート */
const HAIR_SHORT = mirror(1, HAIR_TOP)

/** ロング。顔の外側を通り、**あごを越えて肩まで**落ちる */
const HAIR_LONG = mirror(1, [
  ...HAIR_TOP,
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hairDark(1), dot(6)),
  row(line(2), dot(6)),
])

/** ツインテール。耳の高さで**外へ膨らませる**（横幅で分かるようにする） */
const HAIR_TWIN = mirror(1, [
  ...HAIR_TOP,
  row(line(1), hair(1), dot(6)),
  row(line(2), dot(6)),
  row(hair(3), dot(5)),
  row(hair(3), dot(5)),
  row(hair(3), dot(5)),
  row(line(1), hairDark(2), dot(5)),
  row(dot(1), line(2), dot(5)),
])

/** ボブ。あごの高さで切りそろえる */
const HAIR_BOB = mirror(1, [
  ...HAIR_TOP,
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hair(1), dot(6)),
  row(line(1), hairDark(1), dot(6)),
  row(line(2), dot(6)),
])

/**
 * キャップ。**つばを頭より外へ出す**。
 *
 * ★ つばは髪の暗色で塗る。頭と同じ色にすると潰れて帽子だと分からない。
 */
const HAIR_CAP = mirror(1, [
  row(dot(2), line(6)),
  row(dot(1), line(1), hair(6)),
  row(dot(1), line(1), hair(6)),
  row(line(1), hairDark(7)),
])

/** はちまき。服の色の帯を**2行**にして見えるようにする */
const HAIR_BAND = mirror(1, [
  ...HAIR_TOP,
  row(dot(1), line(1), clothDark(6)),
  row(dot(1), line(1), clothDark(6)),
])

export const AVATAR_HAIR: AvatarLayer[] = [
  HAIR_SHORT,
  HAIR_LONG,
  HAIR_TWIN,
  HAIR_BOB,
  HAIR_CAP,
  HAIR_BAND,
]

/* ------------------------------------------------------------------ *
 * 服
 * ------------------------------------------------------------------ */

/** Tシャツ。無地 */
const CLOTH_TEE = mirror(12, [
  row(dot(3), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(2), line(2), cloth(4)),
  row(dot(3), line(1), cloth(4)),
  row(dot(3), line(1), clothDark(4)),
])

/** 縞シャツ。横縞を2本入れる（MOTHER2 の作り方） */
const CLOTH_STRIPE = mirror(12, [
  row(dot(3), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), clothDark(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(2), line(2), clothDark(4)),
  row(dot(3), line(1), cloth(4)),
  row(dot(3), line(1), clothDark(4)),
])

/** パーカー。**首の後ろにフードの塊**を出す */
const CLOTH_HOODIE = mirror(10, [
  row(dot(2), line(1), hairDark(5)),
  row(dot(2), line(1), cloth(5)),
  row(dot(3), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(2), line(2), cloth(4)),
  row(dot(3), line(1), cloth(4)),
  row(dot(3), line(1), clothDark(4)),
])

/** レインコート。**裾を外へ広げる** */
const CLOTH_RAINCOAT = mirror(12, [
  row(dot(3), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(2), line(2), cloth(4)),
  row(dot(2), line(1), cloth(5)),
  row(dot(1), line(1), clothDark(6)),
])

/** 防災ベスト。**前を開けて中の色を見せる** */
const CLOTH_VEST = mirror(12, [
  row(dot(3), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(2), clothDark(2)),
  row(dot(1), line(1), skin(1), line(1), cloth(2), clothDark(2)),
  row(dot(2), line(2), cloth(2), clothDark(2)),
  row(dot(3), line(1), cloth(2), clothDark(2)),
  row(dot(3), line(1), clothDark(4)),
])

/** ワンピース。**裾を段階的に広げる** */
const CLOTH_DRESS = mirror(12, [
  row(dot(3), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(1), line(1), skin(1), line(1), cloth(4)),
  row(dot(2), line(2), cloth(4)),
  row(dot(2), line(1), cloth(5)),
  row(line(1), cloth(7)),
])

export const AVATAR_CLOTH: AvatarLayer[] = [
  CLOTH_TEE,
  CLOTH_STRIPE,
  CLOTH_HOODIE,
  CLOTH_RAINCOAT,
  CLOTH_VEST,
  CLOTH_DRESS,
]

/* ------------------------------------------------------------------ *
 * 装備（ITEM_KEYS の順）
 * ------------------------------------------------------------------ */

/** ヘルメット。つばを頭より外へ出す */
const EQUIP_HELMET = mirror(1, [
  row(dot(2), line(6)),
  row(dot(1), line(1), gear(6)),
  row(dot(1), line(1), gear(6)),
  row(dot(1), line(1), gearDark(6)),
  row(line(1), gearDark(7)),
])

/** 防炎ずきん。頬の横まで下りて首を覆う */
const EQUIP_ZUKIN = mirror(1, [
  row(dot(2), line(6)),
  row(dot(1), line(1), gear(6)),
  row(dot(1), line(1), gear(6)),
  row(dot(1), line(1), gearDark(6)),
  row(line(1), gear(1), dot(6)),
  row(line(1), gear(1), dot(6)),
  row(line(1), gear(1), dot(6)),
  row(line(1), gear(1), dot(6)),
  row(line(1), gear(1), dot(6)),
  row(line(1), gearDark(1), dot(6)),
  row(line(2), dot(6)),
])

/** ヘッドライト。額の帯と明かり */
const EQUIP_HEADLIGHT = mirror(4, [
  row(dot(1), line(1), gear(6)),
  row(dot(1), line(1), gear(1), gearDark(1), 'ww', gearDark(1), gear(1)),
])

/** レインコート（装備）。上着として重ね、裾を広げる */
const EQUIP_RAINCOAT = mirror(12, [
  row(dot(3), line(1), gear(4)),
  row(dot(1), line(1), skin(1), line(1), gear(4)),
  row(dot(1), line(1), skin(1), line(1), gear(4)),
  row(dot(2), line(2), gear(4)),
  row(dot(2), line(1), gear(5)),
  row(dot(1), line(1), gearDark(6)),
])

/** 軍手。手を包む */
const EQUIP_GLOVES = mirror(13, [
  row(dot(1), line(1), gear(1), line(1), dot(4)),
  row(dot(1), line(1), gearDark(1), line(1), dot(4)),
])

/** 給水タンク。片手に下げる（対称にしない） */
const EQUIP_TANK: AvatarLayer = {
  top: 13,
  rows: [
    'oooo' + '.'.repeat(12),
    'oeeo' + '.'.repeat(12),
    'oeeo' + '.'.repeat(12),
    'oEEo' + '.'.repeat(12),
    'oooo' + '.'.repeat(12),
  ],
}

/** ハザードマップ手帳。片手で開いて持つ */
const EQUIP_BOOK: AvatarLayer = {
  top: 13,
  rows: [
    'oooo' + '.'.repeat(12),
    'oewo' + '.'.repeat(12),
    'oewo' + '.'.repeat(12),
    'oooo' + '.'.repeat(12),
  ],
}

/**
 * 防災ホイッスル。首から下げる。
 *
 * ★ 背中のスロットの道具は正面から見えない。**胸元や腰に回して描く。**
 * 1〜2ドットだと地図の大きさで消えるため、3ドット幅を確保する。
 */
const EQUIP_WHISTLE = mirror(12, [
  row(dot(4), gearDark(1), dot(3)),
  row(dot(4), gearDark(1), dot(3)),
  row(dot(3), line(1), gear(1), line(1), dot(2)),
  row(dot(3), line(1), gearDark(1), line(1), dot(2)),
  row(dot(3), line(3), dot(2)),
])

/** 携帯トイレ。腰に下げる（対称にしない） */
const EQUIP_POTATOILET: AvatarLayer = {
  top: 15,
  rows: [
    '.'.repeat(11) + 'oooo.',
    '.'.repeat(11) + 'oeeo.',
    '.'.repeat(11) + 'oEEo.',
    '.'.repeat(11) + 'oooo.',
  ],
}

/** 防災ラジオ。肩に掛けてアンテナを立てる（対称にしない） */
const EQUIP_RADIO: AvatarLayer = {
  top: 9,
  rows: [
    '.'.repeat(14) + 'o.',
    '.'.repeat(13) + 'o..',
    '.'.repeat(12) + 'o...',
    '.'.repeat(11) + 'oooo.',
    '.'.repeat(11) + 'oeeo.',
    '.'.repeat(11) + 'oEEo.',
    '.'.repeat(11) + 'oooo.',
  ],
}

export const AVATAR_EQUIP: Record<string, AvatarLayer> = {
  helmet: EQUIP_HELMET,
  zukin: EQUIP_ZUKIN,
  headlight: EQUIP_HEADLIGHT,
  raincoat: EQUIP_RAINCOAT,
  gloves: EQUIP_GLOVES,
  tank: EQUIP_TANK,
  book: EQUIP_BOOK,
  whistle: EQUIP_WHISTLE,
  potatoilet: EQUIP_POTATOILET,
  radio: EQUIP_RADIO,
}

/* ------------------------------------------------------------------ *
 * 合成
 * ------------------------------------------------------------------ */

export interface ComposeAvatarInput {
  /** 髪型のインデックス。絵が無ければ 0 に落とす */
  hair: number
  /** 服のインデックス。絵が無ければ 0 に落とす */
  cloth: number
  /** 身につけている道具のキー。絵が無ければ描かない */
  equip?: readonly string[]
}

/**
 * 層を重ねて 16×22 の絵にする。
 *
 * ★ 順番は 体 → 服 → 髪 → 装備。後の層が前の層を上書きする（`.` は透過）。
 * 髪を服より後に置くのは、ロングヘアが肩にかかるためである。
 *
 * ★ 絵が無いインデックスは 0 番へ落とす。**描けない組み合わせで穴をあけない。**
 */
export function composeAvatarArt(input: ComposeAvatarInput): string[] {
  const grid: string[][] = Array.from({ length: AVATAR_ART_HEIGHT }, () =>
    Array.from({ length: AVATAR_ART_WIDTH }, () => '.'),
  )

  const paint = (target: AvatarLayer | undefined): void => {
    if (!target) return
    for (const [index, value] of target.rows.entries()) {
      const y = target.top + index
      if (y < 0 || y >= AVATAR_ART_HEIGHT) continue
      for (let x = 0; x < value.length && x < AVATAR_ART_WIDTH; x += 1) {
        const ch = value[x]
        if (ch === undefined || ch === '.') continue
        grid[y]![x] = ch
      }
    }
  }

  paint(AVATAR_BASE)
  paint(AVATAR_CLOTH[input.cloth] ?? AVATAR_CLOTH[0])
  paint(AVATAR_HAIR[input.hair] ?? AVATAR_HAIR[0])
  for (const key of input.equip ?? []) paint(AVATAR_EQUIP[key])

  return grid.map((value) => value.join(''))
}
