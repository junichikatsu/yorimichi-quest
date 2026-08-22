import type { QuizKind, QuizPrompt, SpotCategory, SpotId } from '@imanouchi/shared'

/**
 * クイズの出題データ（FR-04-1）。
 *
 * ★ **正解を含むためサーバー側にのみ置く。** 共有パッケージ（packages/shared）へ
 * 移すとフロントエンドのバンドルに入り、配信された JavaScript から答えが読める。
 *
 * ★ 本来の仕様（FR-04-2）は Dify 上のクイズ生成アプリ（AI-3）による自動生成である。
 * ここは固定データの実装で、差し替え口だけ用意してある（`setQuizSource`）。
 * 生成へ移すときは、生成結果を `quizzes` テーブルへキャッシュする `QuizSource` を
 * 実装して差し替える。**サービス層は書き換えなくて済む形にしてある。**
 *
 * 出題の方針（FR-04-7 / 設計原則 G-8）:
 * 「まず何をするか」を問う設問（`action`）を先に出し、設備や備蓄を問う設問
 * （`knowledge`）は行動を扱ったあとに置く。順序を取り違えると、
 * **「モノをそろえれば備えたことになる」という逆の学習になる。**
 */

export interface QuizEntry {
  quizId: string
  /**
   * この出題に対応する行動カード（FR-14-5）。
   *
   * ★ `scene`（場面）を**未達成でも見せる見出し**にし、`action`（行動）は
   * 達成後にだけ見せる。行動を見出しにすると、**カード一覧を見るだけで
   * クイズの答えが読めてしまう。**
   */
  card: { scene: string; action: string }
  category: SpotCategory
  question: string
  options: string[]
  /** ★ 正解。レスポンスへ出すのは採点時だけ（FR-04-6 で不正解でも返す） */
  answerIndex: number
  /** 正解・不正解のどちらでも表示する（FR-04-6） */
  explanation: string
  kind: QuizKind
}

