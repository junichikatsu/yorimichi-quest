import { distanceMeters, offsetByMeters } from '@imanouchi/core'
import type {
  Avatar,
  ClientConfigResponse,
  SpotId,
  SpotWithDistance,
  UserView,
} from '@imanouchi/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  fetchClientConfig,
  fetchSpots,
  guestLogin,
  isAuthExpired,
  login,
  saveAvatar,
  setLocationConsent,
  setToken,
} from './api.js'
import { AvatarCreator } from './components/AvatarCreator.js'
import { ConsentGate } from './components/ConsentGate.js'
import { EmergencyBanner } from './components/EmergencyBanner.js'
import { EmergencyPanel } from './components/EmergencyPanel.js'
import { ExplorationPanel } from './components/ExplorationPanel.js'
import { JoystickControl } from './components/JoystickControl.js'
import { DataCredits } from './components/DataCredits.js'
import { MapView } from './components/MapView.js'
import { SpotList } from './components/SpotList.js'
import { SpotPanel } from './components/SpotPanel.js'
import { StartGate } from './components/StartGate.js'
import { StatusBar } from './components/StatusBar.js'
import { WalkGuard } from './components/WalkGuard.js'
import { hasFinePointer, shouldOfferDebugMove } from './debug-move.js'
import { clearGuestData, loadGuestConsent, saveGuestConsent } from './guest-store.js'
import { canPlaySound, enableSound, notifyAreaUnlocked, notifyWalkGuard } from './feedback.js'
import { useExploration } from './hooks/useExploration.js'
import { useGeolocation } from './hooks/useGeolocation.js'
import { useWakeLock } from './hooks/useWakeLock.js'
import { WALK_STALE_MS, initialWalkTracker, speedKmh, trackWalk } from './walking.js'
import {
  LiffError,
  clearReloginMark,
  forceRelogin,
  hasTriedRelogin,
  isInLineClient,
  loginAndGetIdToken,
} from './liff.js'

type Phase = 'booting' | 'start' | 'logging-in' | 'consent' | 'ready' | 'failed'

