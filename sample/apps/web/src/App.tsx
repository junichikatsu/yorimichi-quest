import type { ClientConfigResponse, MeResponse, SpotWithDistance } from '@yorimichi-sample/shared'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchClientConfig, fetchMe, fetchSpots, postCheckin } from './api.js'
import { HistoryPanel } from './components/HistoryPanel.js'
import { MapView } from './components/MapView.js'
import { SpotList } from './components/SpotList.js'
import { SpotPanel } from './components/SpotPanel.js'
import { StatusBar } from './components/StatusBar.js'
import { useGeolocation } from './hooks/useGeolocation.js'

interface Toast {
  kind: 'success' | 'error'
  message: string
}

export function App(): React.JSX.Element {
  const [config, setConfig] = useState<ClientConfigResponse | undefined>(undefined)
  const [spots, setSpots] = useState<SpotWithDistance[]>([])
  const [me, setMe] = useState<MeResponse | undefined>(undefined)
  const [selectedSpotId, setSelectedSpotId] = useState<string | undefined>(undefined)
  const [toast, setToast] = useState<Toast | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [fatalError, setFatalError] = useState<string | undefined>(undefined)

  const geo = useGeolocation()

  useEffect(() => {
    fetchClientConfig()
      .then(setConfig)
      .catch((err: unknown) => {
        setFatalError(err instanceof Error ? err.message : '設定を取得できませんでした')
      })
  }, [])

  const reload = useCallback(async () => {
    try {
      const [spotsResponse, meResponse] = await Promise.all([fetchSpots(geo.position), fetchMe()])
      setSpots(spotsResponse.spots)
      setMe(meResponse)
    } catch (err: unknown) {
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'データを取得できませんでした',
      })
    }
  }, [geo.position])

  useEffect(() => {
    if (!config) return
    void reload()
  }, [config, reload])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const selectedSpot = spots.find((spot) => spot.spotId === selectedSpotId)

  const handleCheckin = useCallback(async () => {
    if (!selectedSpot || !geo.position) return
    setBusy(true)
    try {
      const result = await postCheckin(selectedSpot.spotId, geo.position)
      const { base, multiplier, firstVisitBonus } = result.breakdown
      const bonusText = firstVisitBonus > 0 ? ` ＋初回${firstVisitBonus}pt` : ''
      setToast({
        kind: 'success',
        message: `+${result.pointsEarned}pt 獲得（${base}pt ×${multiplier}${bonusText}）`,
      })
      await reload()
    } catch (err: unknown) {
      const message =
        err instanceof ApiError && err.code === 'COOLDOWN'
          ? 'このスポットは時間をおいて再チェックインできます'
          : err instanceof Error
            ? err.message
            : 'チェックインに失敗しました'
      setToast({ kind: 'error', message })
    } finally {
      setBusy(false)
    }
  }, [selectedSpot, geo.position, reload])

  if (fatalError !== undefined) {
    return (
      <main className="fatal">
        <h1>読み込みに失敗しました</h1>
        <p>{fatalError}</p>
      </main>
    )
  }

  if (!config) {
    return <main className="loading">読み込み中…</main>
  }

  const canUseMap = config.mapboxToken !== '' && !config.mockMode

  return (
    <div className="app">
      <StatusBar me={me} geoStatus={geo.status} areaName={config.area.name} />

      <main className="app__main">
        {canUseMap ? (
          <MapView
            token={config.mapboxToken}
            area={config.area}
            spots={spots}
            position={geo.position}
            selectedSpotId={selectedSpotId}
            onSelectSpot={setSelectedSpotId}
          />
        ) : (
          <div className="map map--fallback">
            <p className="map__notice">
              Mapbox のアクセストークンが未設定のため、一覧表示で動作しています。
            </p>
            <SpotList spots={spots} selectedSpotId={selectedSpotId} onSelectSpot={setSelectedSpotId} />
          </div>
        )}

        <aside className="sidebar">
          {selectedSpot ? (
            <SpotPanel
              spot={selectedSpot}
              checkinRadiusM={config.checkinRadiusM}
              position={geo.position}
              busy={busy}
              onCheckin={() => void handleCheckin()}
              onSimulateHere={() => geo.simulate({ lat: selectedSpot.lat, lng: selectedSpot.lng })}
              onClose={() => setSelectedSpotId(undefined)}
            />
          ) : (
            <section className="panel panel--empty">
              <h2 className="panel__title">スポットを選んでください</h2>
              <p>
                {canUseMap
                  ? '地図のピンをタップすると詳細とチェックインが表示されます。'
                  : '一覧から選ぶと詳細とチェックインが表示されます。'}
              </p>
              <p className="panel__note">
                未開拓（×2〜×3）のスポットほど多くポイントを獲得できます。
              </p>
            </section>
          )}

          <HistoryPanel me={me} />
        </aside>
      </main>

      {toast && (
        <div className={`toast toast--${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}

      <footer className="app__footer">
        <p>
          サンプル実装です。表示しているスポットはデモ用の架空データで、実在の避難所指定や設備状況を表すものではありません。
        </p>
      </footer>
    </div>
  )
}
