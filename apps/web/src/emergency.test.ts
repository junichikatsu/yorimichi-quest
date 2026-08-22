import type { AreaId, SpotCategory, SpotId, SpotWithDistance } from '@imanouchi/shared'
import { describe, expect, it } from 'vitest'
import { gameElements, LIFELINE_ORDER, hasAccessibilityNote, lifelineGroups } from './emergency.js'

/**
 * 有事モードのライフライン。
 *
 * ★ 守りたいのは2つ。
 * 1. **属性が空欄のスポットを「非対応」として扱わない**（未記入と非対応は違う）
 * 2. **件数の多いカテゴリで他が押し出されない**（AED が 224 件あり、距離順に
 *    全体を並べると避難所が画面から消える）
 */

function spot(
  overrides: Partial<SpotWithDistance> & { category: SpotCategory; distanceM: number | null },
): SpotWithDistance {
  return {
    spotId: 'sp-1' as SpotId,
    areaId: 'chiyoda-minato' as AreaId,
    name: '名称',
    lat: 35.6739,
    lng: 139.7568,
    address: '住所',
    attributes: [],
    source: 'test',
    fetchedAt: '2026-08-20',
    checkinCount: 0,
    updatedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  }
}

const OPTIONS = { perCategory: 3, accessibleOnly: false }

describe('hasAccessibilityNote', () => {
  it('取込済みデータの表記を拾う', () => {
    // 実データにある文字列（避難所・トイレの両方の書き方）
    for (const attribute of [
      '車椅子使用者対応トイレ',
      'スロープ等',
      'エレベーターまたは1階に避難スペース',
      'バリアフリートイレ 1',
      '点字ブロック',
      'オストメイト対応',
    ]) {
      expect(hasAccessibilityNote(spot({ category: 'shelter', distanceM: 0, attributes: [attribute] })), attribute).toBe(true)
    }
  })

  it('★ 空欄は「非対応」ではなく「記載なし」（絞り込みの対象外にするだけ）', () => {
    expect(hasAccessibilityNote(spot({ category: 'aed', distanceM: 0, attributes: [] }))).toBe(false)
  })

  it('関係のない属性では拾わない', () => {
    expect(
      hasAccessibilityNote(spot({ category: 'water', distanceM: 0, attributes: ['飲み口型'] })),
    ).toBe(false)
  })
})

describe('lifelineGroups', () => {
  it('★ カテゴリごとに出す（件数の多いカテゴリで他が押し出されない）', () => {
    // AED を大量に、避難所を1件だけ。距離順に全体を並べると避難所が消える
    const spots = [
      ...Array.from({ length: 50 }, (_, i) =>
        spot({ spotId: `aed-${i}` as SpotId, category: 'aed', distanceM: i }),
      ),
      spot({ spotId: 'shelter-1' as SpotId, category: 'shelter', distanceM: 900 }),
    ]

    const groups = lifelineGroups(spots, OPTIONS)
    const shelter = groups.find((group) => group.category === 'shelter')

    expect(shelter?.spots).toHaveLength(1)
    expect(groups.find((group) => group.category === 'aed')?.spots).toHaveLength(3)
  })

  it('カテゴリの順番は固定（まず身を寄せる場所、次に水）', () => {
    const groups = lifelineGroups([], OPTIONS)

    expect(groups.map((group) => group.category)).toEqual([...LIFELINE_ORDER])
    expect(LIFELINE_ORDER[0]).toBe('shelter')
  })

  it('近い順に並べる', () => {
    const spots = [
      spot({ spotId: 'far' as SpotId, category: 'shelter', distanceM: 800 }),
      spot({ spotId: 'near' as SpotId, category: 'shelter', distanceM: 120 }),
    ]

    expect(lifelineGroups(spots, OPTIONS)[0]?.spots.map((s) => s.spotId)).toEqual(['near', 'far'])
  })

  it('★ 距離が無くても出す（有事に「現在地が取れないから空」は最悪）', () => {
    const spots = [spot({ spotId: 'unknown' as SpotId, category: 'shelter', distanceM: null })]

    expect(lifelineGroups(spots, OPTIONS)[0]?.spots).toHaveLength(1)
  })

  it('絞り込むと記載のあるものだけになり、隠した件数を返す', () => {
    const spots = [
      spot({ spotId: 'noted' as SpotId, category: 'shelter', distanceM: 10, attributes: ['スロープ等'] }),
      spot({ spotId: 'blank' as SpotId, category: 'shelter', distanceM: 5, attributes: [] }),
    ]

    const group = lifelineGroups(spots, { perCategory: 3, accessibleOnly: true })[0]

    expect(group?.spots.map((s) => s.spotId)).toEqual(['noted'])
    // ★ 黙って減らさない。隠れた件数を画面に出すために返す
    expect(group?.hiddenByFilter).toBe(1)
  })

  it('該当が無いカテゴリも空で返す（欠けていることが分かるように）', () => {
    const groups = lifelineGroups([], OPTIONS)

    expect(groups).toHaveLength(LIFELINE_ORDER.length)
    expect(groups.every((group) => group.spots.length === 0)).toBe(true)
  })
})

describe('gameElements', () => {
  it('平時はゲーム要素をすべて出す', () => {
    expect(gameElements(false)).toEqual({
      points: true,
      checkin: true,
      quiz: true,
      exploration: true,
      cards: true,
    })
  })

  /*
   * ★ 有事は**すべて**隠す（FR-08-2）。
   *
   * この検査は「1つでも true が残ったら落ちる」形にしてある。
   * ゲーム要素を足したときにここへ列挙し忘れれば、型が通らない。
   */
  it('★ 有事モードではポイント・チェックイン・クイズ・探索をすべて隠す', () => {
    const hidden = gameElements(true)

    expect(Object.values(hidden).some(Boolean), '有事に残っている要素がある').toBe(false)
  })
})
