import {
  materialFor,
  selectEntries,
  type KnowledgeBase,
  type KnowledgeEntry,
  type QuizKind,
} from '@imanouchi/shared'
import { fixtureQuizSource, type PickQuizInput, type QuizEntry, type QuizSource } from '../../data/quiz-bank.js'
import { chat, isConfigured, parseJson, type OrcaRouterConnection } from './orcarouter.js'

/**
 * ナレッジからのクイズ生成（FR-04-2・#75）。
 *
 * ★ **モデルに正解を決めさせない。**
 * 選択肢は人が確かめたナレッジの文言（`claim` と `distractors`）を**そのまま**使い、
 * 正解の位置はこちらが決める。モデルが書くのは**問題文・解説・カードの見出し**だけで、
 * どれも間違っても命に関わらない部分である。
 *
 * ★ **生成が無くても成立する。** 下の `entryFromKnowledge` が、モデルを呼ばずに
 * 出題として成立するものを作る。生成はその上へ言い回しを重ねるだけである。
 * これが効くのは採点のときで、**Lambda のインスタンスが変わってキャッシュが
 * 消えていても、同じ正解を組み立て直せる**（`find` が 404 にならない）。
 *
 * ★ **落ちたら固定データへ戻る。** 生成の失敗・遅延で画面を止めない（G-7）。
 */

/* ------------------------------------------------------------------ *
 * ナレッジから決定的に組み立てる（モデルを呼ばない部分）
 * ------------------------------------------------------------------ */

/** 出題ID。ナレッジ1件につき1つ。**スポットをまたいで使い回す**（生成回数を抑える） */
export function quizIdFor(entry: KnowledgeEntry): string {
  return `kb-${entry.entryId}`
}

/** 文字列から安定した数を作る。並びを毎回変えないために使う */
function hashCode(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * 選択肢の並び。
 *
 * ★ **毎回同じ並びにする。** 出題と採点は別のリクエストで、間に Lambda の
 * インスタンスが入れ替わりうる。並びが変わると、利用者が選んだ番号と採点側の
 * 番号がずれ、**正解したのに不正解と言われる。**
 *
 * ★ それでも正解を先頭に固定はしない。固定すると「いつも1番目」で解ける。
 * ナレッジのIDから決まる位置へ入れる。
 */
function arrangeOptions(entry: KnowledgeEntry): { options: string[]; answerIndex: number } {
  const options = [...entry.distractors]
  const answerIndex = hashCode(entry.entryId) % (options.length + 1)
  options.splice(answerIndex, 0, entry.claim)
  return { options, answerIndex }
}

/**
 * モデルを呼ばずに作る出題。
 *
 * ★ **ここだけで出題として成立する。** 問題文はナレッジが持つ問い（`context`）を
 * 使い、無ければ種類に応じた一般的な問いにする。解説は `why`（人が確かめた文）である。
 */
export function entryFromKnowledge(entry: KnowledgeEntry): QuizEntry {
  const { options, answerIndex } = arrangeOptions(entry)

  return {
    quizId: quizIdFor(entry),
    card: {
      /*
       * ★ 見出しは**答えを見せない**ものにする（FR-14-5）。ナレッジの問いをそのまま
       * 使えば、少なくとも答えは載らない。生成はここへ短い場面を上書きする。
       */
      scene: entry.context !== '' ? entry.context : defaultQuestion(entry.kind),
      // ★ カードの中身は claim をそのまま。**人が確かめた文言以外を配らない**
      action: entry.claim,
    },
    category: entry.category,
    question: entry.context !== '' ? entry.context : defaultQuestion(entry.kind),
    options,
    answerIndex,
    explanation: entry.why,
    kind: entry.kind,
    generatedBy: 'fixture',
  }
}

function defaultQuestion(kind: QuizKind): string {
  return kind === 'action'
    ? 'この場所で、まずすることはどれですか。'
    : 'この場所について、正しいのはどれですか。'
}

/* ------------------------------------------------------------------ *
 * 生成（モデルが書くのは言い回しだけ）
 * ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `あなたは防災クイズの文章を整える編集者です。

**あなたは正解を決めません。** 選択肢と正解はすでに決まっています。
あなたの仕事は、与えられた選択肢がそのまま答えになる「問い」と「解説」を書くことです。

守ること:
- 出力は JSON のみ。説明文を付けない。
- question: 与えられた選択肢のどれかを選ぶ形の問い。**選択肢の文言を問いに含めない**（答えが読めてしまう）。60字以内。
- explanation: なぜその答えなのかを、与えられた「理由」の範囲で書く。**新しい事実を足さない。** 120字以内。
- scene: カードの見出しにする短い場面。**正解の内容を書かない**（見出しだけで答えが読めてしまう）。20字以内。
- 施設の固有名詞を書かない（同じ問いを複数の場所で使うため）。
- 日本語で書く。`

interface GeneratedText {
  question?: string
  explanation?: string
  scene?: string
}

export interface QuizGeneratorOptions {
  connection: OrcaRouterConnection
  /**
   * 使うモデル。**軽量モデルを渡すこと。**
   *
   * ★ 接続の設定から分けてある。設定オブジェクトが両方の段のモデル名を持っていると、
   * ここで取り込み用（高性能）を渡してしまっても型が通る。**渡せるものを1つにする。**
   */
  model: string
  base: KnowledgeBase
  /**
   * 生成に許す時間。
   *
   * ★ **短くする。** 利用者はチェックインの直後にこの画面を見ている。
   * 数秒待たせるくらいなら、固定の言い回しで即座に出すほうがよい（G-7）。
   */
  timeoutMs: number
}

