/**
 * カードの絵（FR-14）。24×24 のドット絵。
 *
 * ★ **画像を持たない。** 同一オリジン配信で外部に置けず、ZIP と配信サイズにそのまま
 * 乗るためである。点の並びを文字で持ち、描画側が canvas へ打つ。
 *
 * ★ **左右対称のものは左半分（12列）だけ書いて鏡像にする**（`mirror`）。
 * 手で 24 列を並べると数え間違いで対称が崩れ、それが見た目の質を最も落とす。
 * 車いすや旗のように対称でないものは 24 列を直接書く。
 *
 * ★ 寸法は `pixel-art.test.ts` が検査する。1行でも長さが違うと描画時に穴があく。
 *
 * 文字の意味:
 * | 文字 | 役割 |
 * | :--- | :--- |
 * | `.` | 透明 |
 * | `o` | 輪郭（暗い線） |
 * | `m` | 主色（カードの色。カテゴリや種類で変わる） |
 * | `d` | 主色の影 |
 * | `l` | 主色の明るい面 |
 * | `w` | 白（反射・強調） |
 * | `g` | 灰（金属・機器） |
 * | `y` | 黄（明かり） |
 * | `r` | 赤（危険・血流） |
 * | `s` | 肌 |
 */

export const PIXEL_SIZE = 24

export const PIXEL_CHARS = ['.', 'o', 'm', 'd', 'l', 'w', 'g', 'y', 'r', 's'] as const

export type PixelChar = (typeof PIXEL_CHARS)[number]

/** 左半分（12列）を鏡像にして 24 列にする */
function mirror(rows: readonly string[]): string[] {
  return rows.map((row) => row + [...row].reverse().join(''))
}

/** 空行（左半分） */
const E = '............'

