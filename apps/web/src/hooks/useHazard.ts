import { useEffect, useState } from 'react'
import {
  HAZARD_LAYERS,
  HAZARD_SAMPLE_ZOOM,
  hazardSentence,
  tilePointOf,
  type HazardHere,
} from '../hazard.js'
import { readHazardSample } from '../hazard-tiles.js'
import type { Position } from './useGeolocation.js'

/**
 * いまいる場所のハザード（#72）。
 *
 * ★ 判定はタイルの画素で行う（`hazard-tiles.ts`）。区域のポリゴンを持たせるより
 * 軽く、**表示しているものと同じ出どころ**なので絵と文言が食い違わない。
 *
 * ★ ポイントもカードも動かさない。ここは**知らせるだけ**の仕組みである（G-2）。
 * 濡れることを収集や称号にしてはいけない（FR-14-10）。
 */

export interface HazardState {
  /** いま入っている想定区域。空なら区域外 */
  here: HazardHere[]
  /** キャラクターを濡れた見た目にするか */
  wet: boolean
  /** 画面に出す文。区域外なら空文字 */
  sentence: string
}

const EMPTY: HazardState = { here: [], wet: false, sentence: '' }

/**
 * 判定を作り直す距離（m）。
 *
 * ★ 測位は数秒おきに数m揺れる。そのたびにタイルを読み直すと、**立ち止まっている
 * のに濡れたり乾いたりする**。判定の粒度（3×3 画素 ≒ 7m）より粗くしておく。
 */
const MOVE_THRESHOLD_DEG = 0.0001 // 緯度で約11m

function farEnough(a: Position | undefined, b: Position | undefined): boolean {
  if (!a || !b) return true
  return (
    Math.abs(a.lat - b.lat) > MOVE_THRESHOLD_DEG || Math.abs(a.lng - b.lng) > MOVE_THRESHOLD_DEG
  )
}

export function useHazard(position: Position | undefined, enabled: boolean): HazardState {
  const [state, setState] = useState<HazardState>(EMPTY)
  /** 判定に使った位置。近いうちは作り直さない */
  const [judgedAt, setJudgedAt] = useState<Position | undefined>(undefined)
  /**
   * タイルが届いたことの合図。
   *
   * ★ 読み込み待ちの間に位置が変わらないことがある（`watchPosition` は位置が
   * 変わらないと通知しない）。**タイルが届いたら自分で作り直す**必要がある。
   */
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled || !position) {
      setState(EMPTY)
      setJudgedAt(undefined)
      return
    }

    if (!farEnough(position, judgedAt)) return

    const bump = (): void => setTick((count) => count + 1)
    const here: HazardHere[] = []
    let pending = false

    for (const layer of HAZARD_LAYERS) {
      const point = tilePointOf(position.lat, position.lng, HAZARD_SAMPLE_ZOOM)
      /*
       * ★ タイルが未着なら「区域外」と決めない。読めてから決める。
       * 未着を区域外として扱うと、開いた直後は必ず「区域外」に見える。
       */
      const sample = readHazardSample(layer, point, bump)
      if (sample === undefined) {
        pending = true
        continue
      }
      if (sample.inside) here.push({ id: layer.id, label: layer.label, depth: sample.depth })
    }

    // 読めていないタイルがあるうちは位置を確定させない（届いたら tick で戻ってくる）
    if (!pending) setJudgedAt(position)

    const sentence = hazardSentence(here)
    setState((current) =>
      // 中身が同じなら差し替えない（キャラの作り直しを起こさない）
      current.sentence === sentence ? current : { here, wet: here.length > 0, sentence },
    )
  }, [enabled, position, judgedAt, tick])

  return state
}
