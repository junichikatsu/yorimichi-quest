import type { QuizPrompt, SpotCategory, SpotId } from '@map-checkin/shared'

/**
 * クイズの出題データ（FR-04-1）。
 *
 * ★ 正解を含むためサーバー側にのみ置く。共有パッケージへ移すとフロントエンドの
 * バンドルに入り、配信された JavaScript から答えが読めてしまう。
 *
 * 本実装では Dify 上のクイズ生成アプリ（AI-3）が生成する（FR-04-2）。
 * ここは MOCK_MODE 相当の固定データで、生成へ差し替える口だけ残している。
 */

export interface QuizEntry {
  quizId: string
  category: SpotCategory
  question: string
  options: string[]
  answerIndex: number
  /** 正解・不正解のどちらでも表示する（FR-04-6） */
  explanation: string
}

const QUIZ_ENTRIES: QuizEntry[] = [
  /* ---------------- 避難所 ---------------- */
  {
    quizId: 'shelter-flood-1',
    category: 'shelter',
    question: '大雨で道路が冠水しています。歩いて避難するとき、最も危険なのはどれですか。',
    options: ['外れたマンホールや側溝に落ちる', '靴が濡れる', '景色が見えにくい'],
    answerIndex: 0,
    explanation:
      '濁った水では足元がまったく見えず、外れたマンホールや側溝への転落が起きています。膝の上まで水が来たら無理に歩かず、高い場所へ移動してください。',
  },
  {
    quizId: 'shelter-open-1',
    category: 'shelter',
    question: '避難所について、行ってみるまで分からないことが多いのはどれですか。',
    options: ['その時に開設されているか', '建物の名前', 'おおよその場所'],
    answerIndex: 0,
    explanation:
      '場所は公開データで分かりますが、開設状況は載っていません。「警報が出て避難所へ行ったら開いていなかった」という声は実際に寄せられています。だからこそ現地で確かめた情報に価値があります。',
  },
  {
    quizId: 'shelter-toilet-1',
    category: 'shelter',
    question: '避難所でトイレが使いにくいと、なぜ命に関わるのですか。',
    options: [
      '水を飲むのを控えてしまい、脱水から血栓ができやすくなる',
      '待ち時間が長くなる',
      '掃除の手間が増える',
    ],
    answerIndex: 0,
    explanation:
      'トイレが不衛生だったり夜に暗かったりすると、利用を避けようとして水分を控える人が出ます。脱水は血液を濃くし、エコノミークラス症候群の引き金になります。トイレは快適さではなく命の問題です。',
  },

  /* ---------------- AED ---------------- */
  {
    quizId: 'aed-time-1',
    category: 'aed',
    question: 'AEDについて、いざという時に確認しておくと役に立つのはどれですか。',
    options: ['24時間使える場所にあるか', '製造メーカー', '設置された年'],
    answerIndex: 0,
    explanation:
      '店舗の中にあるAEDは営業時間外に使えません。「近くにあるが夜は取り出せない」という状況を事前に知っておくことが、実際に使えるかどうかを分けます。',
  },
  {
    quizId: 'aed-use-1',
    category: 'aed',
    question: '倒れている人を見つけたとき、AEDが届くまでにすべきことはどれですか。',
    options: ['大声で助けを呼び、胸骨圧迫を始める', '到着を静かに待つ', '体を揺すって起こす'],
    answerIndex: 0,
    explanation:
      '心停止では時間の経過とともに救命率が下がります。周囲に声をかけて119番とAEDの手配を頼み、その間も胸骨圧迫を続けることが最も効果があります。',
  },

  /* ---------------- バリアフリートイレ ---------------- */
  {
    quizId: 'toilet-access-1',
    category: 'accessible_toilet',
    question: '車いすの人がトイレを使えるかどうかを左右するのは、次のうちどれですか。',
    options: ['中で向きを変えられる広さがあるか', '鏡の大きさ', '壁の色'],
    answerIndex: 0,
    explanation:
      '入口を通れても、中で方向転換できなければ使えません。旋回スペースの有無は写真で確認しやすく、当事者にとっては行けるかどうかを決める情報です。',
  },
  {
    quizId: 'toilet-water-1',
    category: 'accessible_toilet',
    question: '断水したとき、避難所のトイレはどうなりますか。',
    options: [
      '水洗が使えなくなり、携帯トイレや仮設の備えが必要になる',
      '自動で井戸水に切り替わる',
      '特に影響はない',
    ],
    answerIndex: 0,
    explanation:
      '断水すると水洗トイレは使えません。屋外の仮設トイレへ向かった高齢者が転倒し、動けなくなった事例も報告されています。携帯トイレやマンホールトイレの備えがあるかは重要な情報です。',
  },

  /* ---------------- 給水スポット ---------------- */
  {
    quizId: 'water-supply-1',
    category: 'water',
    question: '断水に備えて、1人が1日に必要とされる飲料水の目安はどれくらいですか。',
    options: ['約3リットル', '約0.5リットル', '約10リットル'],
    answerIndex: 0,
    explanation:
      '飲料と調理をあわせて1人1日3リットルが目安です。3日分で9リットル、できれば1週間分の備蓄が推奨されています。運ぶ手段（給水タンクや台車）も一緒に考えておくと安心です。',
  },
  {
    quizId: 'water-route-1',
    category: 'water',
    question: '給水拠点へ水をもらいに行くとき、事前に知っておきたいのはどれですか。',
    options: ['そこまでの道に段差や坂がないか', '拠点の建物の築年数', '周辺の店の営業時間'],
    answerIndex: 0,
    explanation:
      '水は1リットルで1キログラムあります。10リットル運べば10キログラムで、段差や長い坂があると往復は大きな負担になります。道の状態は現地を歩いた人でないと分かりません。',
  },
]

const ENTRIES_BY_ID = new Map(QUIZ_ENTRIES.map((entry) => [entry.quizId, entry]))

const ENTRIES_BY_CATEGORY = QUIZ_ENTRIES.reduce<Record<string, QuizEntry[]>>((acc, entry) => {
  const list = acc[entry.category] ?? []
  list.push(entry)
  acc[entry.category] = list
  return acc
}, {})

export function findQuizEntry(quizId: string): QuizEntry | undefined {
  return ENTRIES_BY_ID.get(quizId)
}

/**
 * 文字列から安定した整数を作る。
 *
 * 同じスポットでは毎回同じ問題を出したい（リロードで問題が変わると
 * 「答えを知っているのに別の問題が出る」体験になる）。
 * 乱数ではなく spotId から決めることで、サーバーに状態を持たずに固定できる。
 */
function hashCode(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** スポットのカテゴリに応じた出題を1件返す。正解は含めない */
export function pickQuizForSpot(spotId: SpotId, category: SpotCategory): QuizPrompt | undefined {
  const entries = ENTRIES_BY_CATEGORY[category]
  if (entries === undefined || entries.length === 0) return undefined

  const entry = entries[hashCode(spotId) % entries.length]
  if (entry === undefined) return undefined

  return {
    quizId: entry.quizId,
    question: entry.question,
    options: entry.options,
    generatedBy: 'fixture',
  }
}
