import type { SpotId } from '@imanouchi/shared'
import { describe, expect, it } from 'vitest'
import {
  appendWalkEvents,
  EMPTY_WALK_LOG,
  namesOf,
  WALK_LOG_MAX,
  type WalkEvent,
} from './walk-log.js'

/**
 * 覆っている間の控え。
 *
 * ★ 守りたいのは「見ていなかった間のことが、正しい件数で分かる」ことである。
 * 二重に積めば歩いた量を多く見せることになり、黙って捨てれば見落としになる。
 */

function arrival(key: string): WalkEvent {
  return { kind: 'arrival', key, name: `スポット${key}`, spotId: key as SpotId }
}

function area(key: string): WalkEvent {
  return { kind: 'area', key, name: `${key}丁目`, spotId: undefined }
}

describe('appendWalkEvents', () => {
  it('順番を保って足す', () => {
    const log = appendWalkEvents(appendWalkEvents(EMPTY_WALK_LOG, [area('a')]), [arrival('b')])

    expect(log.events.map((event) => event.key)).toEqual(['a', 'b'])
    expect(log.dropped).toBe(0)
  })

  it('★ 同じものは二重に積まない（測位が乱れて出入りしても1件）', () => {
    const once = appendWalkEvents(EMPTY_WALK_LOG, [arrival('a')])
    const twice = appendWalkEvents(once, [arrival('a')])

    expect(twice.events).toHaveLength(1)
    // 変化が無いなら同じ実体を返す（画面の書き替えを起こさない）
    expect(twice).toBe(once)
  })

  it('同じ鍵でも種類が違えば別に数える', () => {
    const log = appendWalkEvents(EMPTY_WALK_LOG, [arrival('x'), area('x')])

    expect(log.events).toHaveLength(2)
  })

  it('一度に渡した中の重複も潰す', () => {
    const log = appendWalkEvents(EMPTY_WALK_LOG, [arrival('a'), arrival('a')])

    expect(log.events).toHaveLength(1)
  })

  it('★ 上限を超えたら新しいほうを残し、落とした件数を覚える', () => {
    const many = Array.from({ length: WALK_LOG_MAX + 3 }, (_, index) => arrival(`s${index}`))
    const log = appendWalkEvents(EMPTY_WALK_LOG, many)

    expect(log.events).toHaveLength(WALK_LOG_MAX)
    expect(log.dropped).toBe(3)
    // 直前に何があったかを知りたいので、新しいほうを残す
    expect(log.events.at(-1)?.key).toBe(`s${WALK_LOG_MAX + 2}`)
  })

  it('落とした件数は積み上がる（黙って減らさない）', () => {
    const first = appendWalkEvents(
      EMPTY_WALK_LOG,
      Array.from({ length: WALK_LOG_MAX + 1 }, (_, index) => arrival(`a${index}`)),
    )
    const second = appendWalkEvents(first, [arrival('later')])

    expect(second.dropped).toBe(2)
  })
})

describe('namesOf', () => {
  it('種類ごとに名前を取り出す', () => {
    const log = appendWalkEvents(EMPTY_WALK_LOG, [area('神田'), arrival('a'), area('麹町')])

    expect(namesOf(log, 'area')).toEqual(['神田丁目', '麹町丁目'])
    expect(namesOf(log, 'arrival')).toEqual(['スポットa'])
  })
})
