import type { KnowledgeBase, KnowledgeEntry } from '@imanouchi/shared'
import { asSpotId } from '@imanouchi/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRouterConnection } from './orcarouter.js'
import { createKnowledgeQuizSource, entryFromKnowledge, quizIdFor } from './quiz-generator.js'

/**
 * ナレッジからのクイズ生成（FR-04-2・#75）。
 *
 * ★ 固定しているのは**モデルが壊れても壊れないこと**である。
 * 生成は言い回しだけを担い、正解・選択肢・カードの中身はナレッジから決まる。
 */

const CLAIM = 'AEDのふたを開けて電源を入れ、音声ガイダンスの指示どおりに操作する'

function entryOf(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    entryId: 'gen-aed-2',
    scope: 'category',
    key: 'aed',
    category: 'aed',
    context: '',
    kind: 'action',
    claim: CLAIM,
    distractors: ['講習を受けた人が来るまで待つ', '電気ショックが必要か自分で判断してから貼る'],
    why: 'ためらって待つ時間がそのまま心停止の時間になります',
    sources: [{ title: 'JRC蘇生ガイドライン', url: '', fetchedAt: '2026-08-30' }],
    reviewed: true,
    ...overrides,
  }
}

function baseOf(entries: KnowledgeEntry[]): KnowledgeBase {
  return { generatedAt: '2026-08-30', entries }
}

const connection: OrcaRouterConnection = {
  baseUrl: 'https://api.example.test/v1',
  apiKey: 'test-key',
  timeoutMs: 100,
  maxRetries: 0,
}

const MODEL = 'google/gemini-2.5-flash-lite'

function reply(payload: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const SPOT = asSpotId('aed-0001')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('モデルを呼ばずに出題が成立する', () => {
  it('正解はナレッジの claim で、選択肢はすべてナレッジの文言', () => {
    const entry = entryOf()
    const quiz = entryFromKnowledge(entry)

    expect(quiz.options).toHaveLength(3)
    expect(quiz.options[quiz.answerIndex]).toBe(CLAIM)
    for (const option of quiz.options) {
      expect([CLAIM, ...entry.distractors]).toContain(option)
    }
  })

  it('★ 解説は why をそのまま使う（人が確かめた文言以外を配らない）', () => {
    expect(entryFromKnowledge(entryOf()).explanation).toBe(entryOf().why)
  })

  it('★ カードの中身は claim そのもの', () => {
    expect(entryFromKnowledge(entryOf()).card.action).toBe(CLAIM)
  })

  it('★ 正解の位置を先頭に固定しない（いつも1番目では解けてしまう）', () => {
    const positions = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map(
        (id) => entryFromKnowledge(entryOf({ entryId: `gen-aed-${id}` })).answerIndex,
      ),
    )

    expect(positions.size).toBeGreaterThan(1)
  })

  it('★ 同じナレッジなら毎回同じ並び（出題と採点で番号がずれない）', () => {
    const first = entryFromKnowledge(entryOf())
    const second = entryFromKnowledge(entryOf())

    expect(second.options).toEqual(first.options)
    expect(second.answerIndex).toBe(first.answerIndex)
  })
})

describe('採点は生成に依存しない', () => {
  /*
   * ★ 出題と採点は別のリクエストで、間に Lambda のインスタンスが入れ替わりうる。
   * ここで undefined を返すと「クイズが見つかりません」が利用者に出る。
   */
  it('★ 生成していない（キャッシュが空の）状態でも quizId を引ける', async () => {
    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const found = await source.find(quizIdFor(entryOf()))

    expect(found?.options[found.answerIndex]).toBe(CLAIM)
  })

  it('★ 生成した出題と、作り直した出題で正解が一致する', async () => {
    vi.stubGlobal('fetch', async () =>
      reply({ question: '倒れた人を見つけました。まずどうしますか。', explanation: '待つ時間が命を削ります。', scene: '人が倒れている' }),
    )

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const picked = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })
    const rebuilt = entryFromKnowledge(entryOf())

    expect(picked?.answerIndex).toBe(rebuilt.answerIndex)
    expect(picked?.options).toEqual(rebuilt.options)
  })
})

