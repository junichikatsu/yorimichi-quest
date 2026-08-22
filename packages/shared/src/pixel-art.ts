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
   * バリアフリートイレ：車いすマーク（座った人と大きな車輪）。
   *
   * ★ ここは左右対称にできない。横向きの姿でないと車いすに見えないためである。
   *
   * ★ **車輪は影の色（`d`）で、人は主色（`m`）で描く。** 同じ色だと1点の隙間では
   * 塊に見え、何の記号か読めなくなる。
   */
  'place-accessible_toilet': [
    '........................',
    '......oooo..............',
    '.....ommmmo.............',
    '.....ommmmo.............',
    '.....ommmmo.............',
    '.....ommmmo.............',
    '......oooo..............',
    '.....ommmo..............',
    '.....ommmooooooo........',
    '.....ommmoddddddo.......',
    '.....ommmooooooodo......',
    '.....ommmmmmmmmoddo.....',
    '.....ommmmmmmmmooodo....',
    '.....ooommmmmmmmmodo....',
    '....oddooooooommmodo....',
    '....odo......ommmooo....',
    '....odo......ommmmmmo...',
    '....oddo.....ommmmmmo...',
    '....oddo......oooooo....',
    '....odddo......odddo....',
    '.....odddoo..oodddo.....',
    '......oddddooddddo......',
    '.......oddddddddo.......',
    '........oooooooo........',
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

  /**
   * 揺れたら頭を守る：机の下に隠れる姿。
   *
   * ★ **頭を抱える腕は描かない。** 腕の形が読めず、何をしているか分からなかった。
   * 机という物と組み合わせると、姿勢を描き込まずに行動が伝わる。
   */
  'action-shake': mirror([
    E,
    E,
    E,
    E,
    '.ooooooooooo',
    'ommmmmmmmmmm',
    'ommmmmmmmmmm',
    'ommmmmmmmmmm',
    '.odddooooooo',
    '.odddo..ooss',
    '.odddo..osss',
    '.odddo..osss',
    '.odddo..osss',
    '.odddo..osss',
    '.odddoooosss',
    '.odddoolllll',
    '.odddoolllll',
    '.odddoolllll',
    '.odddoolllll',
    '.odddoolllll',
    '..ooo.oooooo',
    E,
    E,
    E,
  ]),

  /**
   * 冠水した道：半分沈んだ標識。水面から上だけ出ている。
   *
   * ★ **水に入った人ではなく、沈んだものを描く。** 人の姿では「浸かっている」ことも
   * 「どこまで来ているか」も読めない。標識なら**深さ**が一目で伝わる。
   */
  'action-flood': [
    '........................',
    '......oooooooooooo......',
    '.....ollllllllllllo.....',
    '.....ollllllllllllo.....',
    '.....ollllloolllllo.....',
    '.....ollllloolllllo.....',
    '.....ollllloolllllo.....',
    '.....ollllloolllllo.....',
    '.....ollllllllllllo.....',
    '.....ollllloolllllo.....',
    '.....ollllloolllllo.....',
    '......oooooggooooo......',
    '..........oggo..........',
    'mmm...mmm.ogmmm...mmm...',
    'mmmmmmmmmmmmmmmmmmmmmmmm',
    'llllllllllllllllllllllll',
    'mmmmmmmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmm',
    'llllllllllllllllllllllll',
    'mmmmmmmmmmmmmmmmmmmmmmmm',
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

  /**
   * 倒れた人を助ける：心臓を横切る心電図。
   *
   * ★ **横たわる人は描かない。** 24×24 では倒れた人と寝ている人の区別が付かない。
   * 心臓と拍動なら、助ける行為そのものを指せる。
   */
  'action-rescue': [
    '........................',
    '........................',
    '........................',
    '......oooo....oooo......',
    '.....orrrro..orrrro.....',
    '....orrrrrroorrrrrro....',
    '...orrrrrrrrrrrrrrrro...',
    '...orrrrrwwwrrrrrrrro...',
    '...orrrrrwrwrrrrrrrro...',
    '...orrrrrwrwrrrrrrrro...',
    '....owwwwwrwrwwwwwwo....',
    '.....orrrrrwrwrrrro.....',
    '......orrrrwrwrrro......',
    '.......orrrwwwrro.......',
    '........orrrrrro........',
    '.........orrrro.........',
    '..........orro..........',
    '...........oo...........',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],

  /**
   * 24時間使えるか：太い時計。針は2本だけ。
   *
   * ★ **人の姿は描かない。** 24×24 では姿勢が読めず、何をしている絵か伝わらない。
   * 場面を表す絵は「その場面を一目で指す記号」にする（時計・机・心臓）。
   */
  'action-clock': [
    '........................',
    '........................',
    '........oooooooo........',
    '.......ommmmmmmmo.......',
    '.....oommmmmmmmmmoo.....',
    '....ommmmllllllmmmmo....',
    '....ommlllloollllmmo....',
    '...ommllllloolllllmmo...',
    '..ommmllllloolllllmmmo..',
    '..ommlllllloollllllmmo..',
    '..ommlllllloollllllmmo..',
    '..ommllllllooooooolmmo..',
    '..ommllllllooooooolmmo..',
    '..ommllllllllllllllmmo..',
    '..ommllllllllllllllmmo..',
    '..ommmllllllllllllmmmo..',
    '...ommllllllllllllmmo...',
    '....ommllllllllllmmo....',
    '....ommmmllllllmmmmo....',
    '.....oommmmmmmmmmoo.....',
    '.......ommmmmmmmo.......',
    '........oooooooo........',
    '........................',
    '........................',
  ],

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

/**
 * 絵が何を描いたものかの説明（日本語）。
 *
 * ★ **絵の定義と同じ場所に置く。** 開発用の一覧ページがこれを出すためにある。
 * 説明が無いと「この絵を直してほしい」と指示を出すときに、どれを指しているのか
 * 伝えられない（実際に伝えられなかった）。
 *
 * ★ 直したら説明も直すこと。説明と絵が食い違うと、一覧が嘘をつく。
 */
export const PIXEL_ART_LABELS: Record<string, string> = {
  'place-shelter': '三角屋根の家。窓が2つとドア（避難所）',
  'place-aed': '白い十字が入った機器の箱と、下に据え置きの台（AED）',
  'place-accessible_toilet': '車いすマーク。座った人と大きな車輪',
  'place-water': '水滴。左上に光の反射',
  'tool-helmet': 'ヘルメット。半球とつば、両端にあご紐',
  'tool-zukin': '防炎ずきん。顔の穴があいたかぶりもの',
  'tool-headlight': 'ヘッドライト。バンドと前の明かり（黄色）',
  'tool-raincoat': 'レインコート。フードと袖のある上着',
  'tool-gloves': '軍手。親指の出た手袋が左右2枚',
  'tool-tank': '給水タンク。取っ手つきの角型と水位の線',
  'tool-book': 'ハザードマップ手帳。開いた本と地図の面',
  'tool-whistle': '防災ホイッスル。筒と玉、下にひもの輪',
  'tool-potatoilet': '携帯トイレ。口を閉じた袋',
  'tool-radio': '防災ラジオ。スピーカーとつまみ、伸ばしたアンテナ',
  'action-shake': '机の下に隠れる人（揺れたら頭を守る）',
  'action-flood': '半分沈んだ標識。水面から上だけ出ている（冠水した道）',
  'action-check': '貼り紙にチェック（開設されているか確かめる）',
  'action-rescue': '心臓を横切る心電図（倒れた人を助ける）',
  'action-clock': '太い時計（24時間使える場所かを確かめる）',
  'action-water': '蛇口から水を溜める容器（生活用水の確保）',
  mission: '旗。ポールと台座（ミッションの達成）',
  'locked-unknown': '「？」。まだ手に入れていないカードに出す',
}
