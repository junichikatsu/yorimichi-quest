import { distanceMeters, offsetByMeters } from '@imanouchi/core'
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
import { ExplorationPanel } from './components/ExplorationPanel.js'
import { JoystickControl } from './components/JoystickControl.js'
import { DataCredits } from './components/DataCredits.js'
import { MapView } from './components/MapView.js'
import { SpotList } from './components/SpotList.js'
import { SpotPanel } from './components/SpotPanel.js'
import { StatusBar } from './components/StatusBar.js'
import { hasFinePointer, shouldOfferDebugMove } from './debug-move.js'
import { useExploration } from './hooks/useExploration.js'
import { useGeolocation } from './hooks/useGeolocation.js'
import {
  LiffError,
  clearReloginMark,
  forceRelogin,
  hasTriedRelogin,
  isInLineClient,
  loginAndGetIdToken,
} from './liff.js'

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
  const [spotsTruncated, setSpotsTruncated] = useState(false)
  const [selectedSpotId, setSelectedSpotId] = useState<SpotId | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [joystickClosed, setJoystickClosed] = useState(false)

  /**
   * ★ 同意していない間は位置情報を要求しない（FR-01-4）。
   * この 1 行が同意画面の意味を担保している。
   */
  const consented = user?.locationConsentGiven ?? false
  const geo = useGeolocation(consented)
  const exploration = useExploration(phase === 'ready' ? config?.exploration : undefined)

  /**
   * 現在地を歩いた記録として積む（FR-02-7）。
   *
   * ★ 送信はフックがまとめる。位置は数秒おきに届くが、同じタイルは積まれないので
   * 留まっている間は通信が起きない。
   */
  useEffect(() => {
    if (phase !== 'ready' || !geo.position) return
    exploration.track(geo.position)
  }, [phase, geo.position, exploration])

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
        // ここまで来たら取り直しは成功している。次回のために印を消す
        clearReloginMark()
        setPhase(result.user.locationConsentGiven ? 'ready' : 'consent')
      } catch (err) {
        if (cancelled) return

        /*
         * ★ IDトークンの期限切れは取り直せば直る。
         *
         * LIFF は**セッションが残っている間 isLoggedIn() が true を返す**ので、
         * 期限切れのIDトークンを送り続ける。ここで行き止まりにすると、
         * 「しばらく経つと開けなくなる」という形で詰まる（実際にそうなった）。
         *
         * ただし取り直すのは**一度だけ**。設定が壊れている場合は取り直しても
         * 直らず、リダイレクトが無限に続く。
         */
        if (isAuthExpired(err) && !hasTriedRelogin()) {
          setMessage('ログインを取り直しています…')
          try {
            forceRelogin()
            return
          } catch {
            // 取り直せない環境（sessionStorage が使えない等）はそのまま下へ
          }
        }

        setPhase('failed')
        if (err instanceof LiffError) {
          setMessage(LIFF_MESSAGES[err.reason] ?? 'ログインに失敗しました。')
        } else if (isAuthExpired(err)) {
          setMessage(
            'ログインの有効期限が切れました。取り直しても直らない場合は、LINE アプリからミニアプリを開いてください。',
          )
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
      setSpotsTruncated(response.truncated)
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

  /**
   * デモ用の移動操作を出すか（判定は debug-move.ts）。
   *
   * ★ LINE アプリ内では出さない。実利用者が触れる経路に位置を偽装できる操作を
   * 置いてはいけない。
   */
  const offerDebugMove =
    phase === 'ready' &&
    shouldOfferDebugMove({
      inLineClient: isInLineClient(),
      geoStatus: geo.status,
      hasFinePointer: hasFinePointer(),
      enabledByServer: config?.debugMoveEnabled ?? false,
    })

  /**
   * ジョイスティックで現在地を動かす。
   *
   * ★ 初期位置はエリアの中心（`AREA_CENTER`）にする。デモを想定している場所なので、
   * 撮影ルートが確定して中心を動かせば、ここも自動で追従する。
   */
  const handleJoystickMove = useCallback(
    (eastM: number, northM: number) => {
      const origin = geo.position ?? config?.area.center
      if (!origin) return
      geo.simulate(offsetByMeters(origin, eastM, northM))
    },
    [geo, config?.area.center],
  )

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
            exploredTiles={exploration.tiles}
            unlockedAreas={exploration.unlockedAreas}
            revealRadiusM={config.exploration.revealRadiusM}
          />
        ) : (
          <div className="map map--fallback">
            <p className="map__notice">
              地図のアクセストークンが未設定のため、一覧表示で動作しています。
            </p>
          </div>
        )}

        {offerDebugMove &&
          (joystickClosed ? (
            <button
              type="button"
              className="joystick-reopen"
              onClick={() => setJoystickClosed(false)}
            >
              デモ移動
            </button>
          ) : (
            <JoystickControl onMove={handleJoystickMove} onClose={() => setJoystickClosed(true)} />
          ))}

        <aside className="sidebar">
          {selectedSpot && (
            <SpotPanel spot={selectedSpot} onClose={() => setSelectedSpotId(undefined)} />
          )}

          <ExplorationPanel
            summary={exploration.summary}
            areaRadiusM={config?.exploration.areaRadiusM ?? 0}
            mapEnabled={canUseMap}
            position={geo.position}
            unlockedAreas={exploration.unlockedAreas}
          />

          <section className="panel" aria-label="近くのスポット">
            <h2 className="panel__title">近くのスポット</h2>
            {spotsTruncated && (
              <p className="panel__warn" role="status">
                件数が上限で打ち切られています。表示されていないスポットがあります（カテゴリごと欠けることがあります）。
              </p>
            )}
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