export const PIXEL_ART: Record<string, string[]> = {
  /* ---------------- 場所（スポットのカテゴリ） ---------------- */

  /** 避難所・避難場所：切妻屋根の家。窓とドア */
  'place-shelter': mirror([
    E,
    E,
    '...........o',
    '..........om',
    '.........omm',
    '........ommm',
    '.......ommmm',
    '......ommmmm',
    '.....ommmmmm',
    '....ommmmmmm',
    '...ommmmmmmm',
    '..oooooooooo',
    '....oddddddd',
    '....odwwwwdd',
    '....odwwwwdd',
    '....oddddddd',
    '....oddddddd',
    '....odddllll',
    '....odddllll',
    '....odddllll',
    '....oooooooo',
    E,
    E,
    E,
  ]),

  /** AED：機器の箱に白い十字。下は据え置きの台 */
  'place-aed': mirror([
    E,
    E,
    '...ooooooooo',
    '...ommmmmmmm',
    '...ommmmmmww',
    '...ommmmmmww',
    '...ommwwwwww',
    '...ommwwwwww',
    '...ommmmmmww',
    '...ommmmmmww',
    '...ommmmmmmm',
    '...odddddddd',
    '...ooooooooo',
    '.........ooo',
    '.........ogg',
    '.........ogg',
    '........oogg',
    '........oooo',
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /**
   * バリアフリートイレ：車いす（人＋大きな車輪）。
   *
   * ★ ここは左右対称にできない。横向きの姿でないと車いすに見えないためである。
   */
  'place-accessible_toilet': [
    '........................',
    '........................',
    '.........oooo...........',
    '........ossssoo.........',
    '........ossssso.........',
    '........ossssso.........',
    '.........ooooo..........',
    '..........ooo...........',
    '........ooommoo.........',
    '.......ommmmmmmoo.......',
    '......ommmmmmmmmmo......',
    '.....ommmoooooommmo.....',
    '.....ommo......ommmo....',
    '.....ommo.......oooo....',
    '.....ommo...............',
    '....oooooooooo..........',
    '...oo........oo.........',
    '..og..oooooo..go........',
    '..og.ogggggggo.go.......',
    '..og.og.oooo.go.go......',
    '..ogg.og....go.ggo......',
    '...ogg.oooooo.ggo.......',
    '....ooooooooooo.........',
    '........................',
  ],

  /** 給水スポット：水滴。左上に反射を置く */
  'place-water': mirror([
    E,
    '...........o',
    '..........om',
    '.........omm',
    '.........omm',
    '........ommm',
    '.......ommmm',
    '.......ommmm',
    '......ommmmm',
    '.....ommmmmm',
    '.....ommmmmm',
    '....ommwwmmm',
    '....ommwwmmm',
    '....ommmmmmm',
    '....ommmmmmm',
    '.....ommmmmm',
    '.....ommmmmm',
    '......oommmm',
    '.......ooomm',
    '.........ooo',
    E,
    E,
    E,
    E,
  ]),

  /* ---------------- 道具（10種。**すべて描き分ける**） ---------------- */

  /** ヘルメット：半球＋つば＋あご紐 */
  'tool-helmet': mirror([
    E,
    E,
    E,
    '........oooo',
    '......oommmm',
    '.....ommmmmm',
    '....ommmwwmm',
    '....ommwwmmm',
    '...ommmmmmmm',
    '...ommmmmmmm',
    '..ommmmmmmmm',
    '..oooooooooo',
    '.odddddddddd',
    '.ooooooooooo',
    '....o.......',
    '....o.......',
    '.....oo.....',
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /** 防炎ずきん：頭からかぶる布。顔の穴があく */
  'tool-zukin': mirror([
    E,
    E,
    '.........ooo',
    '.......oommm',
    '......ommmmm',
    '.....ommmmmm',
    '....ommmoooo',
    '....ommossss',
    '...ommmossss',
    '...ommmossss',
    '...ommmmoooo',
    '...ommmmmmmm',
    '...ommmmmmmm',
    '..ommmmmmmmm',
    '..ommmmmmmmm',
    '..oddddddddd',
    '..oooooooooo',
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /** ヘッドライト：バンド＋前の明かり。光を右へ出す（対称にしない） */
  'tool-headlight': [
    '........................',
    '........................',
    '........................',
    '......oooooooooooo......',
    '....ooddddddddddddoo....',
    '...ommmmmmmmmmmmmmmmo...',
    '...ommoooooooooooommo...',
    '...ommo..........ommo...',
    '...ommo..oooooo..ommo...',
    '...ommo.oyyyyyyo.ommo...',
    '...ommo.oyywwyyo.ommo..y',
    '...ommo.oyywwyyo.ommo.yy',
    '...ommo.oyyyyyyo.ommo..y',
    '...ommo..oooooo..ommo...',
    '...ommo..........ommo...',
    '...ommoooooooooooommo...',
    '...ommmmmmmmmmmmmmmmo...',
    '....ooddddddddddddoo....',
    '......oooooooooooo......',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],

  /** レインコート：フード付きの上着 */
  'tool-raincoat': mirror([
    E,
    '.........ooo',
    '.......oommm',
    '......ommmmm',
    '.....ommmoo.',
    '.....ommo...',
    '.....oooo...',
    '...oommmmmmm',
    '..ommmmmmmmm',
    '.ommmmmmmmmm',
    '.ommoommmmmm',
    '.ommoommmmmm',
    '.ommoommmmmm',
    '..oo.ommmmmm',
    '.....ommmmmm',
    '.....ommmmmm',
    '.....ommmmmm',
    '.....odddddd',
    '.....odddddd',
    '.....oooooo.',
    E,
    E,
    E,
    E,
  ]),

  /** 軍手：親指の出た手袋。鏡像で左右一組になる（中央に隙間を空けて2枚に見せる） */
  'tool-gloves': mirror([
    E,
    E,
    E,
    '...oooooo...',
    '..ommmmmmo..',
    '..ommmmmmo..',
    '..ommmmmmo..',
    '.oommmmmmo..',
    'ommmmmmmmo..',
    'ommmmmmmmo..',
    '.ommmmmmmo..',
    '..ommmmmmo..',
    '..ommmmmmo..',
    '..oddddddo..',
    '..oooooooo..',
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /** 給水タンク：取っ手つきの角型タンク。水位の線が入る */
  'tool-tank': mirror([
    E,
    E,
    '........oooo',
    '........oo..',
    '........oo..',
    '...ooooooooo',
    '...ommmmmmmm',
    '...ommmmmmmm',
    '...ommmmmmmm',
    '...ommwwwwww',
    '...ommmmmmmm',
    '...ommmmmmmm',
    '...odddddddd',
    '...odddddddd',
    '...odddddddd',
    '...ooooooooo',
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /** ハザードマップ手帳：開いた本に道の線 */
  'tool-book': mirror([
    E,
    E,
    E,
    '....oooooooo',
    '...ommmmmmmm',
    '...ommwwwwww',
    '...ommwwoooo',
    '...ommwwoddd',
    '...ommwwoddd',
    '...ommwwoooo',
    '...ommwwwwww',
    '...ommwwoooo',
    '...ommwwoddd',
    '...ommwwoddd',
    '...ommwwoooo',
    '...ommwwwwww',
    '...ommmmmmmm',
    '...odddddddd',
    '....oooooooo',
    E,
    E,
    E,
    E,
    E,
  ]),

  /** 防災ホイッスル：口をあてる筒＋玉。対称にしない */
  'tool-whistle': [
    '........................',
    '........................',
    '........................',
    '........................',
    '.............oooooo.....',
    '...........oommmmmmoo...',
    '.........oommmmmmmmmmo..',
    '.......oommmmmwwmmmmmo..',
    '.....oommmmmmmwwmmmmmo..',
    '...oooooommmmmmmmmmmmo..',
    '..ogggggoommmmmmmmmmo...',
    '..ogggggoodddddddddo....',
    '...oooooooooooooooo.....',
    '.......oo...............',
    '......og.o..............',
    '.....og...o.............',
    '.....o.....o............',
    '......o...o.............',
    '.......ooo..............',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],

  /** 携帯トイレ：折り目のある袋。口が閉じられている */
  'tool-potatoilet': mirror([
    E,
    E,
    '....oooooooo',
    '....odddddoo',
    '....oooooooo',
    '...ommmmmmmm',
    '...ommmmmmmm',
    '...ommoooooo',
    '...ommowwwww',
    '...ommowwwww',
    '...ommowwwww',
    '...ommoooooo',
    '...ommmmmmmm',
    '...ommmmmmmm',
    '...ommmmmmmm',
    '...odddddddd',
    '...ooooooooo',
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /** 防災ラジオ：スピーカーとつまみ、伸ばしたアンテナ（対称にしない） */
  'tool-radio': [
    '........................',
    '.....................o..',
    '....................o...',
    '...................o....',
    '..................o.....',
    '.................o......',
    '.....oooooooooooooo.....',
    '....ommmmmmmmmmmmmmo....',
    '....ommoooooooommmmo....',
    '....ommogggggggommmo....',
    '....ommogooooogommmo....',
    '....ommogoggogogwwwo....',
    '....ommogooooogommmo....',
    '....ommogggggggommmo....',
    '....ommoooooooommmmo....',
    '....ommmmmmmmmmmmmmo....',
    '....ommmoooommmoooomo...',
    '....ommmoggommmoggomo...',
    '....ommmoooommmoooomo...',
    '....oddddddddddddddo....',
    '.....oooooooooooooo.....',
    '........................',
    '........................',
    '........................',
  ],

  /* ---------------- 行動（場面を表す） ---------------- */

  /** 揺れたら頭を守る：頭と、上にかざした両手 */
  'action-shake': mirror([
    E,
    '.o..........',
    '..o...oo....',
    '...o.oyyo...',
    '....o.oo....',
    '.....ooooooo',
    '....osssssss',
    '...ossssssss',
    '...osswwsssd',
    '...osssssssd',
    '....osssssss',
    '.....ooooooo',
    '....oooooooo',
    '...ommmmmmmm',
    '..ommmmmmmmm',
    '..ommmmmmmmm',
    '..ommmmmmmmm',
    '..oddddddddd',
    '..oooooooooo',
    E,
    E,
    E,
    E,
    E,
  ]),

  /** 冠水した道：水面の下に見えない足元。上に波 */
  'action-flood': [
    '........................',
    '........................',
    '.........oooo...........',
    '........osssso..........',
    '........osssso..........',
    '.........oooo...........',
    '..........oo............',
    '.......ooooooooo........',
    '......ommmmmmmmmo.......',
    '......ommmmmmmmmo.......',
    '..oooooommmmmmmoooooo...',
    '.owwwwwwwwwwwwwwwwwwo...',
    '.odwwwwoowwwwoowwwwwdo..',
    '.oddddddddddddddddddo...',
    '..oooooddddddddoooooo...',
    '......oddddddddo........',
    '......oddddddddo........',
    '......oddo..oddo........',
    '......oddo..oddo........',
    '.....ooooo..ooooo.......',
    '........................',
    '........................',
    '........................',
    '........................',
  ],

  /** 確かめる：貼り紙にチェック */
  'action-check': mirror([
    E,
    E,
    '....oooooooo',
    '....ommmmmmm',
    '....ommooooo',
    '....ommowwww',
    '....ommowwww',
    '....ommowwow',
    '....ommowoww',
    '....ommoowww',
    '....ommowwww',
    '....ommooooo',
    '....ommmmmmm',
    '....oddddddd',
    '....oooooooo',
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /** 倒れた人を助ける：横たわる人と胸に置いた手 */
  'action-rescue': [
    '........................',
    '........................',
    '........................',
    '..............oo........',
    '.............orro.......',
    '............orrrro......',
    '.............orro.......',
    '..............oo........',
    '.....oooo....oooo.......',
    '....osssso..ossso.......',
    '....ossssoooosssoo......',
    '....ossssssssssssoo.....',
    '.....oossssssssssso.....',
    '.......ommmmmmmmmmmoo...',
    '......ommmmmmmmmmmmmmo..',
    '.....ommmmmmmmmmmmmmmo..',
    '.....odddddddddddddddo..',
    '......ooooooooooooooo...',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],

  /** いざという時に備えて確かめる時刻：時計 */
  'action-clock': mirror([
    E,
    E,
    '.......ooooo',
    '.....oommmmm',
    '....ommmmmmm',
    '...ommwwwwww',
    '...ommwwwwww',
    '..ommwwwoooo',
    '..ommwwwo...',
    '..ommwwwo...',
    '..ommwwwo...',
    '..ommwwwooo.',
    '..ommwwwwwww',
    '...ommwwwwww',
    '...ommmmmmmm',
    '....oddddddd',
    '.....ooddddd',
    '.......ooooo',
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /** 生活用水を確保する：蛇口から容器へ溜める */
  'action-water': mirror([
    E,
    '........oooo',
    '........oggg',
    '........oooo',
    '..........oo',
    '..........ww',
    '..........ww',
    '..........ww',
    '..oooooooooo',
    '..ommmmmmmmm',
    '..ommwwwwwww',
    '..ommmmmmmmm',
    '..ommmmmmmmm',
    '..ommmmmmmmm',
    '..oddddddddd',
    '..oddddddddd',
    '..oooooooooo',
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ]),

  /**
   * まだ手に入れていないカードに置く「？」。
   *
   * ★ 中身を隠すが、**枠だけの空白にはしない。** 空白だと「壊れている」ように見え、
   * 「まだ自分のものになっていない」という意味が伝わらない（FR-14 の未達成の見せ方）。
   */
  'locked-unknown': [
    '........................',
    '........................',
    '.........oooooo.........',
    '.......ooommmmooo.......',
    '......ommmmmmmmmmo......',
    '.....ommmo....ommmo.....',
    '.....ommo......ommo.....',
    '.....oooo......ommo.....',
    '...............ommo.....',
    '..............ommmo.....',
    '............oommmoo.....',
    '..........oommmmoo......',
    '.........ommmmoo........',
    '........ommmmo..........',
    '........ommmo...........',
    '........ommmo...........',
    '........ooooo...........',
    '........................',
    '........................',
    '........ooooo...........',
    '........ommmo...........',
    '........ommmo...........',
    '........ooooo...........',
    '........................',
  ],

  /* ---------------- ミッション ---------------- */

  /** 旗。達成の目印 */
  'mission': [
    '........................',
    '...oo...................',
    '...oo...................',
    '...ooooooooooo..........',
    '...oommmmmmmmmoo........',
    '...oommmmmmmmmmmoo......',
    '...oommmmmmmmmmmmmo.....',
    '...oomwwmmmmmmmmmmo.....',
    '...oomwwmmmmmmmmmo......',
    '...oommmmmmmmmmoo.......',
    '...oommmmmmmmmoo........',
    '...ooooooooooo..........',
    '...oo...................',
    '...oo...................',
    '...oo...................',
    '...oo...................',
    '...oo...................',
    '..oooo..................',
    '.oooooo.................',
    'oooooooo................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
}

/* ------------------------------------------------------------------ *
 * カードと絵の対応
 * ------------------------------------------------------------------ */

/**
 * この出題はどの場面か（FR-14-5 の行動カード）。
 *
 * ★ **場所カードと同じ絵にしない。** カテゴリの絵を使い回すと、「避難所の場所カード」と
 * 「避難所の行動カード」が同じ家の絵になり、種類が絵から分からなくなる。
 * 行動カードの見出しは「場面」なので、絵も場面に合わせる。
 */
const ACTION_ART: Record<string, string> = {
  'shelter-action-1': 'action-shake',
  'shelter-flood-1': 'action-flood',
  'shelter-open-1': 'action-check',
  'shelter-toilet-1': 'tool-potatoilet',
  'aed-use-1': 'action-rescue',
  'aed-time-1': 'action-clock',
  'toilet-action-1': 'place-accessible_toilet',
  'toilet-access-1': 'place-accessible_toilet',
  'toilet-water-1': 'tool-potatoilet',
  'water-action-1': 'action-water',
  'water-supply-1': 'tool-tank',
  'water-route-1': 'tool-tank',
}

/**
 * カードに対応する絵の名前を返す。
 *
 * ★ 見つからないときは種類ごとの既定へ落とす。**絵が無いカードを空白で出さない**
 * （出題やアイテムを増やしたときに、絵の追加を忘れても穴があかない）。
 */
export function pixelArtKeyOf(input: {
  kind: string
  key: string
  category?: string | undefined
}): string {
  if (input.kind === 'tool') {
    const named = `tool-${input.key}`
    return PIXEL_ART[named] ? named : 'tool-helmet'
  }

  if (input.kind === 'action') {
    const named = ACTION_ART[input.key]
    if (named && PIXEL_ART[named]) return named
    return 'action-check'
  }

  if (input.kind === 'place') {
    const named = `place-${input.category ?? ''}`
    return PIXEL_ART[named] ? named : 'place-shelter'
  }

  return 'mission'
}