/**
 * 生成した言い回しを重ねる。**失敗したら重ねない**（例外にしない）。
 */
async function decorate(
  options: QuizGeneratorOptions,
  entry: KnowledgeEntry,
  fallback: QuizEntry,
): Promise<QuizEntry> {
  const material = materialFor(entry, '')

  const user = `選択肢（この文言のまま出します。変えないでください）:
${fallback.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}

正解: ${material.claim}
${material.context !== '' ? `もとの問い: ${material.context}\n` : ''}理由: ${material.why}
種類: ${material.kind === 'action' ? 'まず何をするか（行動）' : '設備や知識'}

出力する JSON の形:
{"question":"...","explanation":"...","scene":"..."}`

  const content = await chat(
    { ...options.connection, timeoutMs: options.timeoutMs },
    {
      model: options.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
      json: true,
      /*
       * ★ 余裕を持たせる。軽量モデルは**思考のトークンもこの枠から使う**ため、
       * 出力の見た目に対して枠を切り詰めると、**JSON が途中で切れて毎回失敗する**
       * （実測：gemini-2.5-flash は 500 で `{ "question":` までしか返らなかった）。
       * 使い切らなければ課金もされないので、狭くする理由がない。
       */
      maxTokens: 1500,
    },
  )

  const text = parseJson<GeneratedText>(content)

  const question = (text.question ?? '').trim()
  const explanation = (text.explanation ?? '').trim()
  const scene = (text.scene ?? '').trim()

  /*
   * ★ **答えが漏れていないかを確かめる。** 問いや見出しに正解の文言が入ると、
   * 読むだけで解けてしまい、学習にならない。モデルは指示に従わないことがあるので、
   * 従ったかどうかをこちらで見る。漏れていたら、その項目だけ捨てる。
   */
  const leaks = (candidate: string): boolean =>
    candidate === '' || containsAnswer(candidate, entry.claim)

  return {
    ...fallback,
    question: leaks(question) ? fallback.question : question,
    explanation: explanation === '' ? fallback.explanation : explanation,
    card: {
      scene: leaks(scene) ? fallback.card.scene : scene,
      // ★ カードの中身は上書きさせない。**人が確かめた文言のまま配る**
      action: fallback.card.action,
    },
    generatedBy: 'llm',
  }
}

