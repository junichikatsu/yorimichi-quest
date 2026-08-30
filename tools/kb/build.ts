/**
 * 構造化ナレッジベースの構築（#75・FR-04-2）。
 *
 *   pnpm build:kb            種だけ作る（モデルを呼ばない。鍵が要らない）
 *   pnpm build:kb --expand   高性能モデルで広げる（OrcaRouter の鍵が要る）
 *
 * ★ **出力は生成物ファイルである**（`apps/function/src/data/knowledge-base.ts`）。
 * `opendata-spots.ts`・`chome-data.ts` と同じ扱いで、コミットして ZIP へ同梱する。
 * データストアへ入れないのは、**入れると誰も読まないまま本番に載る**ためである。
 * ファイルなら PR の diff に出る。防災士が読んでから配れる。
 *
 * ★ **高性能モデルを呼ぶのはここだけである。** 提出物 3-2 とスライド7の
 * 「コストは利用者数ではなくデータ件数で決まる」は、この一点で成り立っている。
 * 実行時にここを呼んではいけない。
 *
 * ★ **承認は生成物の外に置く**（`tools/kb/approved.json`）。生成物には「手で
 * 編集しないこと」と書いてあるので、その中の `reviewed` を人が書き換える運用に
 * すると、再生成のたびに承認が消えるか、注意書きが嘘になる。人が触るファイルを分ける。
 */

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SPOT_CATEGORIES,
  SPOT_CATEGORY_LABELS,
  statsOf,
  surveyFormFor,
  validateEntry,
  type KnowledgeBase,
  type KnowledgeEntry,
  type SpotCategory,
} from '@imanouchi/shared'

import { allQuizEntries } from '../../apps/function/src/data/quiz-bank.js'
import { OPENDATA_SOURCES } from '../../apps/function/src/data/opendata-spots.js'
import { chat, isConfigured, parseJson, type OrcaRouterConfig } from '../../apps/function/src/services/ai/orcarouter.js'
import { KNOWLEDGE_BASE } from '../../apps/function/src/data/knowledge-base.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'apps/function/src/data/knowledge-base.ts')

const TODAY = new Date().toISOString().slice(0, 10)

/*
 * ★ `.env` は**このスクリプトが自分で読む。**
 *
 * `tsx --env-file` は起動時の作業ディレクトリからの相対で解決され、
 * pnpm のフィルタ経由だとどこから走るかが変わる。**読めていないのに黙って進む**ので、
 * 鍵が無いのか場所が違うのかが切り分けられない。ROOT からの絶対パスで読む。
 */
try {
  process.loadEnvFile(join(ROOT, '.env'))
} catch {
  // 無くてよい。--expand しないなら鍵は要らない
}

/* ------------------------------------------------------------------ *
 * 承認台帳
 * ------------------------------------------------------------------ */

/**
 * 承認は**生成物の外に置く**（`tools/kb/approved.json`）。
 *
 * ★ 生成物には「手で編集しないこと」と書いてある。その中の `reviewed` を人が
 * 手で書き換える運用にすると、**再生成のたびに承認が消えるか、注意書きが嘘になる**。
 * どちらも起きないよう、人が触るファイルを分ける。
 *
 * ★ 台帳は「entryId → 指紋 + 承認したか」。**指紋が一致したときだけ承認が効く。**
 * 同じ id のまま claim を書き換えても、承認は自動的に外れる。
 * **承認を継ぎ足せないようにしてある。**
 */
const LEDGER = join(ROOT, 'tools/kb/approved.json')

interface LedgerRow {
  fingerprint: string
  approved: boolean
  /** 何を承認したのかが台帳だけで読めるように残す。判定には使わない */
  claim: string
}

type Ledger = Record<string, LedgerRow>

/**
 * 中身の指紋。
 *
 * ★ 主張・不正解・理由のどれかが変われば別のものとして扱い、もう一度読んでもらう。
 * entryId だけで承認を引き継ぐと、**人が読んでいない文言が「確認済み」として配られる。**
 */
function fingerprint(entry: Pick<KnowledgeEntry, 'claim' | 'context' | 'distractors' | 'why'>): string {
  const material = JSON.stringify([entry.claim, entry.context, [...entry.distractors].sort(), entry.why])
  return createHash('sha256').update(material).digest('hex').slice(0, 16)
}

