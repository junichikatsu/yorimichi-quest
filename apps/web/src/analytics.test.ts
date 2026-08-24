import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  trackAppStart,
  trackCheckin,
  trackEmergencyMode,
  trackQuizAnswered,
  trackSurveyAnswered,
} from './analytics.js'

/**
 * 利用状況の計測（#82）。
 *
 * ★ 検査したいのは2つだけである。
 * 1. **タグが無くても落ちない。** 未設定・広告ブロッカー・読み込み失敗はすべてこの状態になる
 * 2. **個人を識別できる値を送らない。** 送る内容は関数の形で縛ってあるが、
 *    引数が増えたときに気づけるよう、実際に渡っている中身を見る
 */

type Call = [string, string, Record<string, unknown> | undefined]

function stubGtag(): Call[] {
  const calls: Call[] = []
  const holder = globalThis as { gtag?: unknown }
  holder.gtag = (command: string, name: string, params?: Record<string, unknown>) => {
    calls.push([command, name, params])
  }
  return calls
}

afterEach(() => {
  delete (globalThis as { gtag?: unknown }).gtag
})

describe('計測タグが無いとき', () => {
  it('★ 何も送らずに返る（未設定が既定の状態である）', () => {
    expect(() => {
      trackAppStart('line')
      trackCheckin('shelter')
      trackSurveyAnswered()
      trackQuizAnswered(true)
      trackEmergencyMode(true)
    }).not.toThrow()
  })

  it('★ gtag が関数でない値でも呼ばない', () => {
    // 読み込みに失敗した・別のものが同じ名前を使った、を想定する
    ;(globalThis as { gtag?: unknown }).gtag = { push: vi.fn() }
    expect(() => trackAppStart('guest')).not.toThrow()
  })
})

describe('計測タグがあるとき', () => {
  it('起動は入口の別を送る', () => {
    const calls = stubGtag()
    trackAppStart('guest')
    expect(calls).toEqual([['event', 'app_start', { mode: 'guest' }]])
  })

  it('チェックインは種類だけを送る（スポットの個別IDは送らない）', () => {
    const calls = stubGtag()
    trackCheckin('accessible_toilet')
    expect(calls).toEqual([['event', 'checkin', { category: 'accessible_toilet' }]])
  })

  it('アンケートは中身を送らない（回答そのものはサーバーへ行く）', () => {
    const calls = stubGtag()
    trackSurveyAnswered()
    expect(calls).toEqual([['event', 'survey_answered', undefined]])
  })

  it('クイズは正誤を送る', () => {
    const calls = stubGtag()
    trackQuizAnswered(false)
    expect(calls).toEqual([['event', 'quiz_answered', { correct: false }]])
  })

  it('有事モードは切替の向きを送る', () => {
    const calls = stubGtag()
    trackEmergencyMode(true)
    expect(calls).toEqual([['event', 'emergency_mode', { on: true }]])
  })

  it('★ 送っている値に個人を識別できるものが混ざっていない', () => {
    const calls = stubGtag()
    trackAppStart('line')
    trackCheckin('aed')
    trackSurveyAnswered()
    trackQuizAnswered(true)
    trackEmergencyMode(false)

    const forbidden = ['userId', 'user_id', 'displayName', 'name', 'lat', 'lng', 'spotId', 'spot_id']
    for (const [, , params] of calls) {
      for (const key of Object.keys(params ?? {})) {
        expect(forbidden, `${key} を送っている`).not.toContain(key)
      }
    }
  })

  it('★ 計測側が投げてもアプリを止めない', () => {
    ;(globalThis as { gtag?: unknown }).gtag = () => {
      throw new Error('blocked')
    }
    expect(() => trackCheckin('water')).not.toThrow()
  })
})
