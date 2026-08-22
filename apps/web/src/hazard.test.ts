import { describe, expect, it } from 'vitest'
import {
  classifyPixel,
  DEPTH_LEGEND,
  HAZARD_LAYERS,
  hazardSentence,
  hazardTileUrl,
  tileNorthWest,
  tilePointOf,
  worseSample,
} from './hazard.js'

/**
 * ハザード（浸水想定）の判定。
 *
 * ★ 守りたいのは「危険の程度を誤って伝えない」ことである。
 * 深さを取り違えれば、危ない場所を安全そうに見せることになる。
 *
 * ★ 色は**実際のタイルから読み出した値**で確かめる（2026-08-22、港区 z16）。
 * 覚えている値でテストを書くと、間違いをそのまま固定してしまう。
 */

describe('tilePointOf', () => {
  it('タイル番号を出す（港区 z16）', () => {
    // 実際に配信されているタイル（curl で 200 を確認した番号）と一致すること
    const point = tilePointOf(35.6499, 139.7472, 16)

    expect(point.x).toBe(58208)
    expect(point.y).toBe(25813)
    expect(point.z).toBe(16)
  })

  it('タイルの中の位置は 0〜255 に収まる', () => {
    for (const lat of [35.6, 35.65, 35.7]) {
      for (const lng of [139.7, 139.75, 139.8]) {
        const point = tilePointOf(lat, lng, 16)
        expect(point.px).toBeGreaterThanOrEqual(0)
        expect(point.px).toBeLessThanOrEqual(255)
        expect(point.py).toBeGreaterThanOrEqual(0)
        expect(point.py).toBeLessThanOrEqual(255)
      }
    }
  })

  it('★ タイルの北西角と往復する（描く位置がずれない）', () => {
    const point = tilePointOf(35.6499, 139.7472, 16)
    const nw = tileNorthWest(16, point.x, point.y)
    const back = tilePointOf(nw.lat - 1e-9, nw.lng + 1e-9, 16)

    expect(back.x).toBe(point.x)
    expect(back.y).toBe(point.y)
  })
})

describe('classifyPixel', () => {
  it('★ 透明なら区域の外（塗られていないところは区域外である）', () => {
    expect(classifyPixel(0, 0, 0, 0)).toEqual({ inside: false })
  })

  it('凡例の色から深さを引く（実タイルにあった色）', () => {
    // #F7F5A9 = 0.5m未満、#FFD8C0 = 0.5〜3m未満（港区のタイルに含まれていた）
    expect(classifyPixel(0xf7, 0xf5, 0xa9, 255)).toEqual({ inside: true, depth: '0.5m未満' })
    expect(classifyPixel(0xff, 0xd8, 0xc0, 255)).toEqual({ inside: true, depth: '0.5〜3m未満' })
  })

  it('わずかな色の揺れは同じ深さとして扱う', () => {
    expect(classifyPixel(0xf5, 0xf3, 0xa5, 255)).toEqual({ inside: true, depth: '0.5m未満' })
  })

  it('★ 凡例に無い色でも区域内として扱う（深さ不明と区域外は違う）', () => {
    // 高潮のタイルには浸水深の凡例に無い色が含まれている
    expect(classifyPixel(0xff, 0xff, 0xb3, 255)).toEqual({ inside: true, depth: undefined })
  })
})

describe('worseSample', () => {
  const outside = { inside: false } as const

  it('区域外より区域内を採る', () => {
    const inside = { inside: true, depth: '0.5m未満' } as const

    expect(worseSample(outside, inside)).toEqual(inside)
    expect(worseSample(inside, outside)).toEqual(inside)
  })

  it('★ 深い側を採る（境界では安全側に倒す）', () => {
    const shallow = { inside: true, depth: '0.5m未満' } as const
    const deep = { inside: true, depth: '3〜5m未満' } as const

    expect(worseSample(shallow, deep)).toEqual(deep)
    expect(worseSample(deep, shallow)).toEqual(deep)
  })

  it('深さ不明より、分かっているほうを採る', () => {
    const unknown = { inside: true, depth: undefined } as const
    const known = { inside: true, depth: '0.5m未満' } as const

    expect(worseSample(unknown, known)).toEqual(known)
    expect(worseSample(known, unknown)).toEqual(known)
  })

  it('凡例は深い順に並んでいる（worseSample がこの順に依存している）', () => {
    expect(DEPTH_LEGEND[0]?.label).toBe('20m以上')
    expect(DEPTH_LEGEND.at(-1)?.label).toBe('0.5m未満')
  })
})

describe('hazardSentence', () => {
  it('区域外なら何も言わない', () => {
    expect(hazardSentence([])).toBe('')
  })

  it('★ 断定しない（境界は数十mずれる）', () => {
    const sentence = hazardSentence([
      { id: 'hightide', label: '高潮', depth: '0.5〜3m未満' },
      { id: 'flood', label: '洪水', depth: undefined },
    ])

    expect(sentence).toContain('このあたりは')
    expect(sentence).toContain('高潮（0.5〜3m未満）')
    // 深さが分からないものは書かない（分かったように見せない）
    expect(sentence).toContain('洪水')
    expect(sentence).not.toContain('洪水（')
  })
})

describe('HAZARD_LAYERS', () => {
  it('★ 洪水と高潮だけを出す（津波と土砂は対象エリアに区域が無い）', () => {
    expect(HAZARD_LAYERS.map((layer) => layer.id)).toEqual(['hightide', 'flood'])
  })

  it('配信されているタイルの並びを組み立てる', () => {
    const layer = HAZARD_LAYERS[1]!

    expect(hazardTileUrl(layer, 16, 58208, 25813)).toBe(
      'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin/16/58208/25813.png',
    )
  })
})
