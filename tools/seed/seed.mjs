#!/usr/bin/env node
/**
 * スポットの投入と削除を、終わるまで繰り返すスクリプト（FR-10-2）。
 *
 * ★ 1リクエストで全件は入らない。**連続して速く書くとスロットリングされる**ため
 * 間隔を空ける必要があり、370件では実行環境のタイムアウトに当たる。
 * そのため範囲を区切って何回も呼ぶことになるが、手で回すと offset を間違える。
 *
 *   node tools/seed/seed.mjs                      全件入れる
 *   node tools/seed/seed.mjs --reset              先に全部消してから入れる
 *   node tools/seed/seed.mjs --purge-only         消すだけ
 *   node tools/seed/seed.mjs --count 30 --delay 200
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

const count = arg('count', 50)
const delayMs = arg('delay', 100)
const reset = process.argv.includes('--reset')
const purgeOnly = process.argv.includes('--purge-only')

/** 1回あたりの待ち時間の目安。呼び出し間隔もあけて、続けて叩きすぎないようにする */
const BETWEEN_CALLS_MS = 500

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
    throw new Error(`応答が JSON ではありません: ${response.status} ${text.slice(0, 200)}`)
  }

  if (!response.ok) {
    const code = body?.error?.code ?? 'UNKNOWN'
    const detail = JSON.stringify(body?.error?.details ?? {})
    throw new Error(`${response.status} ${code} ${detail}`)
  }
  return body
}

async function purge() {
  console.log('--- 削除 ---')
  let total = 0

  for (let round = 1; ; round += 1) {
    const result = await call('/v1/admin/purge', { count, delayMs })
    total += result.deleted
    const note = result.retries > 0 ? `（再試行 ${result.retries}／間隔 ${result.delayMs}ms）` : ''
    console.log(`  ${round} 回目: ${result.deleted} 件削除 累計 ${total} ${note}`)

    if (result.stopped) {
      console.log('  途中で止まりました。もう一度実行すると続きから消えます')
      break
    }
    if (!result.hasMore) break
    await sleep(BETWEEN_CALLS_MS)
  }

  console.log(`削除 合計 ${total} 件`)
}

async function seed() {
  console.log('--- 投入 ---')
  let offset = 0
  let total = 0

  for (let round = 1; ; round += 1) {
    const result = await call('/v1/admin/seed', { offset, count, delayMs })
    total += result.inserted
    const note = result.retries > 0 ? `（再試行 ${result.retries}／間隔 ${result.delayMs}ms）` : ''
    console.log(
      `  ${round} 回目: ${result.from}〜${result.to - 1} を ${result.inserted} 件 ` +
        `累計 ${total}/${result.total} ${note}`,
    )

    if (result.stoppedAt !== undefined && result.stoppedAt !== null) {
      // 止まった位置から続ける。putItem は上書きなので重複しても害はない
      console.log(`  ${result.stoppedAt} 件目で止まりました。そこから続けます`)
    }

    if (result.nextOffset === null) {
      console.log(`投入 合計 ${total} 件（全 ${result.total} 件）`)
      return
    }
    offset = result.nextOffset
    await sleep(BETWEEN_CALLS_MS)
  }
}

async function main() {
  console.log(`対象 ${url}`)
  console.log(`1回あたり ${count} 件 / 間隔 ${delayMs}ms`)

  if (reset || purgeOnly) await purge()
  if (!purgeOnly) await seed()

  console.log('\n完了しました。/v1/spots で件数を確認してください')
}

main().catch((err) => {
  console.error(`\n失敗: ${err instanceof Error ? err.message : String(err)}`)
  console.error('実行環境のログの [datastore] / [seed] / [purge] の行を確認してください')
  process.exit(1)
})
