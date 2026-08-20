import { distanceMeters } from '@imanouchi/core'
import type { ClientConfigResponse, SpotId, SpotWithDistance, UserView } from '@imanouchi/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  fetchClientConfig,
  fetchSpots,
  isAuthExpired,
  login,
  setLocationConsent,
  setToken,
} from './api.js'
import { ConsentGate } from './components/ConsentGate.js'
import { DataCredits } from './components/DataCredits.js'
import { MapView } from './components/MapView.js'
import { SpotList } from './components/SpotList.js'
import { SpotPanel } from './components/SpotPanel.js'
import { StatusBar } from './components/StatusBar.js'
import { useGeolocation } from './hooks/useGeolocation.js'
import { LiffError, loginAndGetIdToken } from './liff.js'

type Phase = 'booting' | 'logging-in' | 'consent' | 'ready' | 'failed'

/** ログインできない理由。原因ごとに出す案内を変える（同じ文言にすると自己解決できない） */
const LIFF_MESSAGES: Record<string, string> = {
  'sdk-missing': 'LINE の読み込みに失敗しました。通信状況を確認して開き直してください。',
  'no-liff-id': 'サーバー側の設定が未完了です（LIFF ID）。',
  'init-failed': 'LINE との連携を開始できませんでした。開き直してください。',
  'no-id-token': 'LINE からユーザー情報を取得できませんでした。LIFF の設定を確認してください。',
}

export function App(): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('booting')
  const [message, setMessage] = useState('')
  const [config, setConfig] = useState<ClientConfigResponse | undefined>(undefined)
  const [user, setUser] = useState<UserView | undefined>(undefined)
  const [spots, setSpots] = useState<SpotWithDistance[]>([])
  const [selectedSpotId, setSelectedSpotId] = useState<SpotId | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  /**
   * ★ 同意していない間は位置情報を要求しない（FR-01-4）。
   * この 1 行が同意画面の意味を担保している。
   */
  const consented = user?.locationConsentGiven ?? false
  const geo = useGeolocation(consented)

  /* ---------------- 起動 → 設定取得 → LINE ログイン ---------------- */

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await fetchClientConfig()
        if (cancelled) return
        setConfig(loaded)
        setPhase('logging-in')

        const idToken = await loginAndGetIdToken(loaded.liffId)
        if (cancelled) return

        const result = await login(idToken)
        if (cancelled) return

        setToken(result.token)
        setUser(result.user)
        setPhase(result.user.locationConsentGiven ? 'ready' : 'consent')
      } catch (err) {
        if (cancelled) return
        setPhase('failed')
        if (err instanceof LiffError) {
          setMessage(LIFF_MESSAGES[err.reason] ?? 'ログインに失敗しました。')
        } else if (err instanceof ApiError) {
          setMessage(err.message)
        } else {
          setMessage('起動に失敗しました。通信状況を確認してください。')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  /* ---------------- スポットの取得 ---------------- */

  const loadSpots = useCallback(async () => {
    try {
      // ★ 現在地を送らない。距離は手元で計算するので、サーバーに計算させる必要がない。
      // 送ると「位置が変わったら取り直す」設計に引きずられる。
      const response = await fetchSpots(undefined)
      setSpots(response.spots)
    } catch (err) {
      if (isAuthExpired(err)) {
        // 期限切れは再読み込みで復帰する。ここで無言に失敗させると原因が分からない
        setPhase('failed')
        setMessage('ログインの有効期限が切れました。開き直してください。')
        return
      }
      setMessage(err instanceof ApiError ? err.message : 'スポットの取得に失敗しました。')
    }
  }, [])

  /**
   * ★ 準備できたら1回だけ取得する。
   *
   * 移動のたびに取り直さない。エリア内の全件が返るので、距離は手元で計算し直せる。
   * 位置が変わるたびに叩くと、歩いている間ずっとリクエストが飛ぶ。
   */
  useEffect(() => {
    if (phase !== 'ready') return
    void loadSpots()
  }, [phase, loadSpots])

  /** 距離の付け直しは手元で行う（サーバーへは行かない） */
  const sortedSpots = useMemo(() => {
    if (!geo.position) return spots
    const here = geo.position
    return [...spots]
      .map((spot) => ({
        ...spot,
        distanceM: distanceMeters(here, spot),
      }))
      .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
  }, [spots, geo.position])

  const selectedSpot = sortedSpots.find((spot) => spot.spotId === selectedSpotId)

  const handleAgree = async (): Promise<void> => {
    setBusy(true)
    try {
      const response = await setLocationConsent(true)
      setUser(response.user)
      setPhase('ready')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : '同意の記録に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  /* ---------------- 表示 ---------------- */

  if (phase === 'booting' || phase === 'logging-in') {
    return (
      <div className="boot">
        <p>{phase === 'booting' ? '起動しています…' : 'LINE でログインしています…'}</p>
      </div>
    )
  }

  if (phase === 'failed') {
    return (
      <div className="boot boot--failed" role="alert">
        <p className="boot__title">開けませんでした</p>
        <p>{message}</p>
      </div>
    )
  }

  if (phase === 'consent') {
    return <ConsentGate displayName={user?.displayName ?? ''} busy={busy} onAgree={() => void handleAgree()} />
  }

  const canUseMap = config !== undefined && config.mapboxToken !== ''

  return (
    <div className="app">
      <StatusBar
        user={user}
        areaName={config?.area.name ?? ''}
        geoStatus={geo.status}
        spotCount={sortedSpots.length}
      />

      <main className="app__main">
        {canUseMap && config ? (
          <MapView
            token={config.mapboxToken}
            area={config.area}
            spots={sortedSpots}
            position={geo.position}
            selectedSpotId={selectedSpotId}
            onSelectSpot={setSelectedSpotId}
          />
        ) : (
          <div className="map map--fallback">
            <p className="map__notice">
              地図のアクセストークンが未設定のため、一覧表示で動作しています。
            </p>
          </div>
        )}

        <aside className="sidebar">
          {selectedSpot && (
            <SpotPanel spot={selectedSpot} onClose={() => setSelectedSpotId(undefined)} />
          )}

          <section className="panel" aria-label="近くのスポット">
            <h2 className="panel__title">近くのスポット</h2>
            <SpotList
              spots={sortedSpots}
              selectedSpotId={selectedSpotId}
              onSelectSpot={setSelectedSpotId}
            />
          </section>
        </aside>
      </main>

      {message !== '' && (
        <div className="toast" role="status">
          {message}
        </div>
      )}

      <footer className="app__footer">
        {config?.usesSampleData === true ? (
          <p>
            表示しているスポットは動作確認用の架空データで、実在の避難所指定や設備状況を表すものではありません。
          </p>
        ) : (
          <p>
            スポットは千代田区・港区の公開オープンデータです。属性の空欄は「設備が無い」ではなく「未記入」で、現地で確かめられる項目です。
          </p>
        )}
        <DataCredits sources={config?.dataSources ?? []} />
      </footer>
    </div>
  )
}
