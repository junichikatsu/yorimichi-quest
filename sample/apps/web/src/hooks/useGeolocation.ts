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
  /** デモ用に現在地を上書きする（実際に現地へ行けない場面での確認用） */
  simulate: (position: Position | undefined) => void
}

export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<Position | undefined>(undefined)
  const [accuracyM, setAccuracyM] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const [simulated, setSimulated] = useState<Position | undefined>(undefined)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude })
        setAccuracyM(result.coords.accuracy)
        setStatus((current) => (current === 'simulated' ? current : 'watching'))
      },
      () => {
        setStatus((current) => (current === 'simulated' ? current : 'denied'))
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const simulate = useCallback((next: Position | undefined) => {
    setSimulated(next)
    setStatus(next ? 'simulated' : 'watching')
  }, [])

  return {
    position: simulated ?? position,
    status: simulated ? 'simulated' : status,
    accuracyM: simulated ? 0 : accuracyM,
    simulate,
  }
}