/** 使い方。おためしは読み取り専用で、記録は端末の中だけに置く */
type Mode = 'line' | 'guest'

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
  /** LINE ログインか、おためしか。おためしは記録を端末の中だけに置く */
  const [mode, setMode] = useState<Mode>('line')
  const [user, setUser] = useState<UserView | undefined>(undefined)
  const [spots, setSpots] = useState<SpotWithDistance[]>([])
  const [spotsTruncated, setSpotsTruncated] = useState(false)
  const [selectedSpotId, setSelectedSpotId] = useState<SpotId | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [joystickClosed, setJoystickClosed] = useState(false)
  const [creatorOpen, setCreatorOpen] = useState(false)
  /**
   * デモ用の移動操作を一度でも出したか。
   *
   * ★ 出すきっかけ（測位の状況）は途中で変わる。`watchPosition` は最初に
   * エラーを返してから後で成功することがあり、**操作していないのに消える**。
   * 一度出したら出し続けるために覚えておく。
   */
  const [debugMoveOffered, setDebugMoveOffered] = useState(false)

  /**
   * 散歩中（画面を見ずに歩ける状態）か。
   *
   * ★ 自動では入れない。音の許可も画面ロックの抑止も、端末の決まりで
   * **ユーザー操作の中でしか始められない**。
   */
  const [walkStarted, setWalkStarted] = useState(false)
  const [soundReady, setSoundReady] = useState(false)
  const [walk, setWalk] = useState(initialWalkTracker)
  /** 歩行中の覆いを本人が閉じたか。立ち止まるまで出し直さない */
  const [guardDismissed, setGuardDismissed] = useState(false)

  /**
   * 有事モード（FR-08）。
   *
   * ★ 画面遷移ではなく状態にする（FR-08-8）。地図を作り直さないので、
   * 切り替えても中心と縮尺が保たれる。
   */
  const [emergency, setEmergency] = useState(false)
  /** バリアフリーの記載があるものだけに絞るか（FR-08-4） */
  const [accessibleOnly, setAccessibleOnly] = useState(false)

  /**
   * ★ 同意していない間は位置情報を要求しない（FR-01-4）。
   * この 1 行が同意画面の意味を担保している。
   */
  const consented = user?.locationConsentGiven ?? false
  const geo = useGeolocation(consented)
  const exploration = useExploration(
    phase === 'ready' ? config?.exploration : undefined,
    mode === 'guest' ? 'local' : 'server',
  )
  const wakeLock = useWakeLock(walkStarted)

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

  /* ---------------- 歩行中モード（FR-02-9〜11・NFR-14） ---------------- */

  /**
   * 歩いている最中かを測位から判定する。
   *
   * ★ 模擬位置（デモ移動）では判定しない。ジョイスティックは一瞬で数十m動くため
   * 常に「歩行中」になり、**デモの最中に画面が覆われる**。
   */
  useEffect(() => {
    if (!walkStarted || !geo.position || geo.status === 'simulated') return
    const at = Date.now()
    const position = geo.position
    setWalk((prev) => trackWalk(prev, { ...position, at }))
  }, [walkStarted, geo.position, geo.status])

  /*
   * ★ 模擬位置のあいだは覆わない。
   * 判定側でも弾いているが、実測で歩いたあとにジョイスティックへ切り替えると
   * 判定が更新されず `walking` が真のまま残る。**表示側でも弾く。**
   */
  const walkGuardVisible =
    walkStarted && walk.walking && !guardDismissed && geo.status !== 'simulated'

  // 立ち止まったら覆いを出し直せるようにする（閉じたまま歩き続けられては意味がない）
  useEffect(() => {
    if (!walk.walking) setGuardDismissed(false)
  }, [walk.walking])

  /**
   * 測位が途切れたら歩行中を解除する。
   *
   * ★ `watchPosition` は位置が変わらないと通知しない端末がある。立ち止まった瞬間に
   * 更新が止まるため、これが無いと**覆いが出たまま**になる。
   */
  const lastSampleAt = walk.anchor?.at
  useEffect(() => {
    if (!walkStarted || !walk.walking) return
    const timer = setTimeout(() => {
      setWalk((prev) => ({ ...prev, walking: false, speedMps: 0 }))
    }, WALK_STALE_MS)
    return () => clearTimeout(timer)
  }, [walkStarted, walk.walking, lastSampleAt])

  // 覆いの出入りを音で知らせる。画面を見ていないので、切り替わりが分からない
  const guardShownRef = useRef(false)
  useEffect(() => {
    if (guardShownRef.current === walkGuardVisible) return
    guardShownRef.current = walkGuardVisible
    if (walkStarted) notifyWalkGuard(walkGuardVisible)
  }, [walkGuardVisible, walkStarted])

  /**
   * 町丁目が開いたら音で知らせる（FR-02-10）。
   *
   * ★ 画面ではなく音で出すことが要件である。画面にしか出さないなら、
   * 進捗を見るために歩きながら画面を見ることになる。
   */
  const unlockedBaselineRef = useRef(0)
  useEffect(() => {
    const count = exploration.unlockedAreas.length

    /*
     * ★ 散歩していない間は基準を追従させるだけで鳴らさない。
     * 起動直後の読み込みでは**前回までに開けた町丁目がまとめて届く**ため、
     * 増分をそのまま知らせると、歩いていないのに鳴る。
     */
    if (!walkStarted) {
      unlockedBaselineRef.current = count
      return
    }

    if (count <= unlockedBaselineRef.current) return
    unlockedBaselineRef.current = count
    notifyAreaUnlocked()
  }, [walkStarted, exploration.unlockedAreas])

  const handleStartWalk = useCallback(() => {
    // ★ ユーザー操作の中で解錠する。ここを外すと iOS では以降ずっと無音になる
    void enableSound().then(setSoundReady)
    setWalk(initialWalkTracker())
    setGuardDismissed(false)
    setWalkStarted(true)
  }, [])

  const handleStopWalk = useCallback(() => {
    setWalkStarted(false)
    setGuardDismissed(false)
    setWalk(initialWalkTracker())
  }, [])

  /**
   * 有事モードの切替（FR-08-1）。
   *
   * ★ 有事へ入るときは散歩（歩行中モード）を必ず終える。
   * 有事に画面を覆って地図を見せないのは**それ自体が危険**であり、
   * 探索の進捗も非表示になる（FR-08-2）ので、続ける意味が無い。
   */
  const handleToggleEmergency = useCallback(() => {
    setEmergency((current) => {
      if (!current) handleStopWalk()
      return !current
    })
  }, [handleStopWalk])

  /* ---------------- 起動 → 設定取得 → LINE ログイン ---------------- */

  /**
   * LINE ログインを実行する。
   *
   * ★ LINE アプリの中では自動で走らせる。外（PC・スマホのブラウザ）では
   * 選択画面を出してから走らせる。**リダイレクトを伴うため、外で自動実行すると
   * 開いた瞬間に LINE のログイン画面へ飛ばされる。**
   */
  /**
   * ログインの失敗を画面へ落とす。
   *
   * ★ LINE アプリの中と外で経路が2つある（自動と選択画面）。
   * 分けて書くと、片方だけ直して**もう片方が行き止まりのまま**になる。
   */
  const handleLoginError = useCallback((err: unknown, guestAvailable: boolean) => {
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

    /*
     * ★ おためしが使えるなら行き止まりにしない。
     * LINE ログインが通らない環境でも、地図までは触れるほうがよい。
     */
    setPhase(guestAvailable ? 'start' : 'failed')
  }, [])

  /**
   * LINE ログインを実行する。
   *
   * ★ LINE アプリの中では自動で走らせる。外（PC・スマホのブラウザ）では
   * 選択画面を出してから走らせる。**リダイレクトを伴うため、外で自動実行すると
   * 開いた瞬間に LINE のログイン画面へ飛ばされる。**
   */
  const runLineLogin = useCallback(
    async (loaded: ClientConfigResponse) => {
      setMode('line')
      setPhase('logging-in')
      setMessage('')

      try {
        const idToken = await loginAndGetIdToken(loaded.liffId)
        const result = await login(idToken)

        setToken(result.token)
        setUser(result.user)
        // ここまで来たら取り直しは成功している。次回のために印を消す
        clearReloginMark()
        setPhase(result.user.locationConsentGiven ? 'ready' : 'consent')
      } catch (err) {
        handleLoginError(err, loaded.guestModeEnabled && !isInLineClient())
      }
    },
    [handleLoginError],
  )

  /**
   * おためしを始める（LINE ログインなし）。
   *
   * ★ 同意は端末の中だけで持つ。サーバーへ送る経路が無い（403 になる）。
   */
  const startGuest = useCallback(async () => {
    setBusy(true)
    try {
      const result = await guestLogin()
      setToken(result.token)
      setMode('guest')

      const agreed = loadGuestConsent()
      setUser({ ...result.user, locationConsentGiven: agreed })
      setPhase(agreed ? 'ready' : 'consent')
      setMessage('')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'おためしを開始できませんでした。')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await fetchClientConfig()
        if (cancelled) return
        setConfig(loaded)

        /*
         * ★ LINE の外では選ばせる。
         * ここで自動的にログインへ進むと、PC で開いた人は**何も見ないうちに**
         * LINE のログイン画面へリダイレクトされる。
         */
        if (!isInLineClient()) {
          setPhase('start')
          return
        }

        await runLineLogin(loaded)
      } catch (err) {
        if (cancelled) return
        // 設定の取得そのものが失敗した場合。おためしにも入れない
        setPhase('failed')
        setMessage(
          err instanceof ApiError ? err.message : '起動に失敗しました。通信状況を確認してください。',
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [runLineLogin])

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
      alreadyOffered: debugMoveOffered,
    })

  // 出したことを覚える。以降はきっかけが消えても出し続ける
  useEffect(() => {
    if (offerDebugMove) setDebugMoveOffered(true)
  }, [offerDebugMove])

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

  /** キャラクターの見た目を保存する（FR-01-6） */
  const handleSaveAvatar = async (avatar: Avatar): Promise<void> => {
    // おためしは保存できない。画面の中だけで見た目を変える
    if (mode === 'guest') {
      setUser((current) => (current ? { ...current, avatar } : current))
      setCreatorOpen(false)
      return
    }

    setBusy(true)
    try {
      const response = await saveAvatar(avatar)
      setUser(response.user)
      setCreatorOpen(false)
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : '見た目を保存できませんでした。')
    } finally {
      setBusy(false)
    }
  }

  const handleAgree = async (): Promise<void> => {
    /*
     * ★ おためしはサーバーへ同意を送れない（403 になる経路である）。
     * 端末の中だけに置く。次に開いたときに聞き直さないためだけの記録で、
     * サーバーは「誰が同意したか」を一切持たない。
     */
    if (mode === 'guest') {
      saveGuestConsent(true)
      setUser((current) => (current ? { ...current, locationConsentGiven: true } : current))
      setPhase('ready')
      return
    }

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

  /** おためしの記録を消して選択画面へ戻す */
  const handleResetGuest = useCallback(() => {
    clearGuestData()
    window.location.reload()
  }, [])

  /* ---------------- 表示 ---------------- */

  if (phase === 'booting' || phase === 'logging-in') {
    return (
      <div className="boot">
        <p>{phase === 'booting' ? '起動しています…' : 'LINE でログインしています…'}</p>
      </div>
    )
  }

  if (phase === 'start') {
    return (
      <StartGate
        guestAvailable={config?.guestModeEnabled ?? false}
        busy={busy}
        onLineLogin={() => {
          if (config) void runLineLogin(config)
        }}
        onGuest={() => void startGuest()}
        message={message}
      />
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
    /* ★ 配色は差分だけを変える。要素の並びは平時と同じに保つ（FR-08-7） */
    <div className={emergency ? 'app app--emergency' : 'app'}>
      <StatusBar
        user={user}
        areaName={config?.area.name ?? ''}
        geoStatus={geo.status}
        spotCount={sortedSpots.length}
        onOpenCreator={() => setCreatorOpen((open) => !open)}
        emergencyAvailable={config?.emergencyDemoEnabled ?? false}
        emergency={emergency}
        onToggleEmergency={handleToggleEmergency}
      />

      {emergency && <EmergencyBanner onExit={handleToggleEmergency} />}

      {/*
        ★ おためしであることを隠さない。
        記録がサーバーに残らないことを知らないまま歩かせてはいけない。
        LINE ログインへ移っても記録は引き継げないので、それも先に書く。
      */}
      {mode === 'guest' && (
        <div className="guestbar" role="status">
          <p className="guestbar__text">
            <strong>おためし中</strong>（LINE ログインなし）。歩いた記録は
            <strong>この端末の中だけ</strong>に残ります。ログインしても引き継げません。
          </p>
          <button type="button" className="guestbar__reset" onClick={handleResetGuest}>
            記録を消してやり直す
          </button>
        </div>
      )}

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
            avatar={user?.avatar}
            emergency={emergency}
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
            <JoystickControl
              onMove={handleJoystickMove}
              onClose={() => setJoystickClosed(true)}
              onReset={() => geo.simulate(undefined)}
              simulating={geo.status === 'simulated'}
            />
          ))}

        <aside className="sidebar">
          {creatorOpen && user && (
            <AvatarCreator
              avatar={user.avatar}
              busy={busy}
              onSave={(avatar) => void handleSaveAvatar(avatar)}
              onClose={() => setCreatorOpen(false)}
            />
          )}

          {selectedSpot && (
            <SpotPanel spot={selectedSpot} onClose={() => setSelectedSpotId(undefined)} />
          )}

          {/*
            ★ 有事モードではゲーム要素（探索率・散歩）を出さない（FR-08-2）。
            代わりにライフラインを出す。押したときの挙動は平時と同じ（FR-08-7）。
          */}
          {emergency ? (
            <EmergencyPanel
              spots={sortedSpots}
              selectedSpotId={selectedSpotId}
              onSelectSpot={setSelectedSpotId}
              accessibleOnly={accessibleOnly}
              onToggleAccessibleOnly={setAccessibleOnly}
              hasPosition={geo.position !== undefined}
            />
          ) : (
            <>
              <ExplorationPanel
                summary={exploration.summary}
                areaRadiusM={config?.exploration.areaRadiusM ?? 0}
                mapEnabled={canUseMap}
                position={geo.position}
                unlockedAreas={exploration.unlockedAreas}
                walkStarted={walkStarted}
                soundReady={soundReady}
                wakeLockHeld={wakeLock.held}
                wakeLockSupported={wakeLock.supported}
                onStartWalk={handleStartWalk}
                onStopWalk={handleStopWalk}
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
            </>
          )}
        </aside>
      </main>

      {/*
        ★ 覆いは app の直下に置く。地図やサイドバーの内側に入れると、
        親の overflow やスタッキング文脈に閉じ込められて画面全体を覆えない。
      */}
      {walkGuardVisible && (
        <WalkGuard
          speedKmh={speedKmh(walk)}
          unlockedCount={exploration.unlockedAreas.length}
          soundReady={soundReady && canPlaySound()}
          onDismiss={() => setGuardDismissed(true)}
        />
      )}

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
