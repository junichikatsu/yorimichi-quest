import { useEffect, useRef, useState } from 'react'

/**
 * 画面の自動ロックを抑止する（FR-02-11）。
 *
 * ★ これが無いと歩いた記録が残らない。画面がロックされると `watchPosition` は
 * 止まり、背面での測位は Web では不可能である（Service Worker から
 * `navigator.geolocation` は触れず、Geofencing API も実装が無い）。
 * つまり**ロックを防ぐことが、画面を見ずに歩くための前提**になる。
 *
 * ★ 実機で確認済み（LINE の WebView / 2026-08-21）。iOS・Android の両方で取得できた。
 * iOS は Safari 16.4 以降で対応している。
 *
 * ★ 解放されたら自分で取り直す必要がある。別アプリへ移る・画面を消すと
 * ブラウザ側が解放し、**戻ってきても自動では復帰しない**。
 */

interface WakeLockSentinelLike {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

function wakeLock(): WakeLockLike | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock
}

export interface WakeLockState {
  /** この端末が対応しているか */
  supported: boolean
  /** いま抑止できているか */
  held: boolean
}

export function useWakeLock(active: boolean): WakeLockState {
  const [held, setHeld] = useState(false)
  const sentinelRef = useRef<WakeLockSentinelLike | undefined>(undefined)
  const supported = wakeLock() !== undefined

  useEffect(() => {
    const api = wakeLock()
    if (!api) return

    // ★ 解放されたあとに request が返ってくることがある。その分は捨てる
    let cancelled = false

    const acquire = async (): Promise<void> => {
      if (sentinelRef.current && !sentinelRef.current.released) return

      try {
        const sentinel = await api.request('screen')
        if (cancelled) {
          void sentinel.release()
          return
        }

        sentinelRef.current = sentinel
        setHeld(true)
        sentinel.addEventListener('release', () => {
          sentinelRef.current = undefined
          setHeld(false)
        })
      } catch {
        // 電池残量が少ないときなど、端末側の事情で断られる。画面は消えるが歩行は続く
        setHeld(false)
      }
    }

    const release = (): void => {
      const sentinel = sentinelRef.current
      sentinelRef.current = undefined
      setHeld(false)
      if (sentinel && !sentinel.released) void sentinel.release()
    }

    if (!active) {
      release()
      return
    }

    void acquire()

    // 戻ってきたら取り直す。解放されたままだと以降ずっと画面が消える
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      release()
    }
  }, [active])

  return { supported, held }
}
