import type { QuizKind } from './quiz.js'
import type { SpotCategory } from './spot.js'

/**
 * 構造化ナレッジベース（#75・FR-04-2）。
 *
 * ★ **これはクイズではない。** 軽量モデルがクイズを書くための**材料**である。
 * 提出物 3-2 とスライド7の「取り込み時だけ高性能モデルで構造化ナレッジを作り、
 * 利用時は軽量モデルがそのナレッジだけを材料に書く」という二段構えの、
 * 真ん中に置かれるもの。
 *
 * ★ **真偽はここが持つ。モデルには持たせない。**
 * 1エントリが「正しい主張（claim）」と「よくある誤解（distractors）」を最初から
 * 持っており、軽量モデルの仕事は**言い回しを整えることだけ**である。
 * 防災の文言の誤りは命に関わる。どれが正解かを毎回モデルに判断させると、
 * 言い回しのぶれがそのまま正誤のぶれになる。
 *
 * ★ **人が確かめていないものは配らない**（`reviewed`）。
 * 高性能モデルが作ったエントリは `reviewed: false` で生成物に入り、**人が PR の
 * diff で読んで true にするまで出題に使われない。** 3-2 の「人が確かめたナレッジの
 * 範囲でしか書かせません」は、この1つのフラグで執行される。
 * 生成物をファイルにしてコミットしているのは、レビューできる形にするためである
 * （データストアへ入れると、誰も読まないまま本番に載る）。
 */

/* ------------------------------------------------------------------ *
 * 出典
 * ------------------------------------------------------------------ */

/**
 * 出典と取得日（3-2「出典と取得日を保った構造化ナレッジ」）。
 *
 * ★ エントリごとに持たせる。ファイル単位で1つにすると、**どの主張がどこから来たか**
 * が消える。行政へ返すデータと同じで、根拠を辿れないものは使えない。
 */
export interface KnowledgeSource {
  title: string
  /** 一次資料の URL。手元の資料しか無いなら空文字にせず、資料名を title に書く */
  url: string
  /** YYYY-MM-DD */
  fetchedAt: string
}

/* ------------------------------------------------------------------ *
 * エントリ
 * ------------------------------------------------------------------ */

/**
 * ナレッジが効く範囲。
 *
 * ★ 3層に分けているのは、**スポット単体では材料が足りない**ためである。
 * AED は取り込んだ 224 件すべてで属性が空で、避難所もオストメイトの記載は
 * 72 件中 10 件しかない。「このAEDについての知識」は書けないので、
 * カテゴリと町丁目の層で厚みを作り、スポット層は分かっていることだけを持つ。
 */
export type KnowledgeScope = 'category' | 'chome' | 'spot'

export interface KnowledgeEntry {
  entryId: string
  scope: KnowledgeScope
  /**
   * 効く相手。`category` なら SpotCategory、`chome` なら小地域コード、
   * `spot` なら spotId。
   */
  key: string
  /** どのカテゴリの出題に使えるか。町丁目層でも対象カテゴリを絞る */
  category: SpotCategory
  /**
   * この主張が答えている問い。
   *
   * ★ **claim だけでは意味が立たないことがある。** 固定出題から移したエントリは
   * 選択肢がそのまま claim になっており、「24時間使える場所にあるか」のように
   * 問いの断片として読める。元の問いを一緒に持たせないと、**軽量モデルが
   * 何についての主張か分からないまま言い換えることになる。**
   * 分かりきっているなら空でよい。
   */
  context: string
  /** 行動を問うか、知識を問うか（FR-04-7・G-8） */
  kind: QuizKind
  /**
   * 正しい主張。**ここだけが真である。**
   *
   * ★ 完成した問題文ではなく、言い切りの1文にする。軽量モデルはこれを
   * 問いの形へ組み直すだけで、内容を足さない。
   */
  claim: string
  /**
   * よくある誤解。そのまま不正解の選択肢になる。
   *
   * ★ **2件以上必要である**（3択にするため）。「明らかに変な選択肢」を置くと
   * 消去法で解けてしまい、学習にならない。実際に人が誤解している内容を書く。
   */
  distractors: string[]
  /** なぜそれが重要か。解説（FR-04-6）の材料になる */
  why: string
  sources: KnowledgeSource[]
  /**
   * 人が読んで確かめたか。
   *
   * ★ **false のものは出題に使わない**（`usableEntries` が落とす）。
   * 高性能モデルが作った直後は必ず false で、人が PR で読んでから true にする。
   */
  reviewed: boolean
}

export interface KnowledgeBase {
  /** 生成した日（YYYY-MM-DD）。古さに気づけるように残す */
  generatedAt: string
  entries: readonly KnowledgeEntry[]
}

/* ------------------------------------------------------------------ *
 * 検証
 * ------------------------------------------------------------------ */

/** 3択にするために要る不正解の数 */
export const MIN_DISTRACTORS = 2

/**
 * エントリとして成立しているか。**成立しない理由を返す。**
 *
 * ★ 生成物を作るときと、出題に使う前の両方で通す。壊れたエントリは画面では
 * 普通のクイズに見えてしまい、**間違いに気づけるのは現地で困った人だけ**になる。
 */
