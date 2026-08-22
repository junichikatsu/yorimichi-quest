import { tileOf } from '@imanouchi/core'
import type {
  ExplorationConfig,
  ExplorationResponse,
  ExplorationSummary,
  ExploredTile,
  UnlockedAreaBounds,
} from '@imanouchi/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchExploration, postExploration } from '../api.js'
import { buildExplorationView, isInsideUnlockedArea } from '../exploration-view.js'
import { loadGuestTiles, saveGuestTiles } from '../guest-store.js'
import type { Position } from './useGeolocation.js'

/**
 * 歩いたところ（探索済みタイル）の取得と記録。
 *
 * 位置情報は数秒おきに届くが、送信はまとめて間引く。判定はサーバー側と同じ `tileOf` で行い、
 * **すでに塗られたタイルは送らない**。同じ場所に留まっている間は通信が発生しない。
 *
 * 状態は「サーバーの確定分」と「未確定分（未送信・送信中）」を分けて持ち、
 * 画面へ出すときに合わせる（`exploration-view.ts`）。サーバーの応答で置き換えると、
 * 送信中に歩いた分が消えて**晴れたところが霧に戻る**。
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
  /** 一定割合を歩いて全面が開放された区画 */
  unlockedAreas: UnlockedAreaBounds[]
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

/**
 * 記録の置き場。
 *
 * - `server`: LINE ログイン済み。サーバーへ送って残す
 * - `local`: おためし利用。**端末の中だけ**に置く（サーバーへ送らない・送れない）
 */
export type ExplorationStorage = 'server' | 'local'

