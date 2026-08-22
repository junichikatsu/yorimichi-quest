import { describe, expect, it, vi } from 'vitest'
import { applyMask, type MaskTarget } from './canvas-mask.js'

/**
 * マスクの当て方。
 *
 * ★ 守りたいのは「**1回の描画で当てる**」ことである。図形ごとに
 * `destination-in` を当てると全部の交差になり、歩いたところが何十個もある実際の
 * 画面では**何も残らない**。実際にそれでハザードが平時に出なかった。
 *
 * ★ 絵そのものは自動では確かめられないが、**この呼び方の崩れ**は確かめられる。
 */

function fakeTarget(): MaskTarget & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    globalCompositeOperation: 'source-over',
    drawImage: vi.fn(function (this: void, _image, dx, dy, dw, dh) {
      calls.push(`draw:${dx},${dy},${dw},${dh}`)
    }),
  }
}

const MASK = {} as CanvasImageSource

describe('applyMask', () => {
  it('★ 1回の描画で当てる（図形ごとに当てると交差になって消える）', () => {
    const ctx = fakeTarget()

    applyMask(ctx, MASK, 'destination-in', 300, 200)

    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
    expect(ctx.calls).toEqual(['draw:0,0,300,200'])
  })

  it('★ 呼ぶ側の合成モードを壊さない（次の描画が消える事故を防ぐ）', () => {
    const ctx = fakeTarget()
    ctx.globalCompositeOperation = 'source-over'

    applyMask(ctx, MASK, 'destination-out', 10, 10)

    expect(ctx.globalCompositeOperation).toBe('source-over')
  })

  it('当てている最中は指定した合成モードになっている', () => {
    const ctx = fakeTarget()
    const seen: GlobalCompositeOperation[] = []
    ctx.drawImage = vi.fn(() => {
      seen.push(ctx.globalCompositeOperation)
    })

    applyMask(ctx, MASK, 'destination-in', 10, 10)

    expect(seen).toEqual(['destination-in'])
  })
})