const QUIZ_ENTRIES: QuizEntry[] = [
  /* ---------------- 避難所・避難場所 ---------------- */
  {
    quizId: 'shelter-action-1',
    card: { scene: '大きな地震の直後', action: '頭を守って身を低くし、揺れが収まるまで動かない' },
    kind: 'action',
    category: 'shelter',
    question: '大きな地震で強い揺れを感じました。まずすることはどれですか。',
    options: [
      '頭を守って身を低くし、揺れが収まるのを待つ',
      '避難所へ向かって走り出す',
      '持ち出し袋をまとめる',
    ],
    answerIndex: 0,
    explanation:
      '揺れている最中に動くと、家具の転倒や落下物でけがをします。まず頭を守って身を低くし、収まってから移動してください。備蓄や持ち出し袋が役に立つのは、この最初の数十秒を生き延びた後です。',
  },
  {
    quizId: 'shelter-flood-1',
    card: { scene: '冠水した道を歩くとき', action: '足元が見えない水には入らない。膝上まで来たら高い場所へ' },
    kind: 'action',
    category: 'shelter',
    question: '大雨で道路が冠水しています。歩いて避難するとき、最も危険なのはどれですか。',
    options: ['外れたマンホールや側溝に落ちる', '靴が濡れる', '景色が見えにくい'],
    answerIndex: 0,
    explanation:
      '濁った水では足元がまったく見えず、外れたマンホールや側溝への転落が起きています。膝の上まで水が来たら無理に歩かず、高い場所へ移動してください。',
  },
  {
    quizId: 'shelter-open-1',
    card: { scene: '避難所へ向かう前', action: '開設されているかを確かめる。場所だけでは足りない' },
    kind: 'knowledge',
    category: 'shelter',
    question: '避難所について、行ってみるまで分からないことが多いのはどれですか。',
    options: ['その時に開設されているか', '建物の名前', 'おおよその場所'],
    answerIndex: 0,
    explanation:
      '場所は公開データで分かりますが、開設状況は載っていません。「警報が出て避難所へ行ったら開いていなかった」という声は実際に寄せられています。だからこそ現地で確かめた情報に価値があります。',
  },
  {
    quizId: 'shelter-toilet-1',
    card: { scene: '避難所でトイレが使いにくいとき', action: '水分を控えない。控えると脱水から血栓につながる' },
    kind: 'knowledge',
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
    quizId: 'aed-use-1',
    card: { scene: '人が倒れているのを見つけたとき', action: '助けを呼び、AEDを待たずに胸骨圧迫を始める' },
    kind: 'action',
    category: 'aed',
    question: '倒れている人を見つけたとき、AEDが届くまでにすべきことはどれですか。',
    options: ['大声で助けを呼び、胸骨圧迫を始める', '到着を静かに待つ', '体を揺すって起こす'],
    answerIndex: 0,
    explanation:
      '心停止では時間の経過とともに救命率が下がります。周囲に声をかけて119番とAEDの手配を頼み、その間も胸骨圧迫を続けることが最も効果があります。',
  },
  {
    quizId: 'aed-time-1',
    card: { scene: 'AEDを頼るとき', action: '24時間使える場所かを平時に確かめておく' },
    kind: 'knowledge',
    category: 'aed',
    question: 'AEDについて、いざという時に確認しておくと役に立つのはどれですか。',
    options: ['24時間使える場所にあるか', '製造メーカー', '設置された年'],
    answerIndex: 0,
    explanation:
      '店舗の中にあるAEDは営業時間外に使えません。「近くにあるが夜は取り出せない」という状況を事前に知っておくことが、実際に使えるかどうかを分けます。',
  },

  /* ---------------- バリアフリートイレ ---------------- */
  {
    quizId: 'toilet-action-1',
    card: { scene: '車いすやベビーカーで避難するとき', action: '建物より先に、そこまでの道の段差を確かめる' },
    kind: 'action',
    category: 'accessible_toilet',
    question: '車いすやベビーカーの家族と避難します。出発前にまず確かめることはどれですか。',
    options: [
      '通る道に段差や工事がないか',
      '避難所の建物が新しいか',
      '持ち物が全部そろっているか',
    ],
    answerIndex: 0,
    explanation:
      '避難所にたどり着けるかは、建物ではなく「そこまでの道」で決まります。段差や工事で通れないと、引き返す間に状況が悪くなります。持ち物をそろえるより先に、通れる道を決めてください。',
  },
  {
    quizId: 'toilet-access-1',
    card: { scene: 'トイレを使えるか判断するとき', action: '入口だけでなく、中で向きを変えられる広さを見る' },
    kind: 'knowledge',
    category: 'accessible_toilet',
    question: '車いすの人がトイレを使えるかどうかを左右するのは、次のうちどれですか。',
    options: ['中で向きを変えられる広さがあるか', '鏡の大きさ', '壁の色'],
    answerIndex: 0,
    explanation:
      '入口を通れても、中で方向転換できなければ使えません。旋回スペースの有無は写真で確認しやすく、当事者にとっては行けるかどうかを決める情報です。',
  },
  {
    quizId: 'toilet-water-1',
    card: { scene: '断水してトイレが使えないとき', action: '携帯トイレやマンホールトイレの備えを確かめる' },
    kind: 'knowledge',
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
    quizId: 'water-action-1',
    card: { scene: '地震の揺れが収まった直後', action: '断水する前に、浴槽などへ生活用水を確保する' },
    kind: 'action',
    category: 'water',
    question: '地震の揺れが収まりました。水について、まずすることはどれですか。',
    options: [
      '断水する前に、浴槽などへ生活用水を確保する',
      '給水拠点へ向かう',
      'ペットボトルを買いに行く',
    ],
    answerIndex: 0,
    explanation:
      '断水は揺れの直後ではなく少し経ってから起きることがあります。まだ水が出るうちに浴槽へ溜めておけば、トイレや手洗いに使えます。給水拠点が開くまでには時間がかかるため、先に手元で確保するほうが確実です。',
  },
  {
    quizId: 'water-supply-1',
    card: { scene: '水を備えるとき', action: '1人1日3リットルを目安に、運ぶ手段まで用意する' },
    kind: 'knowledge',
    category: 'water',
    question: '断水に備えて、1人が1日に必要とされる飲料水の目安はどれくらいですか。',
    options: ['約3リットル', '約0.5リットル', '約10リットル'],
    answerIndex: 0,
    explanation:
      '飲料と調理をあわせて1人1日3リットルが目安です。3日分で9リットル、できれば1週間分の備蓄が推奨されています。運ぶ手段（給水タンクや台車）も一緒に考えておくと安心です。',
  },
  {
    quizId: 'water-route-1',
    card: { scene: '給水拠点へ水をもらいに行くとき', action: '10リットルは10キログラム。段差や坂のない道を選ぶ' },
    kind: 'knowledge',
    category: 'water',
    question: '給水拠点へ水をもらいに行くとき、事前に知っておきたいのはどれですか。',
    options: ['そこまでの道に段差や坂がないか', '拠点の建物の築年数', '周辺の店の営業時間'],
    answerIndex: 0,
    explanation:
      '水は1リットルで1キログラムあります。10リットル運べば10キログラムで、段差や長い坂があると往復は大きな負担になります。道の状態は現地を歩いた人でないと分かりません。',
  },
]