async function readLedger(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(LEDGER, 'utf-8')) as Ledger
  } catch {
    // 初回は無い。空から始める
    return {}
  }
}

/**
 * 台帳を突き合わせ、`reviewed` を決める。**台帳も更新して返す。**
 *
 * ★ 新しいエントリは `approved: false` で台帳へ並ぶ。人はそこを true にするだけでよく、
 * 指紋を手で写す必要はない。
 */
function applyLedger(
  entries: KnowledgeEntry[],
  ledger: Ledger,
): { entries: KnowledgeEntry[]; ledger: Ledger; reset: string[] } {
  const next: Ledger = {}
  const reset: string[] = []

  const applied = entries.map((entry) => {
    const print = fingerprint(entry)
    const previous = ledger[entry.entryId]
    const approved = previous?.approved === true && previous.fingerprint === print

    if (previous?.approved === true && previous.fingerprint !== print) {
      reset.push(entry.entryId)
    }

    next[entry.entryId] = { fingerprint: print, approved, claim: entry.claim }
    return { ...entry, reviewed: approved }
  })

  return { entries: applied, ledger: next, reset }
}

/* ------------------------------------------------------------------ *
 * 種：すでに人が書いたものを移す
 * ------------------------------------------------------------------ */

/**
 * 固定出題（`quiz-bank.ts`）をナレッジへ移す。
 *
 * ★ **モデルを呼ばない。** これらは人が書いて、いま本番で配っているものである。
 * 正解の選択肢がそのまま `claim`、残りが `distractors`、解説が `why` になる。
 * 形がそのまま合うのは偶然ではなく、**クイズが「主張＋よくある誤解」でできている**
 * からで、この構造を取り出したものがナレッジである。
 *
 * ★ 出典は「チームが書いた」ことを明示する。一次資料の URL は付いていない。
 * ここを推測で埋めると、**確かめていない出典が付いた文言**になる。
 * 一次資料の紐づけはレビューの仕事として残す。
 */
function seedEntries(): KnowledgeEntry[] {
  return allQuizEntries().map((quiz) => {
    const distractors = quiz.options.filter((_option, index) => index !== quiz.answerIndex)

    return {
      entryId: `seed-${quiz.quizId}`,
      scope: 'category' as const,
      key: quiz.category,
      category: quiz.category,
      // ★ 元の問いを残す。選択肢だけでは「24時間使える場所にあるか」のように断片になる
      context: quiz.question,
      kind: quiz.kind,
      claim: quiz.options[quiz.answerIndex] ?? '',
      distractors,
      why: quiz.explanation,
      sources: [
        {
          title: 'イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）',
          url: '',
          fetchedAt: '2026-08-22',
        },
      ],
      // ★ ここでは決めない。**承認は台帳が決める**（applyLedger が上書きする）
      reviewed: false,
    }
  })
}

/* ------------------------------------------------------------------ *
 * 拡張：高性能モデルで広げる
 * ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `あなたは日本の防災の専門家です。市民向け防災アプリで使う「ナレッジ」を作ります。

守ること:
- 出力は JSON のみ。説明文を付けない。
- claim は「正しい行動や事実」を言い切りの1文で書く。問題文にしない。
- distractors は「実際によくある誤解」を2件。明らかに変な選択肢は書かない（消去法で解けてしまう）。
- distractors に claim と同じ意味のものを入れない。
- why は「なぜそれが重要か」を1〜2文で。命に関わる理由を具体的に。
- 断定できないことは書かない。地域固有の事実を推測で書かない。
- 日本語で書く。`

interface ExpandedEntry {
  claim: string
  distractors: string[]
  why: string
}

/**
 * カテゴリ層を広げる。
 *
 * ★ **町丁目層とスポット層はまだ広げない。** 材料が無いためである。AED は
 * 取り込んだ 224 件すべてで属性が空、避難所もオストメイトの記載は 72 件中 10 件しか
 * 無い。**無い材料からモデルに書かせると、それは推測を配ることになる。**
 * FR-05・FR-06 で市民の回答が入ってから広げる。
 */
