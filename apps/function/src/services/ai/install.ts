import { KNOWLEDGE_BASE } from '../../data/knowledge-base.js'
import { resetQuizSource, setQuizSource } from '../../data/quiz-bank.js'
import type { AppConfig } from '../../config.js'
import { usableEntries } from '@imanouchi/shared'
import { createKnowledgeQuizSource } from './quiz-generator.js'

/**
 * ナレッジからの出題を取り付ける（FR-04-2・#75）。
 *
 * ★ **設定を見て一度だけ差し替える。** `loadConfig()` はリクエストごとに読まれるが、
 * 供給元はプロセスに1つしかない。毎回作り直すと**キャッシュが毎回空になり、
 * リクエストのたびにモデルを呼ぶ**（コストが利用者数に比例してしまう）。
 *
 * ★ 切り替えの条件が変わったときだけ作り直す。環境変数を変えて再デプロイした
 * あとに古い設定のまま動き続けると、切ったつもりが切れていないことになる。
 */

/** いま取り付けている設定の指紋。同じなら作り直さない */
let installedKey: string | undefined

function keyOf(config: AppConfig): string {
  // ★ 鍵そのものは持たない。**有無だけ**を見る（ログにも出さないため）
  return [
    config.aiQuizEnabled,
    config.orcaRouterApiKey === '' ? 'nokey' : 'key',
    config.orcaRouterBaseUrl,
    config.aiRuntimeModel,
    config.aiQuizTimeoutMs,
  ].join('|')
}

export function installQuizSource(config: AppConfig): void {
  const key = keyOf(config)
  if (installedKey === key) return
  installedKey = key

  if (!config.aiQuizEnabled) {
    resetQuizSource()
    return
  }

  /*
   * ★ 配れるナレッジが1件も無ければ、取り付けない。
   *
   * 未承認しか無い状態で取り付けると、**毎回の出題が固定データへの遠回り**になる
   * （選ぶものが無く、そのつど固定へ落ちる）。それなら最初から固定でよい。
   */
  const usable = usableEntries(KNOWLEDGE_BASE)
  if (usable.length === 0) {
    console.warn('[quiz] 配れるナレッジが0件のため、固定データのまま出します')
    resetQuizSource()
    return
  }

  console.log(`[quiz] ナレッジ ${usable.length} 件から出題します（モデル ${config.aiRuntimeModel}）`)

  setQuizSource(
    createKnowledgeQuizSource({
      /*
       * ★ 接続の設定にモデル名は入れない。**実行時のコードから取り込み用の
       * 高性能モデルへ手が届かない**ようにしてある（型で塞いである）。
       */
      connection: {
        baseUrl: config.orcaRouterBaseUrl,
        apiKey: config.orcaRouterApiKey,
        timeoutMs: config.aiQuizTimeoutMs,
        /*
         * ★ 実行時は再試行しない。利用者を待たせるだけで、素の言い回しへ落ちる
         * ほうが速い。再試行が効くのは取り込み（build:kb）のときである。
         */
        maxRetries: 0,
      },
      model: config.aiRuntimeModel,
      base: KNOWLEDGE_BASE,
      timeoutMs: config.aiQuizTimeoutMs,
    }),
  )
}

/** テストのために取り付け状態を忘れる */
export function resetQuizSourceInstall(): void {
  installedKey = undefined
  resetQuizSource()
}
