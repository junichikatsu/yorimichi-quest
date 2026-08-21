import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canPlaySound,
  enableSound,
  notifyAreaUnlocked,
  resetFeedback,
  vibrate,
} from './feedback.js'

/**
 * 音と振動。
 *
 * ★ 守りたいのは「対応していない端末で落ちない」こと。
 * iOS は `navigator.vibrate` が無く、`navigator.audioSession` も端末次第である。
 * ここで落ちると歩行中モードごと使えなくなる。
 */

/** 最小限の AudioContext 代役。鳴らす部分は呼ばれても落ちないだけでよい */
function fakeAudioContext(state: AudioContextState = 'suspended') {
  const node = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: '',
    frequency: { value: 0 },
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  }

  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    createOscillator: vi.fn(() => node),
    createGain: vi.fn(() => node),
  }
  return ctx
}

afterEach(() => {
  resetFeedback()
  vi.unstubAllGlobals()
})

describe('enableSound', () => {
  it('AudioContext が無い環境では false を返す（落ちない）', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})

    expect(await enableSound()).toBe(false)
    expect(canPlaySound()).toBe(false)
  })

  it('suspended なら resume して鳴らせるようにする', async () => {
    const ctx = fakeAudioContext('suspended')
    vi.stubGlobal('window', { AudioContext: vi.fn(() => ctx) })
    vi.stubGlobal('navigator', {})

    expect(await enableSound()).toBe(true)
    expect(ctx.resume).toHaveBeenCalled()
    expect(canPlaySound()).toBe(true)
  })

  it('★ マナーモードでも鳴るように audioSession を playback にする', async () => {
    const ctx = fakeAudioContext('running')
    const session = { type: 'auto' }
    vi.stubGlobal('window', { AudioContext: vi.fn(() => ctx) })
    vi.stubGlobal('navigator', { audioSession: session })

    await enableSound()

    expect(session.type).toBe('playback')
  })

  it('audioSession が書き込みを拒んでも音は有効にする', async () => {
    const ctx = fakeAudioContext('running')
    const session = {}
    Object.defineProperty(session, 'type', {
      get: () => 'auto',
      set: () => {
        throw new Error('read only')
      },
    })
    vi.stubGlobal('window', { AudioContext: vi.fn(() => ctx) })
    vi.stubGlobal('navigator', { audioSession: session })

    expect(await enableSound()).toBe(true)
  })

  it('webkit 接頭辞の付いた実装も使う（古い iOS）', async () => {
    const ctx = fakeAudioContext('running')
    vi.stubGlobal('window', { webkitAudioContext: vi.fn(() => ctx) })
    vi.stubGlobal('navigator', {})

    expect(await enableSound()).toBe(true)
  })
})

describe('vibrate', () => {
  it('★ 対応していなければ false を返すだけ（iOS はここに入る）', () => {
    vi.stubGlobal('navigator', {})
    expect(vibrate([100])).toBe(false)
  })

  it('対応していれば渡した並びで呼ぶ', () => {
    const spy = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate: spy })

    expect(vibrate([120, 90, 120])).toBe(true)
    expect(spy).toHaveBeenCalledWith([120, 90, 120])
  })

  it('呼び出しが例外を投げても伝播させない', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked')
      },
    })

    expect(vibrate([100])).toBe(false)
  })
})

describe('notifyAreaUnlocked', () => {
  it('★ 音を有効にしていなくても落ちない（無音で通り過ぎる）', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})

    expect(() => notifyAreaUnlocked()).not.toThrow()
  })

  it('有効にしてあれば音を組み立てる', async () => {
    const ctx = fakeAudioContext('running')
    vi.stubGlobal('window', { AudioContext: vi.fn(() => ctx) })
    vi.stubGlobal('navigator', {})
    await enableSound()

    notifyAreaUnlocked()

    // 上昇する2音。下降だと失敗に聞こえる
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
  })
})