async function expandCategory(
  config: OrcaRouterConfig,
  category: SpotCategory,
  existing: readonly KnowledgeEntry[],
): Promise<KnowledgeEntry[]> {
  const form = surveyFormFor(category)
  const already = existing.filter((entry) => entry.category === category).map((entry) => entry.claim)

  const user = `施設の種類: ${SPOT_CATEGORY_LABELS[category]}

この種類の施設について、現地で市民に伝えたい防災の要点を4件作ってください。
2件は「まず何をするか」（kind: action）、2件は設備や知識（kind: knowledge）にしてください。

現地で市民に尋ねている項目（この観点に沿うと、集めているデータと噛み合います）:
${form.fields.map((field) => `- ${field.question}（理由: ${field.why}）`).join('\n')}

すでにある要点（重複させないでください）:
${already.length > 0 ? already.map((claim) => `- ${claim}`).join('\n') : '（なし）'}

出力する JSON の形:
{"entries":[{"kind":"action","claim":"...","distractors":["...","..."],"why":"..."}]}`

  const content = await chat(config, {
    model: config.ingestModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: user },
    ],
    json: true,
    maxTokens: 2000,
  })

  const payload = parseJson<{ entries?: (ExpandedEntry & { kind?: string })[] }>(content)

  return (payload.entries ?? []).map((raw, index) => ({
    entryId: `gen-${category}-${index + 1}`,
    scope: 'category' as const,
    key: category,
    category,
    context: '',
    kind: raw.kind === 'knowledge' ? ('knowledge' as const) : ('action' as const),
    claim: String(raw.claim ?? '').trim(),
    distractors: (raw.distractors ?? []).map((d) => String(d).trim()).filter((d) => d !== ''),
    why: String(raw.why ?? '').trim(),
    sources: [
      {
        title: `生成（OrcaRouter 経由 ${config.ingestModel}）。**未レビュー。一次資料の確認が必要**`,
        url: '',
        fetchedAt: TODAY,
      },
    ],
    // ★ 生成した直後は必ず未レビュー。台帳に無いので applyLedger も false にする
    reviewed: false,
  }))
}

/* ------------------------------------------------------------------ *
 * 出力
 * ------------------------------------------------------------------ */

function emit(base: KnowledgeBase): string {
  const stats = statsOf(base)

  const header = `/**
 * ★ 自動生成ファイル。手で編集しないこと。
 *
 * 生成元: tools/kb/build.ts（#75・FR-04-2）／再生成: pnpm build:kb
 *
 * 構造化ナレッジベース。**クイズそのものではなく、クイズを書くための材料**である。
 * 提出物 3-2 の二段構えの真ん中に置かれる：
 *   取り込み（ここ）= 高性能モデル1回 → 利用時 = 軽量モデルが都度、この範囲だけで書く
 *
 * ★ **\`reviewed: false\` のものは配られない**（shared/knowledge.ts の usableEntries）。
 *   人が読んで true にするまで出題に使われない。これが 3-2 の
 *   「人が確かめたナレッジの範囲でしか書かせません」の実体である。
 *
 * ★ **レビューはこのファイルではなく \`tools/kb/approved.json\` で行う。**
 *   この diff を読み、正しければ台帳の \`approved\` を true にして再実行する。
 *   台帳は指紋を持っており、**中身が変われば承認は自動で外れる**（継ぎ足せない）。
 *
 * 生成時点: ${base.generatedAt}
 * 件数: 全 ${stats.total} 件（確認済み ${stats.reviewed} 件 / **未確認 ${stats.unreviewed} 件**）
 * 内訳: カテゴリ ${stats.byScope.category} / 町丁目 ${stats.byScope.chome} / スポット ${stats.byScope.spot}
 *
 * 取り込み元の出典
${OPENDATA_SOURCES.map((source) => ` * - ${source.title}（取得 ${source.fetchedAt}）`).join('\n')}
 */

import type { KnowledgeBase } from '@imanouchi/shared'

export const KNOWLEDGE_BASE: KnowledgeBase = `

  return `${header}${JSON.stringify(base, null, 2)}\n`
}

/* ------------------------------------------------------------------ *
 * 実行
 * ------------------------------------------------------------------ */