/**
 * 正解の文言が透けているか。
 *
 * ★ 完全一致では拾えない。「〜する」を「〜しましょう」に変えただけでも読めてしまう。
 * 正解から**内容語の並び**を取り出し、そのうちの多くが含まれていたら漏れとみなす。
 * 取りこぼすより、生成を捨てて固定の言い回しに戻るほうが安い。
 */
function containsAnswer(candidate: string, claim: string): boolean {
  const normalized = candidate.replace(/\s/g, '')
  // 句読点で切り、短すぎる断片は落とす（「は」「を」で誤検知しないため）
  const chunks = claim
    .replace(/\s/g, '')
    .split(/[。、，．,]/)
    .filter((chunk) => chunk.length >= 6)

  if (chunks.length === 0) {
    // 短い claim は先頭6文字で見る
    const head = claim.replace(/\s/g, '').slice(0, 6)
    return head.length >= 4 && normalized.includes(head)
  }

  return chunks.some((chunk) => normalized.includes(chunk.slice(0, 8)))
}

/* ------------------------------------------------------------------ *
 * 供給元
 * ------------------------------------------------------------------ */

/**
 * ナレッジから出題する供給元。
 *
 * ★ キャッシュは**この Lambda インスタンスの中だけ**である。データストアに
 * `quizzes` テーブルを足すと環境変数とコンソールでの作成が要り、設定が欠けると
 * `configOk` が false になってデプロイのスモークテストが落ちる。
 * **言い回しを保つためだけに、その代償は釣り合わない。**
 * インスタンスが変わっても `entryFromKnowledge` が同じ正解を作り直せるので、
 * 失われるのは言い回しだけである。
 */
export function createKnowledgeQuizSource(options: QuizGeneratorOptions): QuizSource {
  const cache = new Map<string, QuizEntry>()

  /** ナレッジを id で引けるようにしておく。採点のたびに探し直さない */
  const byQuizId = new Map<string, KnowledgeEntry>()
  for (const entry of options.base.entries) byQuizId.set(quizIdFor(entry), entry)

  return {
    async pick(input: PickQuizInput): Promise<QuizEntry | undefined> {
      const candidates = selectEntries(options.base, {
        category: input.category,
        spotId: input.spotId,
        // ★ 町丁目層はまだ無い。位置はここまで渡ってこないので undefined のまま
        chomeCode: undefined,
        prefer: input.alreadyCleared ? 'knowledge' : 'action',
      })

      // 配れるナレッジが1件も無ければ固定データ（未承認しか無いときに起きる）
      const entry = candidates[hashCode(input.spotId) % Math.max(1, candidates.length)]
      if (!entry) return fixtureQuizSource.pick(input)

      const cached = cache.get(quizIdFor(entry))
      if (cached) return cached

      const fallback = entryFromKnowledge(entry)

      if (!isConfigured(options.connection)) {
        // 鍵が無い。ナレッジは使うが、言い回しは素のまま
        cache.set(fallback.quizId, fallback)
        return fallback
      }

      try {
        const decorated = await decorate(options, entry, fallback)
        cache.set(decorated.quizId, decorated)
        return decorated
      } catch (error) {
        /*
         * ★ **例外を外へ出さない。** 生成が落ちたことで出題そのものが出ないのは
         * 割に合わない。素の言い回しで出し、次の呼び出しでまた生成を試みる。
         */
        console.warn(`[quiz] 生成に失敗したため素の言い回しで出します: ${String(error)}`)
        return fallback
      }
    },

    find(quizId: string): Promise<QuizEntry | undefined> {
      const cached = cache.get(quizId)
      if (cached) return Promise.resolve(cached)

      /*
       * ★ キャッシュが無くても**必ず同じ正解を返す。** ここが undefined を返すと、
       * インスタンスが入れ替わった利用者に「クイズが見つかりません」が出る。
       * 正解も選択肢もナレッジから決まるので、作り直せる。
       */
      const entry = byQuizId.get(quizId)
      if (entry) return Promise.resolve(entryFromKnowledge(entry))

      return fixtureQuizSource.find(quizId)
    },
  }
}