describe('生成が重ねるのは言い回しだけ', () => {
  it('問題文・解説・見出しを上書きし、選択肢と正解は動かさない', async () => {
    vi.stubGlobal('fetch', async () =>
      reply({ question: '倒れた人を見つけました。まずどうしますか。', explanation: '待つ時間が命を削ります。', scene: '人が倒れている' }),
    )

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })

    expect(quiz?.question).toBe('倒れた人を見つけました。まずどうしますか。')
    expect(quiz?.card.scene).toBe('人が倒れている')
    expect(quiz?.generatedBy).toBe('llm')
    expect(quiz?.options[quiz.answerIndex]).toBe(CLAIM)
    // ★ カードの中身は上書きさせない
    expect(quiz?.card.action).toBe(CLAIM)
  })

  it('★ 問題文に正解が透けていたら捨てる（読むだけで解けてしまう）', async () => {
    vi.stubGlobal('fetch', async () =>
      reply({
        question: `AEDのふたを開けて電源を入れ、音声ガイダンスの指示どおりに操作するのは正しいですか。`,
        explanation: 'ok',
        scene: '場面',
      }),
    )

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })

    expect(quiz?.question).toBe(entryFromKnowledge(entryOf()).question)
  })

  it('★ 見出しに正解が透けていたら捨てる（カード一覧で答えが読める）', async () => {
    vi.stubGlobal('fetch', async () =>
      reply({ question: 'まずどうしますか。', explanation: 'ok', scene: 'AEDのふたを開けて電源を入れ' }),
    )

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })

    expect(quiz?.card.scene).not.toContain('ふたを開けて電源を入れ')
  })

  it('空の応答は素の言い回しに戻す', async () => {
    vi.stubGlobal('fetch', async () => reply({ question: '', explanation: '', scene: '' }))

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })

    expect(quiz?.question).toBe(entryFromKnowledge(entryOf()).question)
    expect(quiz?.explanation).toBe(entryOf().why)
  })
})

describe('落ちても画面を止めない（G-7）', () => {
  it('★ 生成が失敗しても出題は返る', async () => {
    vi.stubGlobal('fetch', async () => new Response('boom', { status: 500 }))

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })

    expect(quiz?.options[quiz.answerIndex]).toBe(CLAIM)
    expect(quiz?.generatedBy).toBe('fixture')
  })

  it('★ 鍵が無ければモデルを呼ばず、ナレッジの素の言い回しで出す', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)

    const source = createKnowledgeQuizSource({
      connection: { ...connection, apiKey: '' },
      model: MODEL,
      base: baseOf([entryOf()]),
      timeoutMs: 100,
    })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })

    expect(spy).not.toHaveBeenCalled()
    expect(quiz?.options[quiz.answerIndex]).toBe(CLAIM)
  })

  it('★ 配れるナレッジが無ければ固定データへ落ちる', async () => {
    const source = createKnowledgeQuizSource({
      connection,
      model: MODEL,
      base: baseOf([entryOf({ reviewed: false })]),
      timeoutMs: 100,
    })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })

    // 固定データ側の AED 出題が返る
    expect(quiz).toBeDefined()
    expect(quiz?.category).toBe('aed')
    expect(quiz?.quizId.startsWith('kb-')).toBe(false)
  })
})

describe('モデルを呼ぶ回数を抑える', () => {
  it('★ 2回目はキャッシュから返す（利用者数に比例して呼ばない）', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return reply({ question: 'まずどうしますか。', explanation: 'ok', scene: '場面' })
    })

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })
    await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })

    expect(calls).toBe(1)
  })

  it('★ 別のスポットでも同じナレッジなら呼び直さない（出題はナレッジ単位）', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return reply({ question: 'まずどうしますか。', explanation: 'ok', scene: '場面' })
    })

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })
    await source.pick({ spotId: asSpotId('aed-9999'), category: 'aed', alreadyCleared: false })

    expect(calls).toBe(1)
  })
})

describe('行動を先に出す（FR-04-7・G-8）', () => {
  it('未正解なら行動、正解済みなら知識のナレッジを選ぶ', async () => {
    const action = entryOf({ entryId: 'gen-aed-a', kind: 'action' })
    const knowledge = entryOf({ entryId: 'gen-aed-k', kind: 'knowledge', claim: '屋外設置なら夜間でも取りに行ける' })
    const source = createKnowledgeQuizSource({
      connection: { ...connection, apiKey: '' },
      model: MODEL,
      base: baseOf([action, knowledge]),
      timeoutMs: 100,
    })

    const first = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: false })
    const second = await source.pick({ spotId: SPOT, category: 'aed', alreadyCleared: true })

    expect(first?.kind).toBe('action')
    expect(second?.kind).toBe('knowledge')
  })
})