/** 台帳を id 順に並べる。順序が揺れると diff が読めない */
function sortLedger(ledger: Ledger): Ledger {
  const sorted: Ledger = {}
  for (const key of Object.keys(ledger).sort()) sorted[key] = ledger[key]!
  return sorted
}

function configFromEnv(): OrcaRouterConfig {
  return {
    baseUrl: process.env['ORCAROUTER_BASE_URL'] ?? 'https://api.orcarouter.ai/v1',
    apiKey: process.env['ORCAROUTER_API_KEY'] ?? '',
    /*
     * ★ **プロバイダの接頭辞が要る**（`anthropic/...`・`google/...`）。
     * 無いと OrcaRouter は 404 model_not_found を返す。文面は
     * 「No available capacity」と出るので、**混んでいるだけに見えて
     * モデルID の間違いだと気づきにくい。**
     */
    ingestModel: process.env['AI_INGEST_MODEL'] ?? 'anthropic/claude-opus-5',
    runtimeModel: process.env['AI_RUNTIME_MODEL'] ?? 'google/gemini-2.5-flash',
    timeoutMs: Number(process.env['AI_TIMEOUT_MS'] ?? 60000),
    maxRetries: 2,
  }
}

async function main(): Promise<void> {
  const expand = process.argv.includes('--expand')

  let entries = seedEntries()
  console.log(`種 ${entries.length} 件（quiz-bank.ts から。モデルは呼んでいない）`)

  if (expand) {
    const config = configFromEnv()
    if (!isConfigured(config)) {
      console.error('ORCAROUTER_API_KEY が未設定です。--expand は鍵が要ります')
      process.exit(1)
    }

    console.log(`拡張: ${config.ingestModel} を ${SPOT_CATEGORIES.length} 回呼びます`)
    for (const category of SPOT_CATEGORIES) {
      const generated = await expandCategory(config, category, entries)
      console.log(`  ${SPOT_CATEGORY_LABELS[category]}: ${generated.length} 件`)
      entries = [...entries, ...generated]
    }
  } else {
    /*
     * ★ 拡張しないときは、前回の生成ぶんを捨てない。捨てると
     * `pnpm build:kb` を打つたびにレビュー済みのナレッジが消える。
     */
    const seedIds = new Set(entries.map((entry) => entry.entryId))
    const kept = KNOWLEDGE_BASE.entries.filter((entry) => !seedIds.has(entry.entryId))
    entries = [...entries, ...kept]
    console.log(`前回の生成ぶん ${kept.length} 件を引き継ぎ`)
  }

  const ledger = await readLedger()
  const applied = applyLedger(entries, ledger)
  const withReview = applied.entries
  for (const id of applied.reset) {
    console.warn(`  ! ${id}: 内容が変わったので承認を外しました（再レビューが要ります）`)
  }

  /*
   * ★ 壊れたエントリは**書き出さずに落とす。** 出力に混ぜると、実行時の
   * usableEntries が黙って外すだけになり、「作ったのに出ない」理由が分からなくなる。
   */
  const broken = withReview.filter((entry) => validateEntry(entry).length > 0)
  for (const entry of broken) {
    console.warn(`  × ${entry.entryId}: ${validateEntry(entry).join(' / ')}`)
  }
  const kept = withReview.filter((entry) => validateEntry(entry).length === 0)

  const base: KnowledgeBase = {
    generatedAt: TODAY,
    entries: kept.sort((a, b) => a.entryId.localeCompare(b.entryId)),
  }

  await writeFile(OUT, emit(base), 'utf-8')
  await writeFile(LEDGER, `${JSON.stringify(sortLedger(applied.ledger), null, 2)}
`, 'utf-8')

  const stats = statsOf(base)
  console.log(`\n出力 ${OUT}`)
  console.log(`全 ${stats.total} 件 / 確認済み ${stats.reviewed} 件 / 未確認 ${stats.unreviewed} 件`)
  if (broken.length > 0) console.log(`落とした壊れたエントリ ${broken.length} 件`)
  if (stats.unreviewed > 0) {
    console.log('\n★ 未確認のエントリは配られません。')
    console.log(`  ${LEDGER} を読み、正しければ approved を true にして再実行してください`)
  }
}

await main()
