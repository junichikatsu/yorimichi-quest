import { useEffect, useState } from 'react'

export interface Position {
  lat: number
  lng: number
}

export type GeolocationStatus = 'idle' | 'watching' | 'denied' | 'unavailable'

export interface GeolocationState {
  position: Position | undefined
  status: GeolocationStatus
  accuracyM: number | undefined
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

  return { position, status, accuracyM }
}