export function useExploration(
  config: ExplorationConfig | undefined,
  storage: ExplorationStorage = 'server',
): ExplorationState {
  const [tiles, setTiles] = useState<ExploredTile[]>([])
  const [areas, setAreas] = useState<UnlockedAreaBounds[]>([])
  const [summary, setSummary] = useState<ExplorationSummary | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  /** サーバーが返した確定分。ここだけがサーバー由来の真実 */
  const serverRef = useRef<ExplorationResponse | undefined>(undefined)
  /** 応答を待たずに霧を晴らした分。サーバーが知るまで手元で持ち続ける */
  const unconfirmedRef = useRef<Map<string, ExploredTile>>(new Map())
  /** 歩いたと分かっているタイル（確定＋未確定）。同じタイルを二重に積まない索引 */
  const knownKeysRef = useRef<Set<string>>(new Set())
  /** 開放済み町丁目のコード。中のタイルは記録しない */
  const unlockedKeysRef = useRef<Set<string>>(new Set())
  /** 未送信の座標。タイルキーで引けるようにして、同じタイルを二重に積まない */
  const pendingRef = useRef<Map<string, Position>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sendingRef = useRef(false)

  /**
   * 確定分と未確定分を合わせて画面へ出す。
   *
   * state を updater 内で読まずに ref から組み立てる（StrictMode の二重実行で崩れる）。
   */
  const publish = useCallback(() => {
    if (!config) return

    // サーバーが知ったタイルは未確定から外す。抱え続けても意味がない
    for (const tile of serverRef.current?.tiles ?? []) unconfirmedRef.current.delete(tile.tileKey)

    const view = buildExplorationView({
      config,
      server: serverRef.current,
      unconfirmed: [...unconfirmedRef.current.values()],
    })

    knownKeysRef.current = new Set(view.tiles.map((tile) => tile.tileKey))
    unlockedKeysRef.current = new Set(view.unlockedAreas.map((area) => area.areaKey))
    setTiles(view.tiles)
    setAreas(view.unlockedAreas)
    setSummary(view.summary)
  }, [config])

  const applyServer = useCallback(
    (response: ExplorationResponse) => {
      serverRef.current = response
      publish()
    },
    [publish],
  )

  useEffect(() => {
    if (!config) return

    /*
     * おためしは端末から読む。
     * ★ サーバーへは問い合わせない。おためしのセッションでは 403 になる経路であり、
     * 叩けば画面にエラーが出るだけである。
     */
    if (storage === 'local') {
      for (const tile of loadGuestTiles()) unconfirmedRef.current.set(tile.tileKey, tile)
      publish()
      return
    }

    fetchExploration()
      .then((response) => {
        // ★ 初回読み込み専用。記録の応答が先に届いていたらこちらが古いので捨てる
        if (serverRef.current) return
        applyServer(response)
      })
      .catch((err: unknown) => setError(messageOf(err)))
  }, [config, storage, applyServer, publish])

  // 送信後に自分を再スケジュールするため、型は明示する（自己参照だと推論が循環する）
  const flush: () => Promise<void> = useCallback(async () => {
    if (!config || sendingRef.current) return

    const limit = config.maxPointsPerRequest
    const queued = [...pendingRef.current.entries()].slice(0, limit)
    if (queued.length === 0) return
    for (const [key] of queued) pendingRef.current.delete(key)

    /*
     * おためしは端末へ書く。
     * ★ 未確定のまま持ち続ける（サーバーが確定させることは無い）。
     * 表示は `buildExplorationView` が未確定分だけで組み立てられるので、これで足りる。
     */
    if (storage === 'local') {
      saveGuestTiles([...unconfirmedRef.current.values()])
      return
    }

    sendingRef.current = true
    try {
      const response = await postExploration(queued.map(([, position]) => position))
      /*
       * 送り切ったキーは未確定から外す。
       *
       * 応答に無いキーは**サーバーが意図的に書かなかった**もの（開放済み町丁目・保存上限）で、
       * 待っても届かない。抱え続けると未確定がいつまでも減らない。
       */
      for (const [key] of queued) unconfirmedRef.current.delete(key)
      applyServer(response)
      setError(undefined)
    } catch (err: unknown) {
      /*
       * ★ 送れなかった分はキューへ戻す。
       *
       * 捨てると、キーが「歩いた」側に残るので**二度と送られない**タイルになる
       * （霧は晴れたままなのに開き直すと消えている、という形で出た）。
       * 積まれるのはタイル単位なので、歩いた距離ぶんしか増えない。
       */
      for (const [key, position] of queued) {
        if (!pendingRef.current.has(key)) pendingRef.current.set(key, position)
      }
      setError(messageOf(err))
    } finally {
      sendingRef.current = false
      // 上限・送信中・失敗で残った分があれば続けて送る
      if (pendingRef.current.size > 0 && timerRef.current === undefined) {
        timerRef.current = setTimeout(() => {
          timerRef.current = undefined
          void flush()
        }, FLUSH_DELAY_MS)
      }
    }
  }, [config, storage, applyServer])

  const track = useCallback(
    (position: Position) => {
      if (!config) return

      const tile = tileOf(position, config.tileSizeM)
      const key = tile.key
      if (knownKeysRef.current.has(key) || pendingRef.current.has(key)) return
      // 開放済みの町丁目の中は記録しない（表示も数値も変わらないため）
      if (isInsideUnlockedArea(key, config.tileSizeM, unlockedKeysRef.current)) return

      pendingRef.current.set(key, position)

      // 先に見た目へ反映する。サーバーの応答は最大 30 秒後なので、待つと霧が遅れて晴れる
      unconfirmedRef.current.set(key, {
        tileKey: key,
        lat: tile.center.lat,
        lng: tile.center.lng,
        firstSeenAt: new Date().toISOString(),
      })
      publish()

      if (timerRef.current !== undefined) return
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined
        void flush()
      }, FLUSH_DELAY_MS)
    },
    [config, flush, publish],
  )

  const trackPath = useCallback(
    async (points: Position[]): Promise<number> => {
      if (!config) return 0
      // おためしでは即時送信の経路を使わない（track と flush で端末へ残る）
      if (storage === 'local') return 0

      const fresh = new Map<string, Position>()
      for (const point of points) {
        const key = tileOf(point, config.tileSizeM).key
        if (knownKeysRef.current.has(key)) continue
        if (isInsideUnlockedArea(key, config.tileSizeM, unlockedKeysRef.current)) continue
        fresh.set(key, point)
      }
      if (fresh.size === 0) return 0

      try {
        const response = await postExploration(
          [...fresh.values()].slice(0, config.maxPointsPerRequest),
        )
        applyServer(response)
        setError(undefined)
        return response.newTileCount
      } catch (err: unknown) {
        setError(messageOf(err))
        return 0
      }
    },
    [config, storage, applyServer],
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

  return { tiles, unlockedAreas: areas, summary, track, trackPath, error }
}
