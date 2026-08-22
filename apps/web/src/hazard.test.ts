import { distanceMeters } from '@imanouchi/core'
import { describe, expect, it } from 'vitest'
import {
  classifyPixel,
  DEPTH_LEGEND,
  HAZARD_LAYERS,
  HAZARD_RESHOW_DISTANCE_M,
  hazardSentence,
  hazardTileUrl,
  isHazardNoticeVisible,
  tileNorthWest,
  tilePointOf,
  worseSample,
  type HazardDismissal,
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

/**
 * 知らせを出すかどうか（#72）。
 *
 * ★ 知らせは状態バーへ重ねて**一番上**に出すので、下にある操作（キャラメイク・
 * 位置情報・有事モードの切替）を覆う。だから押して消せるようにしてあるが、
 * **「消したのに出る」「消したら二度と出ない」のどちらも起こりうる。**
 * 境界（別の区域へ入った・100m 歩いた）は歩いて再現できないので、ここで固定する。
 */
describe('isHazardNoticeVisible', () => {
  const PARTS = '洪水（3〜5m未満）'
  const AT = { lat: 35.6739, lng: 139.7568 }

  function visible(
    parts: string,
    dismissal: HazardDismissal | undefined,
    position: { lat: number; lng: number } | undefined = AT,
  ): boolean {
    return isHazardNoticeVisible({ parts, dismissal, position, distanceM: distanceMeters })
  }

  it('区域外では出さない', () => {
    expect(visible('', undefined)).toBe(false)
  })

  it('★ 区域外では、消したかどうかに関係なく出さない', () => {
    expect(visible('', { parts: PARTS, position: AT })).toBe(false)
  })

  it('消していなければ出す', () => {
    expect(visible(PARTS, undefined)).toBe(true)
  })

  it('★ 消した直後は出さない（同じ場所・同じ区域）', () => {
    expect(visible(PARTS, { parts: PARTS, position: AT })).toBe(false)
  })

  it('★ 別の区域へ入ったら出し直す（深さが変わった場合も）', () => {
    /*
     * ★ ここが出し直さないと、**深さの区分が変わっても気づけない。**
     * 3〜5m の区域で消したまま 10〜20m の区域へ入っても黙ることになる。
     */
    expect(visible('洪水（10〜20m未満）', { parts: PARTS, position: AT })).toBe(true)
    expect(visible('高潮（3〜5m未満）', { parts: PARTS, position: AT })).toBe(true)
  })

  it('★ 区域を出て入り直したら出し直す', () => {
    // 出た時点で消した記録は残るが、入り直したときは「消していない区域」になる
    expect(visible(PARTS, { parts: '', position: AT })).toBe(true)
  })

  it('★ 少し動いただけでは出し直さない（消せる意味を残す）', () => {
    /*
     * ★ 判定は約11m ごとに作り直される。その粒度で出し直すと、
     * **消しても十数歩で戻ってくる**。
     */
    const moved = { lat: AT.lat + 0.0002, lng: AT.lng } // 約22m

    expect(distanceMeters(AT, moved)).toBeLessThan(HAZARD_RESHOW_DISTANCE_M)
    expect(visible(PARTS, { parts: PARTS, position: AT }, moved)).toBe(false)
  })

  it('★ 歩いたら出し直す（永久には黙らない）', () => {
    // 危ない場所に居ることの知らせであり、一度消したら二度と出ないのは安全側ではない
    const moved = { lat: AT.lat + 0.0015, lng: AT.lng } // 約167m

    expect(distanceMeters(AT, moved)).toBeGreaterThan(HAZARD_RESHOW_DISTANCE_M)
    expect(visible(PARTS, { parts: PARTS, position: AT }, moved)).toBe(true)
  })

  it('★ 出し直す距離は判定の粒度より十分に大きい', () => {
    // 11m 程度で出し直すと消せる意味が無い
    expect(HAZARD_RESHOW_DISTANCE_M).toBeGreaterThanOrEqual(50)
  })

  it('位置が取れないあいだは出し直さない（動いたと言えない）', () => {
    expect(visible(PARTS, { parts: PARTS, position: AT }, undefined)).toBe(false)
  })

  it('★ 消したときの位置が無くても、区域が変われば出し直す', () => {
    /*
     * ★ 位置を 0,0 や NaN で埋めていると、距離の比較が常に偽になって
     * **二度と出し直せなくなる。** 無いことをそのまま持つ。
     */
    expect(visible(PARTS, { parts: PARTS, position: undefined })).toBe(false)
    expect(visible('高潮（3〜5m未満）', { parts: PARTS, position: undefined })).toBe(true)
  })
})