const ENTRIES_BY_ID = new Map(QUIZ_ENTRIES.map((entry) => [entry.quizId, entry]))

const ENTRIES_BY_CATEGORY = QUIZ_ENTRIES.reduce<Partial<Record<SpotCategory, QuizEntry[]>>>(
  (acc, entry) => {
    const list = acc[entry.category] ?? []
    list.push(entry)
    acc[entry.category] = list
    return acc
  },
  {},
)

/**
 * 文字列から安定した整数を作る。
 *
 * ★ 同じスポットでは毎回同じ問題を出す。乱数にすると、リロードのたびに問題が
 * 変わり「答えを知っているのに別の問題が出る」体験になる。spotId から決めることで、
 * **サーバーに状態を持たずに**固定できる。
 */
function hashCode(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export interface PickQuizInput {
  spotId: SpotId
  category: SpotCategory
  /**
   * このスポットのクイズをすでに正解しているか。
   *
   * ★ 未正解なら行動を問う設問、正解済みなら設備・備蓄を問う設問を出す（FR-04-7）。
   * 「行動を扱ったあとに置く」を、スポット単位の順序として実装している。
   */
  alreadyCleared: boolean
}

/**
 * 出題の供給元。
 *
 * ★ Dify 生成（FR-04-2）への差し替え口である。生成側は正解つきの `QuizEntry` を
 * 返し、`quizzes` テーブルへのキャッシュも自分で行う（同一スポットで再利用可）。
 * サービス層はこの境界しか知らないので、差し替えても書き換えが要らない。
 *
 * ★ 非同期にしてあるのは、生成が外部通信になるためである。固定データの実装が
 * 同期だからといって同期の型にすると、差し替え時にサービス層まで波及する。
 */
export interface QuizSource {
  /** スポットに合う出題を1件。**正解を含む**ためサーバー内でのみ扱う */
  pick(input: PickQuizInput): Promise<QuizEntry | undefined>
  /** 採点のために quizId から引き直す */
  find(quizId: string): Promise<QuizEntry | undefined>
}

/** 固定データの供給元。MOCK_MODE 相当 */
export const fixtureQuizSource: QuizSource = {
  pick(input) {
    const all = ENTRIES_BY_CATEGORY[input.category]
    if (all === undefined || all.length === 0) return Promise.resolve(undefined)

    // 行動を先に、設備・備蓄は後に（FR-04-7 / G-8）。片方が無いカテゴリは全件から選ぶ
    const preferred = all.filter((entry) =>
      input.alreadyCleared ? entry.kind === 'knowledge' : entry.kind === 'action',
    )
    const entries = preferred.length > 0 ? preferred : all

    return Promise.resolve(entries[hashCode(input.spotId) % entries.length])
  },

  find(quizId) {
    return Promise.resolve(ENTRIES_BY_ID.get(quizId))
  },
}

/**
 * すべての出題。**行動カード（FR-14-5）の一覧を組み立てるために使う。**
 *
 * ★ 正解と解説を含むので、呼び出しはサーバー内に限ること。カードの一覧では
 * `card.scene` と `card.action` しか使わない。
 */
export function allQuizEntries(): readonly QuizEntry[] {
  return QUIZ_ENTRIES
}

let activeSource: QuizSource = fixtureQuizSource

/** 生成（AI-3）へ差し替える。テストからも使う */
export function setQuizSource(source: QuizSource): void {
  activeSource = source
}

export function resetQuizSource(): void {
  activeSource = fixtureQuizSource
}

export function quizSource(): QuizSource {
  return activeSource
}

/** 出題を画面へ渡す形にする。**正解と解説を落とすのはここだけ** */
export function toPrompt(entry: QuizEntry, generatedBy: QuizPrompt['generatedBy']): QuizPrompt {
  return {
    quizId: entry.quizId,
    question: entry.question,
    options: entry.options,
    generatedBy,
  }
}
