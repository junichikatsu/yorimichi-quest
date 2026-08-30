import { describe, expect, it } from 'vitest'
import {
  materialFor,
  selectEntries,
  statsOf,
  usableEntries,
  validateEntry,
  type KnowledgeBase,
  type KnowledgeEntry,
} from './knowledge.js'

/**
 * 構造化ナレッジベース（#75・FR-04-2）。
 *
 * ★ ここで固定しているのは**防災の文言が誤って配られない条件**である。
 * どれも壊れても画面は普通のクイズに見え、**間違いに気づけるのは現地で
 * 困った人だけ**になる。型では守れない。
 */

function entryOf(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    entryId: 'aed-indoor-1',
    scope: 'category',
    key: 'aed',
    category: 'aed',
    context: 'AEDを使うとき、まずすることは？',
    kind: 'action',
    claim: 'AEDは倒れた人のそばへ運び、音声の指示どおりに使う',
    distractors: ['医師が来るまで触らない', '心臓マッサージをやめてから貼る'],
    why: '到着を待つ数分が生存率を大きく下げる',
    sources: [{ title: '日本蘇生協議会 JRC蘇生ガイドライン', url: 'https://www.jrc-cpr.org/', fetchedAt: '2026-08-30' }],
    reviewed: true,
    ...overrides,
  }
}

function baseOf(entries: KnowledgeEntry[]): KnowledgeBase {
  return { generatedAt: '2026-08-30', entries }
}

describe('人が確かめていないものは配らない', () => {
  /*
   * ★ 3-2 の「人が確かめたナレッジの範囲でしか書かせません」は、このフラグ1つで
   * 執行される。ここが緩むと、高性能モデルが書いたままの文言が現地の人へ届く。
   */
  it('★ reviewed が false のエントリは出題に使わない', () => {
    const base = baseOf([entryOf({ reviewed: false })])

    expect(usableEntries(base)).toEqual([])
    expect(selectEntries(base, { category: 'aed', spotId: 's1', chomeCode: undefined, prefer: 'action' })).toEqual([])
  })

  it('★ reviewed が true でも、壊れていれば使わない', () => {
    const base = baseOf([entryOf({ distractors: ['1件だけ'] })])

    expect(usableEntries(base)).toEqual([])
  })

  it('確かめ済みで壊れていなければ使う', () => {
    expect(usableEntries(baseOf([entryOf()])).length).toBe(1)
  })
})

describe('正解が2つある問題を作らせない', () => {
  it('★ claim と同じ内容の distractor を弾く', () => {
    const problems = validateEntry(
      entryOf({ distractors: ['AEDは倒れた人のそばへ運び、音声の指示どおりに使う', '医師を待つ'] }),
    )

    expect(problems.join()).toContain('正解が2つになる')
  })

  it('★ 記号や空白の差では逃がさない', () => {
    const problems = validateEntry(
      entryOf({ distractors: ['AEDは倒れた人のそばへ運び、 音声の指示どおりに使う。', '医師を待つ'] }),
    )

    expect(problems.join()).toContain('正解が2つになる')
  })

  it('distractors の重複を弾く', () => {
    const problems = validateEntry(entryOf({ distractors: ['医師を待つ', '医師を待つ'] }))

    expect(problems.join()).toContain('重複')
  })
})

describe('3択に足りるか', () => {
  it('★ distractors が2件未満なら弾く（3択にならない）', () => {
    expect(validateEntry(entryOf({ distractors: [] })).join()).toContain('2 件以上必要')
    expect(validateEntry(entryOf({ distractors: ['ひとつ'] })).join()).toContain('2 件以上必要')
  })

  it('空文字の distractor を弾く', () => {
    expect(validateEntry(entryOf({ distractors: ['医師を待つ', '  '] })).join()).toContain('空の distractor')
  })
})

describe('根拠を辿れないものを通さない', () => {
  it('★ sources が空なら弾く', () => {
    expect(validateEntry(entryOf({ sources: [] })).join()).toContain('根拠を辿れない')
  })

  it('★ 取得日の形式を固定する（3-2「出典と取得日を保った」）', () => {
    const problems = validateEntry(
      entryOf({ sources: [{ title: 'なにか', url: '', fetchedAt: '2026/08/30' }] }),
    )

    expect(problems.join()).toContain('YYYY-MM-DD でない')
  })

  it('URL が無くても、資料名と取得日があれば通す（紙の資料もある）', () => {
    expect(
      validateEntry(entryOf({ sources: [{ title: '内閣府 避難所運営ガイドライン', url: '', fetchedAt: '2026-08-30' }] })),
    ).toEqual([])
  })
})

