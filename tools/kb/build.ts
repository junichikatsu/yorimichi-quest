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
import { chat, isConfigured, parseJson, type OrcaRouterConnection } from '../../apps/function/src/services/ai/orcarouter.js'
import { KNOWLEDGE_BASE } from '../../apps/function/src/data/knowledge-base.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'apps/function/src/data/knowledge-base.ts')
/** レビュー用の読み物。**生成物と一緒に作る**ので、中身がずれない */
const REVIEW = join(ROOT, 'doc/knowledge-review.md')

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
 * 人手による修正
 * ------------------------------------------------------------------ */

/**
 * レビューで見つけた誤りを直すためのファイル（`tools/kb/overrides.json`）。
 *
 * ★ **承認の可否だけでは足りない。** レビューの実際は「この選択肢だけ差し替えて」
 * であって、丸ごと捨てるか通すかではない。受け皿が無いと、**惜しい1件を捨てるか、
 * 誤りを含んだまま通すか**の二択になる。
 *
 * ★ 生成物を手で直さない。直しても次の再生成で消えるし、生成物には
 * 「手で編集しないこと」と書いてある。**人が触るファイルはここだけ**にする。
 *
 * ★ 直したら指紋が変わるので、**承認は自動的に外れる。** 直した人とは別の人が
 * 読んでから配られる（自分の直しを自分で承認して素通しできない）。
 */
const OVERRIDES = join(ROOT, 'tools/kb/overrides.json')

interface Override {
  /** なぜ直したか。**判定には使わないが、消さないこと**（次に読む人の手がかり） */
  reason: string
  claim?: string
  context?: string
  distractors?: string[]
  why?: string
  kind?: KnowledgeEntry['kind']
  sources?: KnowledgeEntry['sources']
}

async function readOverrides(): Promise<Record<string, Override>> {
  try {
    return JSON.parse(await readFile(OVERRIDES, 'utf-8')) as Record<string, Override>
  } catch {
    return {}
  }
}

/**
 * 修正を当てる。**当たらなかった修正は知らせる。**
 *
 * ★ entryId を打ち間違えた修正が黙って無視されると、**直したつもりのまま
 * 誤りが配られる。** 当たらなかったものは必ず出す。
 */
