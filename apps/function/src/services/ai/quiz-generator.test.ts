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

/** 港区芝浦二丁目あたり。**実在の浸水想定区域**を使う（座標を偵っても意味がない） */
const AT = { lat: 35.6455, lng: 139.7495 }

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
    const picked = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })
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
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })

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
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })

    expect(quiz?.question).toBe(entryFromKnowledge(entryOf()).question)
  })

  it('★ 見出しに正解が透けていたら捨てる（カード一覧で答えが読める）', async () => {
    vi.stubGlobal('fetch', async () =>
      reply({ question: 'まずどうしますか。', explanation: 'ok', scene: 'AEDのふたを開けて電源を入れ' }),
    )

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })

    expect(quiz?.card.scene).not.toContain('ふたを開けて電源を入れ')
  })

  it('空の応答は素の言い回しに戻す', async () => {
    vi.stubGlobal('fetch', async () => reply({ question: '', explanation: '', scene: '' }))

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })

    expect(quiz?.question).toBe(entryFromKnowledge(entryOf()).question)
    expect(quiz?.explanation).toBe(entryOf().why)
  })
})

describe('落ちても画面を止めない（G-7）', () => {
  it('★ 生成が失敗しても出題は返る', async () => {
    vi.stubGlobal('fetch', async () => new Response('boom', { status: 500 }))

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })

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
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })

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
    const quiz = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })

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
    await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })
    await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })

    expect(calls).toBe(1)
  })

  it('★ 別のスポットでも同じナレッジなら呼び直さない（出題はナレッジ単位）', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return reply({ question: 'まずどうしますか。', explanation: 'ok', scene: '場面' })
    })

    const source = createKnowledgeQuizSource({ connection, model: MODEL, base: baseOf([entryOf()]), timeoutMs: 100 })
    await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })
    await source.pick({ spotId: asSpotId('aed-9999'), category: 'aed', ...AT, alreadyCleared: false })

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

    const first = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: false })
    const second = await source.pick({ spotId: SPOT, category: 'aed', ...AT, alreadyCleared: true })

    expect(first?.kind).toBe('action')
    expect(second?.kind).toBe('knowledge')
  })
})

describe('場所に応じた知識を出す（#72）', () => {
  const hazardEntry = entryOf({
    entryId: 'haz-test-1',
    scope: 'hazard',
    // ★ 実データの型ID。芝浦二丁目は高潮93%・洪水ありなので両方の型に入る
    key: 'flood-hightide-mid',
    category: 'shelter',
    claim: 'この場所の浸水想定は1階が水没しうる深さのため、避難するときは建物の2階以上に上がる',
  })
  const categoryEntry = entryOf({ entryId: 'cat-shelter-1', category: 'shelter' })

  it('★ 浸水想定区域の中のスポットでは、区域の知識が先に出る', async () => {
    const source = createKnowledgeQuizSource({
      connection: { ...connection, apiKey: '' },
      model: MODEL,
      base: baseOf([categoryEntry, hazardEntry]),
      timeoutMs: 100,
    })

    // 港区芝浦二丁目（実在の浸水想定区域）
    const quiz = await source.pick({
      spotId: asSpotId('shelter-0001'),
      category: 'shelter',
      lat: 35.6455,
      lng: 139.7495,
      alreadyCleared: false,
    })

    expect(quiz?.quizId).toBe('kb-haz-test-1')
  })

  it('★ 区域の外では区域の知識を出さない（対象エリアの外も同じ扱い）', async () => {
    const source = createKnowledgeQuizSource({
      connection: { ...connection, apiKey: '' },
      model: MODEL,
      base: baseOf([categoryEntry, hazardEntry]),
      timeoutMs: 100,
    })

    // 千代田区・港区の外（町丁目が引けない）
    const quiz = await source.pick({
      spotId: asSpotId('shelter-0002'),
      category: 'shelter',
      lat: 43.06,
      lng: 141.35,
      alreadyCleared: false,
    })

    expect(quiz?.quizId).toBe('kb-cat-shelter-1')
  })
})

describe('いちばん近い層の中から選ぶ', () => {
  /*
   * ★ 近い順に並べておきながら全候補から選ぶと、並びが無意味になる。
   * 浸水想定区域の中に立っているのにカテゴリの一般論が出るのは、
   * この機能の値打ちを消す。
   */
  it('★ 層の中では散らす（歩いても同じ問題を繰り返さない）', async () => {
    const a = entryOf({ entryId: 'cat-a', category: 'shelter' })
    const b = entryOf({ entryId: 'cat-b', category: 'shelter', claim: '別の正しいこと' })
    const source = createKnowledgeQuizSource({
      connection: { ...connection, apiKey: '' },
      model: MODEL,
      base: baseOf([a, b]),
      timeoutMs: 100,
    })

    const ids = new Set<string>()
    for (const id of ['s1', 's2', 's3', 's4', 's5', 's6']) {
      const quiz = await source.pick({
        spotId: asSpotId(`shelter-${id}`),
        category: 'shelter',
        lat: 43.06,
        lng: 141.35,
        alreadyCleared: false,
      })
      ids.add(quiz!.quizId)
    }

    expect(ids.size).toBeGreaterThan(1)
  })
})
