import { tileOf } from '@map-checkin/core'
import type { ExplorationConfig, ExplorationSummary, ExploredTile } from '@map-checkin/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchExploration, postExploration } from '../api.js'
import type { Position } from './useGeolocation.js'

/**
 * 歩いたところ（探索済みタイル）の取得と記録。
 *
 * 位置情報は数秒おきに届くが、送信はまとめて間引く。判定はサーバー側と同じ `tileOf` で行い、
 * **すでに塗られたタイルは送らない**。同じ場所に留まっている間は通信が発生しない。
 */

/**
 * 送信をまとめる待ち時間。
 *
 * 同じタイルは積まれないので、待つほど 1 リクエストにまとまる件数が増えるだけで、
 * 情報が失われることはない。歩行なら 30 秒で数タイル、ジョイスティックで
 * 動かしても上限（maxPointsPerRequest）に収まる。
 *
 * 長く持つぶん、送る前にページを離れると未送信分が消える。
 * これは下の「離脱時のフラッシュ」で埋めている。
 */
const FLUSH_DELAY_MS = 30_000

export interface ExplorationState {
  tiles: ExploredTile[]
  summary: ExplorationSummary | undefined
  /** 現在地を記録キューへ積む。すでに塗られたタイルなら何もしない */
  track: (position: Position) => void
  /** デモ用：経路をまとめて即時記録する。新しく塗られたタイル数を返す */
  trackPath: (points: Position[]) => Promise<number>
  /** 直近の記録が失敗した理由。成功すると undefined に戻る */
  error: string | undefined
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : '探索エリアを記録できませんでした'
}

export function useExploration(config: ExplorationConfig | undefined): ExplorationState {
  const [tiles, setTiles] = useState<ExploredTile[]>([])
  const [summary, setSummary] = useState<ExplorationSummary | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  const knownKeysRef = useRef<Set<string>>(new Set())
  /** 未送信の座標。タイルキーで引けるようにして、同じタイルを二重に積まない */
  const pendingRef = useRef<Map<string, Position>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sendingRef = useRef(false)

  // サーバーが毎回タイル全件を返すので、丸ごと置き換えれば差分計算がいらない
  const apply = useCallback((next: ExploredTile[], nextSummary: ExplorationSummary) => {
    knownKeysRef.current = new Set(next.map((tile) => tile.tileKey))
    setTiles(next)
    setSummary(nextSummary)
  }, [])

  useEffect(() => {
    if (!config) return
    fetchExploration()
      .then((response) => apply(response.tiles, response.summary))
      .catch((err: unknown) => setError(messageOf(err)))
  }, [config, apply])

  const send = useCallback(
    async (points: Position[]): Promise<number> => {
      if (points.length === 0) return 0
      const response = await postExploration(points)
      apply(response.tiles, response.summary)
      return response.newTileCount
    },
    [apply],
  )

  // 送信後に自分を再スケジュールするため、型は明示する（自己参照だと推論が循環する）
  const flush: () => Promise<void> = useCallback(async () => {
    if (!config || sendingRef.current) return

    const limit = config.maxPointsPerRequest
    const queued = [...pendingRef.current.entries()].slice(0, limit)
    if (queued.length === 0) return
    for (const [key] of queued) pendingRef.current.delete(key)

    sendingRef.current = true
    try {
      await send(queued.map(([, position]) => position))
      setError(undefined)
    } catch (err: unknown) {
      // 送れなかった分は捨てる。歩き続ければ次のタイルで復帰するので、
      // 再送キューを抱えて肥大化させるより単純に落とす
      setError(messageOf(err))
    } finally {
      sendingRef.current = false
      // 上限や送信中で残った分があれば続けて送る
      if (pendingRef.current.size > 0 && timerRef.current === undefined) {
        timerRef.current = setTimeout(() => {
          timerRef.current = undefined
          void flush()
        }, FLUSH_DELAY_MS)
      }
    }
  }, [config, send])

  const track = useCallback(
    (position: Position) => {
      if (!config) return

      const key = tileOf(position, config.tileSizeM).key
      if (knownKeysRef.current.has(key) || pendingRef.current.has(key)) return

      pendingRef.current.set(key, position)
      if (timerRef.current !== undefined) return
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined
        void flush()
      }, FLUSH_DELAY_MS)
    },
    [config, flush],
  )

  const trackPath = useCallback(
    async (points: Position[]): Promise<number> => {
      if (!config) return 0

      const fresh = new Map<string, Position>()
      for (const point of points) {
        const key = tileOf(point, config.tileSizeM).key
        if (knownKeysRef.current.has(key)) continue
        fresh.set(key, point)
      }

      try {
        const added = await send([...fresh.values()].slice(0, config.maxPointsPerRequest))
        setError(undefined)
        return added
      } catch (err: unknown) {
        setError(messageOf(err))
        return 0
      }
    },
    [config, send],
  )

  /**
   * ページを離れる直前に、溜めている分を送る。
   *
   * 30 秒ぶん抱えている状態でタブを閉じられると、歩いた記録がまるごと消える。
   * `visibilitychange` は iOS Safari を含めて最も確実に発火するタイミングなので、
   * ここで送り出す。
   *
   * 完全な保証ではない（実際の unload では送信が打ち切られうる）。
   * 探索タイルは失っても歩き直せば復帰する情報なので、確実性より単純さを取っている。
   */
  useEffect(() => {
    const flushNow = (): void => {
      if (pendingRef.current.size === 0) return
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
      void flush()
    }

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') flushNow()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flushNow)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushNow)
    }
  }, [flush])

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) clearTimeout(timerRef.current)
    }
  }, [])

  return { tiles, summary, track, trackPath, error }
}