function applyOverrides(
  entries: KnowledgeEntry[],
  overrides: Record<string, Override>,
): { entries: KnowledgeEntry[]; unused: string[] } {
  const used = new Set<string>()

  const applied = entries.map((entry) => {
    const override = overrides[entry.entryId]
    if (!override) return entry
    used.add(entry.entryId)

    // ★ reason は中身へ入れない（記録のためだけのもの）
    const { reason: _reason, ...patch } = override
    return { ...entry, ...patch }
  })

  return {
    entries: applied,
    unused: Object.keys(overrides).filter((id) => !used.has(id)),
  }
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
  connection: OrcaRouterConnection,
  model: string,
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

  const content = await chat(connection, {
    // ★ 高性能モデルを指定するのは**このリポジトリでここだけ**である
    model,
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
        title: `生成（OrcaRouter 経由 ${model}）。**未レビュー。一次資料の確認が必要**`,
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
 * レビュー用の読み物
 * ------------------------------------------------------------------ */

/**
 * 防災士が読んで赤入れするための一覧。
 *
 * ★ **PR の diff を読ませない。** JSON を読める前提を置くと、いちばん確かめて
 * ほしい人がレビューできない。紙に刷って赤を入れられる形にする。
 *
 * ★ 生成物と同時に作るので、**中身がずれない。** 別に書き起こすと、直したのに
 * 資料が古いままという事故が起きる。
 */
function emitReview(base: KnowledgeBase, overrides: Record<string, Override>): string {
  const stats = statsOf(base)
  const lines: string[] = []

  lines.push('# ナレッジのレビュー（防災士・消防団員のみなさまへ）')
  lines.push('')
  lines.push('> **自動生成ファイル。手で編集しないこと。** 生成元: `tools/kb/build.ts` ／ 再生成: `pnpm build:kb`')
  lines.push('')
  lines.push(`| 項目 | 内容 |`)
  lines.push(`| :--- | :--- |`)
  lines.push(`| 生成時点 | ${base.generatedAt} |`)
  lines.push(`| 全 | ${stats.total} 件 |`)
  lines.push(`| **確認済み（配信中）** | **${stats.reviewed} 件** |`)
  lines.push(`| **未確認（配信していない）** | **${stats.unreviewed} 件** |`)
  lines.push('')
  lines.push('## お願いしたいこと')
  lines.push('')
  lines.push('市民が現地で答えるクイズの**材料**です。クイズの文章そのものではありません。')
  lines.push('問題文と解説の言い回しは別のAIが作りますが、**どれが正解かはこの材料が決めます。**')
  lines.push('')
  lines.push('各項目について、次の3点を見てください。')
  lines.push('')
  lines.push('1. **正しいこと**が正しいか')
  lines.push('2. **よくある誤解**が、本当に誤解か（＝事実に近いものが混ざっていないか）')
  lines.push('3. **なぜ大切か**が、命に関わる理由として妥当か')
  lines.push('')
  lines.push('> **2 がいちばん間違えやすいところです。** 事実に近い内容を「誤解」として出すと、')
  lines.push('> 逆のことを教えてしまいます。実際に1件見つかっています（下の gen-aed-3）。')
  lines.push('')
  lines.push('直したいところがあれば、**この文書ではなく** `tools/kb/overrides.json` に書きます。')
  lines.push('よければ `tools/kb/approved.json` の `approved` を `true` にしてください。')
  lines.push('')

  for (const reviewed of [false, true]) {
    const group = base.entries.filter((entry) => entry.reviewed === reviewed)
    if (group.length === 0) continue

    lines.push('---')
    lines.push('')
    lines.push(
      reviewed
        ? `## 確認済み（${group.length} 件）— すでに配信しています`
        : `## 未確認（${group.length} 件）— **ここを見てください**`,
    )
    lines.push('')

    for (const entry of group) {
      const override = overrides[entry.entryId]
      lines.push(`### ${entry.entryId}`)
      lines.push('')
      lines.push(`- **対象**：${SPOT_CATEGORY_LABELS[entry.category]}`)
      lines.push(`- **種類**：${entry.kind === 'action' ? 'まず何をするか（行動）' : '設備や知識'}`)
      if (entry.context !== '') lines.push(`- **もとの問い**：${entry.context}`)
      lines.push('')
      lines.push(`**正しいこと**`)
      lines.push('')
      lines.push(`> ${entry.claim}`)
      lines.push('')
      lines.push(`**よくある誤解（不正解の選択肢になります）**`)
      lines.push('')
      for (const distractor of entry.distractors) lines.push(`- ${distractor}`)
      lines.push('')
      lines.push(`**なぜ大切か**`)
      lines.push('')
      lines.push(`> ${entry.why}`)
      lines.push('')
      lines.push(`**出典**`)
      lines.push('')
      for (const source of entry.sources) {
        lines.push(`- ${source.title}${source.url !== '' ? ` — ${source.url}` : ''}（${source.fetchedAt}）`)
      }
      if (override) {
        lines.push('')
        lines.push(`> **人手で修正済み**：${override.reason}`)
      }
      lines.push('')
    }
  }

  return `${lines.join('\n')}\n`
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

function connectionFromEnv(): OrcaRouterConnection {
  return {
    baseUrl: process.env['ORCAROUTER_BASE_URL'] ?? 'https://api.orcarouter.ai/v1',
    apiKey: process.env['ORCAROUTER_API_KEY'] ?? '',
    timeoutMs: Number(process.env['AI_TIMEOUT_MS'] ?? 60000),
    maxRetries: 2,
  }
}

/**
 * 取り込み用の高性能モデル。
 *
 * ★ **この名前が出てくるのはこのファイルだけである。** 実行時の設定
 * （apps/function/src/config.ts）には置いていないので、配信される関数から
 * 高性能モデルを呼ぶことはできない。3-2 の「取り込み時だけ高性能モデル」は
 * 運用の約束ではなく、**コードの構造として**そうなっている。
 *
 * ★ **プロバイダの接頭辞が要る**（`anthropic/...`）。無いと OrcaRouter は
 * 404 model_not_found を返すが、文面は「No available capacity」と出るので、
 * **混んでいるだけに見えてモデルID の間違いだと気づきにくい。**
 */
function ingestModelFromEnv(): string {
  return process.env['AI_INGEST_MODEL'] ?? 'anthropic/claude-opus-5'
}

async function main(): Promise<void> {
  const expand = process.argv.includes('--expand')

  let entries = seedEntries()
  console.log(`種 ${entries.length} 件（quiz-bank.ts から。モデルは呼んでいない）`)

  if (expand) {
    const connection = connectionFromEnv()
    const model = ingestModelFromEnv()
    if (!isConfigured(connection)) {
      console.error('ORCAROUTER_API_KEY が未設定です。--expand は鍵が要ります')
      process.exit(1)
    }

    console.log(`拡張: ${model} を ${SPOT_CATEGORIES.length} 回呼びます`)
    for (const category of SPOT_CATEGORIES) {
      const generated = await expandCategory(connection, model, category, entries)
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

  const overrides = await readOverrides()
  const patched = applyOverrides(entries, overrides)
  entries = patched.entries
  if (Object.keys(overrides).length > 0) {
    console.log(`人手による修正 ${Object.keys(overrides).length - patched.unused.length} 件を適用`)
  }
  for (const id of patched.unused) {
    console.warn(`  ! ${id}: 修正の宛先が見つかりません（entryId を確かめてください）`)
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
  await writeFile(REVIEW, emitReview(base, overrides), 'utf-8')
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