describe('近いものから使う', () => {
  const spot = entryOf({ entryId: 'e-spot', scope: 'spot', key: 'spot-1' })
  const chome = entryOf({ entryId: 'e-chome', scope: 'chome', key: '13103008001' })
  const category = entryOf({ entryId: 'e-cat', scope: 'category', key: 'aed' })
  const base = baseOf([category, chome, spot])

  it('スポット → 町丁目 → カテゴリ の順に並ぶ', () => {
    const got = selectEntries(base, {
      category: 'aed',
      spotId: 'spot-1',
      chomeCode: '13103008001',
      prefer: 'action',
    })

    expect(got.map((e) => e.entryId)).toEqual(['e-spot', 'e-chome', 'e-cat'])
  })

  it('★ 町丁目が分からなくても、カテゴリまで落ちて必ず何か出る（画面を詰まらせない）', () => {
    const got = selectEntries(base, {
      category: 'aed',
      spotId: 'other-spot',
      chomeCode: undefined,
      prefer: 'action',
    })

    expect(got.map((e) => e.entryId)).toEqual(['e-cat'])
  })

  it('別のスポットのナレッジを混ぜない', () => {
    const got = selectEntries(baseOf([spot]), {
      category: 'aed',
      spotId: 'other-spot',
      chomeCode: undefined,
      prefer: 'action',
    })

    expect(got).toEqual([])
  })

  it('カテゴリが違うものは出さない', () => {
    const got = selectEntries(base, {
      category: 'water',
      spotId: 'spot-1',
      chomeCode: '13103008001',
      prefer: 'action',
    })

    expect(got).toEqual([])
  })
})

describe('行動を先に出す（FR-04-7・G-8）', () => {
  const action = entryOf({ entryId: 'e-action', kind: 'action' })
  const knowledge = entryOf({ entryId: 'e-knowledge', kind: 'knowledge' })
  const base = baseOf([knowledge, action])

  it('action を望めば action が先に来る', () => {
    const got = selectEntries(base, { category: 'aed', spotId: 's', chomeCode: undefined, prefer: 'action' })
    expect(got[0]?.entryId).toBe('e-action')
  })

  it('knowledge を望めば knowledge が先に来る', () => {
    const got = selectEntries(base, { category: 'aed', spotId: 's', chomeCode: undefined, prefer: 'knowledge' })
    expect(got[0]?.entryId).toBe('e-knowledge')
  })

  it('★ 望む種類が無くても空にしない（片方しか無いカテゴリがある）', () => {
    const got = selectEntries(baseOf([knowledge]), {
      category: 'aed',
      spotId: 's',
      chomeCode: undefined,
      prefer: 'action',
    })

    expect(got.map((e) => e.entryId)).toEqual(['e-knowledge'])
  })
})

describe('モデルへ渡す材料', () => {
  /*
   * ★ 渡す範囲を絞ることが安全側の設計そのものである。スポットの生データや
   * 他のエントリを混ぜると、モデルがそこから事実を作る余地ができる。
   */
  it('★ claim・distractors・why・出典だけを渡す（reviewed や scope は渡さない）', () => {
    const material = materialFor(entryOf(), '港区役所')

    expect(Object.keys(material).sort()).toEqual(
      ['category', 'claim', 'context', 'distractors', 'entryId', 'kind', 'sources', 'spotName', 'why'].sort(),
    )
  })

  it('★ distractors を複製して渡す（モデル側の都合で元を書き換えさせない）', () => {
    const entry = entryOf()
    const material = materialFor(entry, '港区役所')
    material.distractors.push('あとから足した')

    expect(entry.distractors.length).toBe(2)
  })
})

describe('集計', () => {
  it('未レビューと壊れているものを数える', () => {
    const base = baseOf([
      entryOf({ entryId: 'a' }),
      entryOf({ entryId: 'b', reviewed: false }),
      entryOf({ entryId: 'c', scope: 'spot', key: 's1', distractors: [] }),
    ])

    const stats = statsOf(base)
    expect(stats.total).toBe(3)
    expect(stats.reviewed).toBe(2)
    expect(stats.unreviewed).toBe(1)
    expect(stats.invalid).toBe(1)
    expect(stats.byScope).toEqual({ category: 2, chome: 0, spot: 1 })
  })
})
