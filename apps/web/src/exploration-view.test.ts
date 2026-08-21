import { chomeOfTile, tileOf, tilesNeededToUnlock } from '@imanouchi/core'
import type { ExplorationConfig, ExplorationResponse, ExploredTile } from '@imanouchi/shared'
import { describe, expect, it } from 'vitest'
import { buildExplorationView, isInsideUnlockedArea, unlockConfigOf } from './exploration-view.js'

/**
 * ★ 区画は実在の町丁目なので、**実座標でしかテストできない**。
 * 原点付近の合成キーはどの町丁目にも入らない。
 */

const CONFIG: ExplorationConfig = {
  tileSizeM: 50,
  revealRadiusM: 40,
  areaRadiusM: 1500,
  maxPointsPerRequest: 200,
  unlockRatio: 0.25,
  unlockMaxTiles: 12,
  latitude: 35.6739,
}

/** 日比谷公園（千代田区） */
const HIBIYA = { lat: 35.6739, lng: 139.7568 }
/** 新宿区。境界データを持っていないので区画にならない */
const OUTSIDE = { lat: 35.6938, lng: 139.7034 }

/** ある地点と同じ町丁目に入るタイルだけを集める（町丁目は格子ではない） */
function tilesOfChome(origin: { lat: number; lng: number }, count: number): ExploredTile[] {
  const step = CONFIG.tileSizeM / 111_320
  const target = chomeOfTile(tileOf(origin, CONFIG.tileSizeM).key, CONFIG.tileSizeM)
  expect(target).toBeDefined()

  const tiles: ExploredTile[] = []
  for (let row = -20; row <= 20 && tiles.length < count; row += 1) {
    for (let col = -20; col <= 20 && tiles.length < count; col += 1) {
      const tile = tileOf(
        { lat: origin.lat + row * step, lng: origin.lng + col * step },
        CONFIG.tileSizeM,
      )
      if (chomeOfTile(tile.key, CONFIG.tileSizeM)?.code !== target?.code) continue
      tiles.push({
        tileKey: tile.key,
        lat: tile.center.lat,
        lng: tile.center.lng,
        firstSeenAt: '2026-08-21T00:00:00.000Z',
      })
    }
  }
  expect(tiles).toHaveLength(count)
  return tiles
}

/** サーバーの応答を組み立てる（確定分としてタイルをそのまま返す形） */
function serverResponse(tiles: ExploredTile[], truncated = false): ExplorationResponse {
  return {
    tiles,
    unlockedAreas: [],
    summary: {
      tileCount: tiles.length,
      exploredAreaM2: tiles.length * 2000,
      coveragePercent: 1,
      truncated,
    },
  }
}

describe('buildExplorationView', () => {
  it('送信中に歩いた分は、応答に含まれていなくても消えない', () => {
    const walked = tilesOfChome(HIBIYA, 3)
    const sent = walked.slice(0, 2)
    const duringFlight = walked.slice(2)

    const view = buildExplorationView({
      config: CONFIG,
      server: serverResponse(sent),
      unconfirmed: duringFlight,
    })

    expect(view.tiles.map((tile) => tile.tileKey)).toEqual(walked.map((tile) => tile.tileKey))
  })

  it('サーバーが知ったタイルは二重に並ばない', () => {
    const walked = tilesOfChome(HIBIYA, 3)

    const view = buildExplorationView({
      config: CONFIG,
      server: serverResponse(walked),
      // 応答が届いた直後は、同じキーが未確定側にも残っている
      unconfirmed: walked,
    })

    expect(view.tiles).toHaveLength(walked.length)
  })

  it('未確定分を含めて開放判定する（1枚欠けて町丁目が閉じない）', () => {
    const chome = chomeOfTile(tileOf(HIBIYA, CONFIG.tileSizeM).key, CONFIG.tileSizeM)
    expect(chome).toBeDefined()
    const needed = tilesNeededToUnlock(chome!, unlockConfigOf(CONFIG))

    const walked = tilesOfChome(HIBIYA, needed)
    const server = serverResponse(walked.slice(0, needed - 1))

    // 置き換えていた頃は、最後の1枚が応答に無いだけで町丁目がまるごと霧に戻った
    expect(buildExplorationView({ config: CONFIG, server, unconfirmed: [] }).unlockedAreas).toEqual(
      [],
    )
    const merged = buildExplorationView({
      config: CONFIG,
      server,
      unconfirmed: walked.slice(needed - 1),
    })
    expect(merged.unlockedAreas.map((area) => area.areaKey)).toEqual([chome?.code])
  })

  it('未確定分が無ければサーバーの集計をそのまま使う（打ち切りを消さない）', () => {
    const server = serverResponse(tilesOfChome(HIBIYA, 2), true)
    const view = buildExplorationView({ config: CONFIG, server, unconfirmed: [] })

    expect(view.summary).toBe(server.summary)
    expect(view.unlockedAreas).toBe(server.unlockedAreas)
  })

  it('数え直すときも打ち切りは引き継ぐ', () => {
    const walked = tilesOfChome(HIBIYA, 3)
    const view = buildExplorationView({
      config: CONFIG,
      server: serverResponse(walked.slice(0, 2), true),
      unconfirmed: walked.slice(2),
    })

    expect(view.summary?.truncated).toBe(true)
    expect(view.summary?.tileCount).toBe(3)
  })

  it('サーバー未取得でも、歩いた分だけで表示できる', () => {
    const view = buildExplorationView({
      config: CONFIG,
      server: undefined,
      unconfirmed: tilesOfChome(HIBIYA, 2),
    })

    expect(view.tiles).toHaveLength(2)
    expect(view.summary?.tileCount).toBe(2)
  })
})

describe('isInsideUnlockedArea', () => {
  const tileKey = tileOf(HIBIYA, CONFIG.tileSizeM).key
  const areaKey = chomeOfTile(tileKey, CONFIG.tileSizeM)?.code ?? ''

  it('開放済みの町丁目の中なら true（記録しない）', () => {
    expect(isInsideUnlockedArea(tileKey, CONFIG.tileSizeM, new Set([areaKey]))).toBe(true)
  })

  it('開放されていなければ false', () => {
    expect(isInsideUnlockedArea(tileKey, CONFIG.tileSizeM, new Set())).toBe(false)
    expect(isInsideUnlockedArea(tileKey, CONFIG.tileSizeM, new Set(['00000000000']))).toBe(false)
  })

  it('境界データの外は false（区画開放が起きない場所なので必ず記録する）', () => {
    const outside = tileOf(OUTSIDE, CONFIG.tileSizeM).key
    expect(isInsideUnlockedArea(outside, CONFIG.tileSizeM, new Set([areaKey]))).toBe(false)
  })
})