export function validateEntry(entry: KnowledgeEntry): string[] {
  const problems: string[] = []

  if (entry.claim.trim() === '') problems.push('claim が空')
  if (entry.why.trim() === '') problems.push('why が空')
  if (entry.key.trim() === '') problems.push('key が空')

  if (entry.distractors.length < MIN_DISTRACTORS) {
    problems.push(`distractors が ${entry.distractors.length} 件（${MIN_DISTRACTORS} 件以上必要）`)
  }
  if (entry.distractors.some((d) => d.trim() === '')) problems.push('空の distractor がある')

  /*
   * ★ 正解と同じ内容が不正解側に入っていないか。入っていると**正解が2つある問題**に
   * なり、答えた人が「自分が間違えた」と思い込む。生成では起こりうる壊れ方である。
   */
  const claim = normalize(entry.claim)
  if (entry.distractors.some((d) => normalize(d) === claim)) {
    problems.push('claim と同じ distractor がある（正解が2つになる）')
  }
  if (new Set(entry.distractors.map(normalize)).size !== entry.distractors.length) {
    problems.push('distractors に重複がある')
  }

  if (entry.sources.length === 0) problems.push('sources が空（根拠を辿れない）')
  for (const source of entry.sources) {
    if (source.title.trim() === '') problems.push('出典の title が空')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.fetchedAt)) {
      problems.push(`出典の fetchedAt が YYYY-MM-DD でない: ${source.fetchedAt}`)
    }
  }

  return problems
}

/**
 * 表記のゆれを均して比べる。空白と句読点の差で「別物」と判定させない。
 *
 * ★ `\s` は全角空白（U+3000）も拾うので、文字クラスへ直接書かない。
 * 見た目で区別できない文字をソースへ置くと、**消えても誰も気づけない。**
 */
function normalize(text: string): string {
  return text.replace(/\s/g, '').replace(/[。、．，!！?？]/g, '')
}

/* ------------------------------------------------------------------ *
 * 選び出し
 * ------------------------------------------------------------------ */

/**
 * 出題に使ってよいエントリ。
 *
 * ★ **未レビューと壊れているものを落とす。** ここが「人が確かめた範囲でしか
 * 書かせない」の実体である。呼ぶ側が忘れられる形にはしない。
 */
export function usableEntries(base: KnowledgeBase): KnowledgeEntry[] {
  return base.entries.filter((entry) => entry.reviewed && validateEntry(entry).length === 0)
}

export interface KnowledgeQuery {
  category: SpotCategory
  spotId: string
  /** 現在地の町丁目コード。分からなければ undefined */
  chomeCode: string | undefined
  /**
   * 行動を先に出す（FR-04-7・G-8）。
   *
   * ★ すでに行動の出題を終えているなら知識側へ回す。順序を取り違えると
   * 「モノをそろえれば備えたことになる」という逆の学習になる。
   */
  prefer: QuizKind
}

/**
 * そのスポットで使えるエントリを、**近い順**に並べて返す。
 *
 * ★ 並びは spot → chome → category である。そのスポットについて分かっていることが
 * あればそれを使い、無ければ町丁目、それも無ければカテゴリの一般論へ落ちる。
 * **落ちても必ず何か出る**ようにしてあるのは、生成が空を返すと画面が詰まるためで、
 * 固定データへ落ちる経路（`fixtureQuizSource`）と同じ考え方である。
 */
export function selectEntries(base: KnowledgeBase, query: KnowledgeQuery): KnowledgeEntry[] {
  const matched = usableEntries(base).filter((entry) => {
    if (entry.category !== query.category) return false
    if (entry.scope === 'spot') return entry.key === query.spotId
    if (entry.scope === 'chome') return query.chomeCode !== undefined && entry.key === query.chomeCode
    return true
  })

  const scopeRank: Record<KnowledgeScope, number> = { spot: 0, chome: 1, category: 2 }

  return matched.sort((a, b) => {
    // 望む種類を先に。無ければもう一方でも出す（詰まらせない）
    const kindDiff = Number(a.kind !== query.prefer) - Number(b.kind !== query.prefer)
    if (kindDiff !== 0) return kindDiff

    const scopeDiff = scopeRank[a.scope] - scopeRank[b.scope]
    if (scopeDiff !== 0) return scopeDiff

    return a.entryId.localeCompare(b.entryId)
  })
}

/**
 * 軽量モデルへ渡す材料。
 *
 * ★ **モデルに渡すのはこれだけである。** スポットの生データや他のエントリを
 * 一緒に渡すと、モデルがそこから勝手に事実を作る余地ができる。
 * 渡す範囲を絞ることが、そのまま安全側の設計になっている。
 */
export interface QuizMaterial {
  entryId: string
  claim: string
  /** claim が答えている問い。空のことがある */
  context: string
  distractors: string[]
  why: string
  /** 出題の足場にする場所の名前。「〇〇の前で」と言えるようにするため */
  spotName: string
  category: SpotCategory
  kind: QuizKind
  sources: KnowledgeSource[]
}

export function materialFor(entry: KnowledgeEntry, spotName: string): QuizMaterial {
  return {
    entryId: entry.entryId,
    claim: entry.claim,
    context: entry.context,
    distractors: [...entry.distractors],
    why: entry.why,
    spotName,
    category: entry.category,
    kind: entry.kind,
    sources: entry.sources,
  }
}

/* ------------------------------------------------------------------ *
 * 集計（生成物のヘッダとダッシュボード用）
 * ------------------------------------------------------------------ */

export interface KnowledgeStats {
  total: number
  reviewed: number
  /** 未レビュー＝**まだ配っていない**。0 でないことが普通の状態である */
  unreviewed: number
  invalid: number
  byScope: Record<KnowledgeScope, number>
}

export function statsOf(base: KnowledgeBase): KnowledgeStats {
  const byScope: Record<KnowledgeScope, number> = { category: 0, chome: 0, spot: 0 }
  let reviewed = 0
  let invalid = 0

  for (const entry of base.entries) {
    byScope[entry.scope] += 1
    if (entry.reviewed) reviewed += 1
    if (validateEntry(entry).length > 0) invalid += 1
  }

  return {
    total: base.entries.length,
    reviewed,
    unreviewed: base.entries.length - reviewed,
    invalid,
    byScope,
  }
}
