/**
 * OrcaRouter への呼び出し（#75）。
 *
 * ★ **提出物 3-2 の「役割で二段に分ける」構成を、そのまま保つ。**
 * OrcaRouter の売りはプロンプトの難易度による動的な振り分けだが、**それは使わない。**
 * モデルは呼び出し側が固定して渡す（取り込み＝高性能、利用＝軽量）。
 * 動的に振り分けると、3-2 とスライド7で説明した「取り込み時だけ高性能モデル」
 * という費用構造の説明が成り立たなくなる。
 *
 * ここで得ているのは、鍵とコストの一元管理・可観測性・落ちたときの退避先である。
 *
 * ★ OpenAI 互換なので、専用の SDK を足さない。`fetch` だけで足りるものに
 * 依存を増やすと、Lambda の ZIP が太る。
 *
 * ★ **鍵をログへ出さない。** 失敗したときに出すのは状態コードと本文の先頭だけで、
 * リクエストヘッダは決して出さない。
 */

export interface OrcaRouterConfig {
  /** OpenAI 互換のエンドポイント（末尾に /chat/completions を足す） */
  baseUrl: string
  apiKey: string
  /** 取り込み時に使う高性能モデル。**呼ぶのは取り込みのときだけ** */
  ingestModel: string
  /** 利用時に使う軽量モデル */
  runtimeModel: string
  timeoutMs: number
  maxRetries: number
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface ChatRequest {
  /** **呼ぶ側が決める。** ここで切り替えない（上の注記を参照） */
  model: string
  messages: ChatMessage[]
  /**
   * 生成のばらつき。
   *
   * ★ 既定を低くしてある。防災の文言は言い回しが揺れるほど良くなるものではなく、
   * **同じナレッジから毎回違う正解が出ると、検証も再現もできない。**
   */
  temperature?: number
  maxTokens?: number
  /** JSON だけを返させる。前後の説明文が付くと、そのたびに parse が落ちる */
  json?: boolean
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[]
}

/**
 * 設定が揃っているか。
 *
 * ★ **揃っていないことを起動時に落とさない**（config.ts と同じ方針）。
 * AI が使えなくてもアプリは動くべきで、クイズは固定データへ落ちればよい。
 * 「AI が設定されていないこと」と「AI が壊れていること」を混ぜない。
 */
export function isConfigured(config: OrcaRouterConfig): boolean {
  return config.apiKey !== '' && config.baseUrl !== ''
}

/**
 * 1回呼ぶ。
 *
 * ★ 429 と 5xx だけ再試行する。400 系は何度投げても同じで、**再試行はコストと
 * 待ち時間を増やすだけ**である。
 */
export async function chat(config: OrcaRouterConfig, request: ChatRequest): Promise<string> {
  if (!isConfigured(config)) {
    throw new AiError('OrcaRouter が設定されていません', undefined, false)
  }

  let lastError: AiError | undefined

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    if (attempt > 0) {
      /*
       * ★ 待ってから投げ直す。すぐ投げ直すと、混んでいる相手をさらに混ませる。
       * 1秒・2秒・4秒と倍にする。
       */
      await sleep(1000 * 2 ** (attempt - 1))
    }

    try {
      return await once(config, request)
    } catch (error) {
      if (!(error instanceof AiError) || !error.retryable) throw error
      lastError = error
    }
  }

  throw lastError ?? new AiError('OrcaRouter の呼び出しに失敗しました', undefined, false)
}

async function once(config: OrcaRouterConfig, request: ChatRequest): Promise<string> {
  /*
   * ★ 必ず時間で打ち切る。相手が返さないとき、Lambda は**返さないまま課金され続け**、
   * 利用者の画面はクイズが出ないまま止まる。
   */
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1200,
        ...(request.json === true ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      // ★ 本文は先頭だけ。丸ごと出すと、失敗のたびにログが埋まる
      const body = (await response.text().catch(() => '')).slice(0, 200)
      throw new AiError(
        `OrcaRouter が ${response.status} を返しました: ${body}`,
        response.status,
        response.status === 429 || response.status >= 500,
      )
    }

    const payload = (await response.json()) as ChatCompletionResponse
    const content = payload.choices?.[0]?.message?.content

    if (typeof content !== 'string' || content.trim() === '') {
      // 空の応答は一時的なことがある。再試行の対象にする
      throw new AiError('OrcaRouter の応答が空でした', response.status, true)
    }

    return content
  } catch (error) {
    if (error instanceof AiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiError(`OrcaRouter が ${config.timeoutMs}ms で応答しませんでした`, undefined, true)
    }
    throw new AiError(`OrcaRouter へ到達できませんでした: ${String(error)}`, undefined, true)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * JSON として読む。
 *
 * ★ `json: true` を付けても、モデルが ```json のフェンスを付けてくることがある。
 * **そのたびに落ちる**ので、剥がしてから読む。読めなければ中身を捨てて例外にする
 * （半端に解釈して、壊れたクイズを配るほうが悪い）。
 */
export function parseJson<T>(content: string): T {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')

  try {
    return JSON.parse(stripped) as T
  } catch {
    throw new AiError(`応答を JSON として読めませんでした: ${stripped.slice(0, 200)}`, undefined, false)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
