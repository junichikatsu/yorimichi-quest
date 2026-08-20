import { useCallback, useEffect, useState } from 'react'

export interface Position {
  lat: number
  lng: number
}

export type GeolocationStatus = 'idle' | 'watching' | 'denied' | 'unavailable' | 'simulated'

export interface GeolocationState {
  position: Position | undefined
  status: GeolocationStatus
  accuracyM: number | undefined
  /**
   * 現在地を模擬位置で上書きする（デモ用）。
   *
   * ★ undefined を渡すと実際の測位へ戻る。模擬中は測位の結果を無視するので、
   * 位置情報が有効な PC でもジョイスティックで動かせる。
   */
  simulate: (position: Position | undefined) => void
}

/**
 * 現在地の取得（FR-02-1）。
 *
 * ★ `enabled` が false の間は**ブラウザの位置情報 API を呼ばない**。
 * 同意画面（FR-01-4）で同意を得る前に呼ぶと、OS の許可ダイアログが先に出て、
 * 「何のために使うのか」を説明する前に判断させることになる。
 */
export function useGeolocation(enabled: boolean): GeolocationState {
  const [position, setPosition] = useState<Position | undefined>(undefined)
  const [accuracyM, setAccuracyM] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const [simulated, setSimulated] = useState<Position | undefined>(undefined)

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude })
        setAccuracyM(result.coords.accuracy)
        setStatus('watching')
      },
      () => {
        // 拒否と取得失敗を区別しない。ユーザーから見れば「使えない」で同じ
        setStatus('denied')
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled])

  const simulate = useCallback((next: Position | undefined) => {
    setSimulated(next)
  }, [])

  // 模擬位置があればそれを優先する。実測は裏で続くが表には出さない
  if (simulated) {
    return { position: simulated, status: 'simulated', accuracyM: 0, simulate }
  }
  return { position, status, accuracyM, simulate }
}
