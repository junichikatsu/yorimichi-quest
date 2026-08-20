#!/usr/bin/env node
/**
 * スポットの投入と削除を、終わるまで繰り返すスクリプト（FR-10-2）。
 *
 * ★ 1リクエストで全件は入らない。**連続して速く書くとスロットリングされる**ため
 * 間隔を空ける必要があり、370件では実行環境のタイムアウトに当たる。
 * そのため範囲を区切って何回も呼ぶことになるが、手で回すと offset を間違える。
 *
 * ★ 詰まったら**待って、間隔を広げ、1回の件数を減らして**続ける。
 * 実測では間隔 100ms でも約 198 件目で詰まった。詰まった直後に同じ速さで
 * 再開すると即座に失敗するので、諦める前に緩める。
 *
 *   node tools/seed/seed.mjs                      全件入れる
 *   node tools/seed/seed.mjs --reset              先に全部消してから入れる
 *   node tools/seed/seed.mjs --purge-only         消すだけ
 *   node tools/seed/seed.mjs --count 30 --delay 300
 *
 * 環境変数（.env からは読まない。取り違えを避けるため明示的に渡す）:
 *   HTTP_TRIGGER_URL  例 https://lcdp002.enebular.com/imanouchi
 *   ADMIN_KEY
 */

const url = (process.env['HTTP_TRIGGER_URL'] ?? '').replace(/\/+$/, '')
const adminKey = process.env['ADMIN_KEY'] ?? ''

if (url === '' || adminKey === '') {
  console.error('HTTP_TRIGGER_URL と ADMIN_KEY を環境変数で渡してください')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const value = Number(process.argv[i + 1])
  return Number.isFinite(value) ? value : fallback
}

const reset = process.argv.includes('--reset')
const purgeOnly = process.argv.includes('--purge-only')

/** 呼び出しの間隔。続けて叩きすぎないための最低待ち */
const BETWEEN_CALLS_MS = 1000

/** 詰まったときに待つ時間。回を追うごとに伸ばす */
const COOLDOWN_MS = [5000, 15000, 30000, 60000]

/** 1件ごとの間隔の上限。ここまで緩めて駄目なら諦める */
const MAX_DELAY_MS = 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class CallError extends Error {
  constructor(status, code, details) {
    super(`${status} ${code} ${details}`)
    this.status = status
    this.code = code
  }
}

async function call(path, query) {
  const search = new URLSearchParams(query).toString()
  const response = await fetch(`${url}${path}?${search}`, {
    method: 'POST',
    headers: { 'x-admin-key': adminKey },
  })

  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new CallError(response.status, 'NOT_JSON', text.slice(0, 200))
  }

  if (!response.ok) {
    throw new CallError(
      response.status,
      body?.error?.code ?? 'UNKNOWN',
      JSON.stringify(body?.error?.details ?? {}),
    )
  }
  return body
}

/** 進み具合の表示。緩めた事実を隠さない */
function note(result) {
  const parts = []
  if (result.retries > 0) parts.push(`再試行 ${result.retries}`)
  parts.push(`間隔 ${result.delayMs}ms`)
  return `（${parts.join('／')}）`
}

/**
 * 詰まりに耐える進行。
 *
 * `step` は「1回ぶん進める」関数で、進めた件数を返す。0 なら詰まったものとして
 * **冷却してから、間隔を広げ、件数を減らして**やり直す。
 */
async function grind(label, step, state) {
  let stalls = 0

  for (let round = 1; ; round += 1) {
    let progressed
    try {
      progressed = await step(state)
    } catch (err) {
      if (!(err instanceof CallError) || err.code !== 'DATASTORE_UNAVAILABLE') throw err
      // 呼び出しごと失敗した場合も詰まりとして扱う
      progressed = 0
      console.log(`  ${round} 回目: 失敗（${err.code}）`)
    }

    if (progressed === null) return

    if (progressed > 0) {
      stalls = 0
      await sleep(BETWEEN_CALLS_MS)
      continue
    }

    // 進まなかった
    if (stalls >= COOLDOWN_MS.length) {
      throw new Error(
        `${label}: ${stalls} 回続けて進みませんでした。間隔 ${state.delayMs}ms でも詰まっています`,
      )
    }
    const cooldown = COOLDOWN_MS[stalls]
    stalls += 1
    state.delayMs = Math.min(Math.max(state.delayMs * 2, 200), MAX_DELAY_MS)
    state.count = Math.max(Math.floor(state.count / 2), 10)
    console.log(
      `  詰まりました。${cooldown / 1000} 秒待って、間隔 ${state.delayMs}ms・` +
        `1回 ${state.count} 件に落として続けます`,
    )
    await sleep(cooldown)
  }
}

async function purge(state) {
  console.log('--- 削除 ---')
  let total = 0

  await grind(
    '削除',
    async (s) => {
      const result = await call('/v1/admin/purge', { count: s.count, delayMs: s.delayMs })
      total += result.deleted
      if (result.deleted > 0) {
        console.log(`  ${result.deleted} 件削除 累計 ${total} ${note(result)}`)
      }
      // サーバが緩めた値に合わせる
      s.delayMs = Math.max(s.delayMs, result.delayMs)
      if (!result.stopped && !result.hasMore) return null
      return result.deleted
    },
    state,
  )

  console.log(`削除 合計 ${total} 件`)
  if (total === 0) {
    console.log('  ★ 0 件でした。AREA_ID が変わっているか、まだ何も入っていません')
  }
}

async function seed(state) {
  console.log('--- 投入 ---')
  let total = 0
  let offset = 0

  await grind(
    '投入',
    async (s) => {
      const result = await call('/v1/admin/seed', { offset, count: s.count, delayMs: s.delayMs })
      total += result.inserted

      if (result.inserted > 0) {
        console.log(
          `  ${result.from}〜${result.to - 1} を ${result.inserted} 件 ` +
            `累計 ${total}/${result.total} ${note(result)}`,
        )
      }

      s.delayMs = Math.max(s.delayMs, result.delayMs)
      offset = result.nextOffset ?? offset
      if (result.nextOffset === null) {
        console.log(`投入 合計 ${total} 件（全 ${result.total} 件）`)
        return null
      }
      return result.inserted
    },
    state,
  )
}

async function main() {
  const state = { count: arg('count', 50), delayMs: arg('delay', 200) }

  console.log(`対象 ${url}`)
  console.log(`1回あたり ${state.count} 件 / 間隔 ${state.delayMs}ms`)

  if (reset || purgeOnly) await purge({ ...state })
  if (!purgeOnly) await seed(state)

  console.log('\n完了しました。/v1/spots で件数を確認してください')
}

main().catch((err) => {
  console.error(`\n失敗: ${err instanceof Error ? err.message : String(err)}`)
  console.error('実行環境のログの [datastore] / [seed] / [purge] の行を確認してください')
  process.exit(1)
})
