import { describe, expect, it } from 'vitest'
import { buildCheckinView, NO_PROGRESS, progressFromStored } from './checkin-view.js'

/**
 * ★ 見ているのは「押せないときに理由が出ること」である。
 *
 * 押せない理由が同じ文言になると、利用者は自力で抜け出せない
 * （近づけばよいのか、待てばよいのかが分からない）。
 */

const NOW = 1_700_000_000_000

describe('buildCheckinView', () => {
  it('圏内なら押せる', () => {
    const view = buildCheckinView({
      distanceM: 40,
      radiusM: 100,
      progress: NO_PROGRESS,
      now: NOW,
    })

    expect(view.enabled).toBe(true)
    expect(view.label).toBe('チェックインする')
  })

  it('2回目以降は文言が変わる（同じ場所へ来たことが伝わる）', () => {
    const view = buildCheckinView({
      distanceM: 10,
      radiusM: 100,
      progress: { ...NO_PROGRESS, visitCount: 3 },
      now: NOW,
    })

    expect(view.enabled).toBe(true)
    expect(view.label).toContain('また来た')
  })

  it('★ 位置が無いときは押せず、位置情報の話だと分かる', () => {
    const view = buildCheckinView({
      distanceM: null,
      radiusM: 100,
      progress: NO_PROGRESS,
      now: NOW,
    })

    expect(view.enabled).toBe(false)
    expect(view.note).toContain('位置情報')
  })

  it('★ 遠いときは「あと何m」を出す', () => {
    const view = buildCheckinView({
      distanceM: 250,
      radiusM: 100,
      progress: NO_PROGRESS,
      now: NOW,
    })

    expect(view.enabled).toBe(false)
    expect(view.note).toContain('150m')
  })

  it('★ 制限中は残り時間を出す。明けたら押せる', () => {
    const nextAvailableAt = NOW + 90 * 60 * 1000
    const during = buildCheckinView({
      distanceM: 10,
      radiusM: 100,
      progress: { ...NO_PROGRESS, visitCount: 1, nextAvailableAt },
      now: NOW,
    })

    expect(during.enabled).toBe(false)
    expect(during.label).toContain('あと 2 時間')

    const after = buildCheckinView({
      distanceM: 10,
      radiusM: 100,
      progress: { ...NO_PROGRESS, visitCount: 1, nextAvailableAt },
      now: nextAvailableAt,
    })
    expect(after.enabled).toBe(true)
  })

  it('境界（半径ちょうど）は押せる。サーバーの判定と同じ側に寄せる', () => {
    const view = buildCheckinView({
      distanceM: 100,
      radiusM: 100,
      progress: NO_PROGRESS,
      now: NOW,
    })

    expect(view.enabled).toBe(true)
  })
})

describe('progressFromStored', () => {
  it('★ 待ち時間は設定から計算する（保存側に焼き付けない）', () => {
    const stored = {
      'sample-spot': { lastCheckinAt: NOW, visitCount: 2, quizClearedAt: undefined },
    }

    expect(progressFromStored(stored, 24)['sample-spot']?.nextAvailableAt).toBe(
      NOW + 24 * 60 * 60 * 1000,
    )
    // 設定を変えれば、同じ保存値から別の待ち時間が出る
    expect(progressFromStored(stored, 1)['sample-spot']?.nextAvailableAt).toBe(NOW + 60 * 60 * 1000)
  })

  it('クイズの正解時刻は真偽値へ落とす（画面が使うのは有無だけ）', () => {
    const stored = {
      done: { lastCheckinAt: NOW, visitCount: 1, quizClearedAt: NOW },
      todo: { lastCheckinAt: NOW, visitCount: 1, quizClearedAt: undefined },
    }
    const view = progressFromStored(stored, 24)

    expect(view['done']?.quizCleared).toBe(true)
    expect(view['todo']?.quizCleared).toBe(false)
  })
})
