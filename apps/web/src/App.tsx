import { distanceMeters, offsetByMeters } from '@imanouchi/core'
import type {
  Avatar,
  CardsResponse,
  CardView,
  CheckinResponse,
  ClientConfigResponse,
  QuizAnswerResponse,
  QuizResponse,
  SpotId,
  SpotWithDistance,
  UserView,
} from '@imanouchi/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  answerQuiz,
  ApiError,
  checkin,
  fetchCards,
  fetchClientConfig,
  fetchProgress,
  fetchQuiz,
  fetchSpots,
  guestLogin,
  isAuthExpired,
  login,
  saveAvatar,
  setLocationConsent,
  setToken,
} from './api.js'
import { AvatarCreator } from './components/AvatarCreator.js'
import { CardPanel } from './components/CardPanel.js'
import { CardReveal } from './components/CardReveal.js'
import { CheckinBurst } from './components/CheckinBurst.js'
import { ConsentGate } from './components/ConsentGate.js'
import { EmergencyBanner } from './components/EmergencyBanner.js'
import { EmergencyPanel } from './components/EmergencyPanel.js'
import { ExplorationPanel } from './components/ExplorationPanel.js'
import { JoystickControl } from './components/JoystickControl.js'
import { DataCredits } from './components/DataCredits.js'
import { MapView } from './components/MapView.js'
import { QuizPanel } from './components/QuizPanel.js'
import { SpotList } from './components/SpotList.js'
import { SpotPanel } from './components/SpotPanel.js'
import { StartGate } from './components/StartGate.js'
import { StatusBar } from './components/StatusBar.js'
import { WalkGuard } from './components/WalkGuard.js'
import { NO_PROGRESS, progressFromStored, type SpotProgress } from './checkin-view.js'
import { hasFinePointer, shouldOfferDebugMove } from './debug-move.js'
import { gameElements } from './emergency.js'
import {
  clearGuestData,
  EMPTY_GUEST_PROGRESS,
  loadGuestConsent,
  loadGuestProgress,
  saveGuestConsent,
  saveGuestProgress,
  type GuestProgress,
} from './guest-store.js'
import {
  canPlaySound,
  enableSound,
  notifyAreaUnlocked,
  notifyCheckin,
  notifyQuizResult,
  notifyWalkGuard,
} from './feedback.js'
import { useExploration } from './hooks/useExploration.js'
import { useGeolocation } from './hooks/useGeolocation.js'
import { useWakeLock } from './hooks/useWakeLock.js'
import { shouldOfferStartChoice } from './start-mode.js'
import { WALK_STALE_MS, initialWalkTracker, speedKmh, trackWalk } from './walking.js'
import {
  LiffError,
  clearReloginMark,
  forceRelogin,
  hasTriedRelogin,
  isInLineClient,
  isLiffLoggedIn,
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

  /* ---------------- チェックインとクイズ（FR-03・FR-04） ---------------- */

  /**
   * スポットごとの進み（LINE ログイン時）。
   *
   * ★ サーバーの応答で分かったぶんだけを持つ。起動時にまとめて取得しない
   * （スポットは数百件あり、全件ぶんの状態を引くとアクセス数が跳ねる）。
   * 押せるかどうかの最終判定はサーバーが行うので、手元が空でも破綻しない。
   */
  const [serverProgress, setServerProgress] = useState<Record<string, SpotProgress>>({})

  /**
   * おためしの進み（端末の中だけ）。
   *
   * ★ サーバーへは書けないので、ポイントも再チェックイン制限もここで持つ。
   * 保存の形（前回時刻）をそのまま持ち、待ち時間の計算は表示のときに行う。
   */
  const [guestProgress, setGuestProgress] = useState<GuestProgress>(EMPTY_GUEST_PROGRESS)

  /** チェックインの演出（FR-03-2）。数秒で消える */
  const [burst, setBurst] = useState<CheckinResponse | undefined>(undefined)
  /**
   * カード（FR-14）。
   *
   * ★ 一覧は開いたときに取りに行く（起動時には引かない）。カードは歩いている間に
   * 増えないので、開くたびに最新を取れば足りる。
   */
  const [cards, setCards] = useState<CardsResponse | undefined>(undefined)
  const [cardsOpen, setCardsOpen] = useState(false)
  /** 手に入れたカードの演出（FR-14-8）。空なら出さない */
  const [revealCards, setRevealCards] = useState<CardView[]>([])

  /** 開いているクイズと、その回答結果（FR-04） */
  const [quiz, setQuiz] = useState<{ spotId: SpotId; response: QuizResponse } | undefined>(undefined)
  const [quizResult, setQuizResult] = useState<QuizAnswerResponse | undefined>(undefined)

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
      if (!current) {
        handleStopWalk()
        /*
         * ★ 開いているクイズと演出も閉じる（FR-08-2）。
         * 表示側でも隠しているが、**戻ってきたときに古い結果が残る**のを避ける。
         */
        setQuiz(undefined)
        setQuizResult(undefined)
        setBurst(undefined)
      }
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
      // ★ 前回のおためしの続きから始める（端末の中だけの記録）
      setGuestProgress(loadGuestProgress())
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
         * ★ 選択画面を出すかは start-mode.ts で決める。
         *
         * ミニアプリの中と、すでに LINE ログイン済みの場合は**出さない**。
         * 逆に、LINE の外で未ログインのときにそのままログインへ進むと、
         * 開いた人は**何も見ないうちに** LINE のログイン画面へリダイレクトされる。
         *
         * ★ `isInClient()` は初期化前でも使える（LIFF の仕様）。
         * `isLoggedIn()` は初期化後でないと使えないので、内側で初期化している。
         * 初期化に失敗しても false が返るだけで、選択画面から明示的にログインできる。
         */
        const inLineClient = isInLineClient()
        const liffLoggedIn = inLineClient ? true : await isLiffLoggedIn(loaded.liffId)
        if (cancelled) return

        if (shouldOfferStartChoice({
          inLineClient,
          liffLoggedIn,
          guestModeEnabled: loaded.guestModeEnabled,
        })) {
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

  /**
   * 前回までの進み具合を復元する（FR-03-3）。
   *
   * ★ **これが無いと、再読み込み後はチェックイン済みの場所でもボタンが押せる
   * 状態に見え、押してから 409 で断られる。** サーバー側は正しく弾いているので
   * 記録は壊れないが、押させてから断るのは案内として失敗している。
   *
   * ★ おためしは端末の記録から復元するのでここは通らない（403 になる）。
   * 失敗しても行き止まりにしない。ボタンの見た目が戻るだけで、最終判定は
   * サーバーが行う。
   */
  useEffect(() => {
    if (phase !== 'ready' || mode !== 'line') return

    let cancelled = false
    void (async () => {
      try {
        const response = await fetchProgress()
        if (cancelled) return

        const restored: Record<string, SpotProgress> = {}
        for (const entry of response.spots) {
          restored[entry.spotId] = {
            nextAvailableAt:
              entry.nextAvailableAt === undefined
                ? undefined
                : new Date(entry.nextAvailableAt).getTime(),
            visitCount: entry.visitCount,
            quizCleared: entry.quizCleared,
          }
        }

        // ★ 置き換えではなく重ねる。読み込んでいる間に押されたぶんを消さない
        setServerProgress((current) => ({ ...restored, ...current }))
      } catch {
        // 取れなくても遊べる状態は保つ（押せば正しく断られる）
      }
    })()

    return () => {
      cancelled = true
    }
  }, [phase, mode])

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

  /* ---------------- チェックインとクイズ（FR-03・FR-04） ---------------- */

  const cooldownHours = config?.checkinCooldownHours ?? 24

  /** 有事モードで隠すもの（FR-08-2）。判定は emergency.ts に寄せている */
  const game = gameElements(emergency)

  /**
   * 画面が使う「スポットごとの進み」。
   *
   * ★ おためしと LINE ログインで**出どころが違うだけ**にしてある。
   * 画面側に分岐を持ち込むと、片方だけ直して食い違う。
   */
  const progressMap = useMemo(
    () =>
      mode === 'guest' ? progressFromStored(guestProgress.spots, cooldownHours) : serverProgress,
    [mode, guestProgress, cooldownHours, serverProgress],
  )

  /** 累計ポイント。おためしは端末の中の値を使う（サーバーは持っていない） */
  const totalPoints = mode === 'guest' ? guestProgress.points : (user?.totalPoints ?? 0)

  const progressOf = (spotId: SpotId): SpotProgress => progressMap[spotId] ?? NO_PROGRESS

  /** おためしの記録を更新して端末へ書く。書けなくても画面は進む */
  const updateGuestProgress = useCallback((next: GuestProgress): void => {
    setGuestProgress(next)
    saveGuestProgress(next)
  }, [])

  /**
   * クイズを開く（FR-04-1）。
   *
   * ★ 取得に失敗しても行き止まりにしない。クイズが無いスポットもありうるので、
   * 知らせるだけにして地図は触れる状態で残す。
   */
  const openQuiz = useCallback(
    async (spotId: SpotId): Promise<void> => {
      try {
        const response = await fetchQuiz(spotId)

        /*
         * ★ おためしの「正解済み」はサーバーが知らない（保存していない）ので、
         * 端末の記録で上書きする。上書きしないと、正解済みなのに報酬が増えるように
         * 見えてしまう（実際には増えない）。
         */
        const alreadyCleared =
          mode === 'guest'
            ? guestProgress.spots[spotId]?.quizClearedAt !== undefined
            : response.alreadyCleared

        setQuiz({ spotId, response: { ...response, alreadyCleared } })
        setQuizResult(undefined)
      } catch (err) {
        setMessage(err instanceof ApiError ? err.message : 'クイズを取得できませんでした。')
      }
    },
    [mode, guestProgress],
  )

  /**
   * カードの一覧を開く（FR-14）。
   *
   * ★ 取得に失敗しても行き止まりにしない。読み込み中の表示のまま閉じられる。
   */
  const openCards = useCallback(async (): Promise<void> => {
    setCardsOpen(true)
    try {
      setCards(await fetchCards())
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'カードを取得できませんでした。')
    }
  }, [])

  /**
   * チェックイン（FR-03）。
   *
   * ★ 判定はサーバーに任せる。手元では押せるボタンを出すかどうかだけを決めており、
   * ここで再判定はしない（二重に判定すると、片方の閾値だけ変わって食い違う）。
   */
  const handleCheckin = useCallback(
    async (spot: SpotWithDistance): Promise<void> => {
      if (!geo.position) {
        setMessage('現在地が取れていないためチェックインできません。')
        return
      }

      setBusy(true)
      setMessage('')
      try {
        const result = await checkin(spot.spotId, geo.position)

        // ★ 音でも知らせる。歩行中モードでは画面を見ていない（FR-02-10・NFR-14）
        notifyCheckin()
        setBurst(result)
        /*
         * ★ カードの演出はポイントの演出が消えてから出す（同時に出すと何も伝わらない）。
         * 表示側で `burst` が消えるのを待つ形にしてある。
         */
        setRevealCards(result.acquiredCards)

        const nextAvailableAt = new Date(result.nextAvailableAt).getTime()

        if (result.saved) {
          // カードが増えたので、次に一覧を開くときは取り直す
          if (result.acquiredCards.length > 0) setCards(undefined)
          setServerProgress((current) => ({
            ...current,
            [spot.spotId]: {
              nextAvailableAt,
              visitCount: result.visitCount,
              quizCleared: current[spot.spotId]?.quizCleared ?? false,
            },
          }))
          setUser((current) =>
            current ? { ...current, totalPoints: result.totalPoints } : current,
          )
        } else {
          /*
           * ★ おためし。サーバーは累計も前回時刻も持たないので、ここで足す。
           * 保存できなくても遊べる状態は保つ（saveGuestProgress が黙って諦める）。
           */
          const stored = guestProgress.spots[spot.spotId]
          updateGuestProgress({
            points: guestProgress.points + result.pointsEarned,
            spots: {
              ...guestProgress.spots,
              [spot.spotId]: {
                lastCheckinAt: Date.now(),
                visitCount: (stored?.visitCount ?? 0) + 1,
                quizClearedAt: stored?.quizClearedAt,
              },
            },
          })
        }

        // ★ チェックインしたらその場で出題する（FR-04-1）
        await openQuiz(spot.spotId)
      } catch (err) {
        if (err instanceof ApiError) {
          setMessage(err.message)

          /*
           * ★ 制限に当たったら、次に押せる時刻を覚える。
           * 覚えないと、押しては断られるという繰り返しになる。
           */
          const next = err.details['nextAvailableAt']
          if (err.code === 'COOLDOWN' && typeof next === 'string') {
            const at = new Date(next).getTime()
            setServerProgress((current) => ({
              ...current,
              [spot.spotId]: {
                nextAvailableAt: at,
                visitCount: current[spot.spotId]?.visitCount ?? 1,
                quizCleared: current[spot.spotId]?.quizCleared ?? false,
              },
            }))
          }
          return
        }
        setMessage('チェックインできませんでした。通信状況を確認してください。')
      } finally {
        setBusy(false)
      }
    },
    [geo.position, guestProgress, openQuiz, updateGuestProgress],
  )

  /**
   * クイズの回答（FR-04-3・FR-04-6）。
   *
   * ★ 採点はサーバー。ここは結果を映すだけで、正解の判定は持たない。
   */
  const handleAnswer = useCallback(
    async (choiceIndex: number): Promise<void> => {
      if (!quiz) return

      setBusy(true)
      try {
        const result = await answerQuiz(quiz.spotId, {
          quizId: quiz.response.quiz.quizId,
          choiceIndex,
        })

        notifyQuizResult(result.correct)
        // 手に入れたカードは結果の上に重ねて見せる（FR-14-8）
        if (result.acquiredCards.length > 0) setRevealCards(result.acquiredCards)

        /*
         * ★ おためしで正解済みの場合、サーバーは加点ぶんを返してくる
         * （正解状態を持たないため）。**そのまま出すと、増えないポイントを
         * 増えたように見せてしまう。** 表示から落としてから画面へ渡す。
         */
        const rewarded =
          mode === 'guest' && quiz.response.alreadyCleared
            ? { ...result, pointsEarned: 0 }
            : result
        setQuizResult(rewarded)

        if (result.saved) {
          // カードが増えたので、次に一覧を開くときは取り直す
          if (result.acquiredCards.length > 0) setCards(undefined)
          setUser((current) =>
            current ? { ...current, totalPoints: result.totalPoints } : current,
          )
          setServerProgress((current) => ({
            ...current,
            [quiz.spotId]: {
              nextAvailableAt: current[quiz.spotId]?.nextAvailableAt,
              visitCount: current[quiz.spotId]?.visitCount ?? 0,
              quizCleared: true,
            },
          }))
          return
        }

        /*
         * ★ おためしの加点は**端末の記録で一度だけ**にする。
         *
         * サーバーは正解状態を持たないため、同じ設問に何度正解しても
         * `pointsEarned` が返る。ここで抑えないと点数を無限に増やせる。
         */
        if (mode === 'guest' && result.correct) {
          const stored = guestProgress.spots[quiz.spotId]
          if (stored?.quizClearedAt !== undefined) return

          // ★ 今開いているクイズも「正解済み」に切り替える（同じ画面での二重取りを防ぐ）
          setQuiz((current) =>
            current && current.spotId === quiz.spotId
              ? { ...current, response: { ...current.response, alreadyCleared: true } }
              : current,
          )

          updateGuestProgress({
            points: guestProgress.points + result.pointsEarned,
            spots: {
              ...guestProgress.spots,
              [quiz.spotId]: {
                lastCheckinAt: stored?.lastCheckinAt ?? Date.now(),
                visitCount: stored?.visitCount ?? 0,
                quizClearedAt: Date.now(),
              },
            },
          })
        }
      } catch (err) {
        setMessage(err instanceof ApiError ? err.message : '回答を送れませんでした。')
      } finally {
        setBusy(false)
      }
    },
    [quiz, mode, guestProgress, updateGuestProgress],
  )

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
        totalPoints={game.points ? totalPoints : undefined}
        areaName={config?.area.name ?? ''}
        geoStatus={geo.status}
        spotCount={sortedSpots.length}
        onOpenCreator={() => setCreatorOpen((open) => !open)}
        /*
          ★ おためしではカードを出さない。達成状態をサーバーが持たないと、
          未達成カードの中身を隠す仕組み（FR-14-3）が成立しない。
          有事モードでも出さない（FR-08-2）。
        */
        onOpenCards={
          mode === 'line' && game.cards
            ? () => (cardsOpen ? setCardsOpen(false) : void openCards())
            : undefined
        }
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

          {cardsOpen && game.cards && (
            <CardPanel cards={cards} onClose={() => setCardsOpen(false)} />
          )}

          {selectedSpot && (
            <SpotPanel
              spot={selectedSpot}
              checkinRadiusM={config?.checkinRadiusM ?? 100}
              progress={progressOf(selectedSpot.spotId)}
              busy={busy}
              now={Date.now()}
              actionsVisible={game.checkin}
              onCheckin={() => void handleCheckin(selectedSpot)}
              onOpenQuiz={() => void openQuiz(selectedSpot.spotId)}
              onClose={() => setSelectedSpotId(undefined)}
            />
          )}

          {/*
            ★ クイズはスポット詳細の下に置く（別画面にしない）。
            画面を切り替えると、戻ったときに地図の位置と縮尺が失われる。
          */}
          {quiz && game.quiz && (
            <QuizPanel
              spotName={sortedSpots.find((spot) => spot.spotId === quiz.spotId)?.name ?? ''}
              quiz={quiz.response.quiz}
              alreadyCleared={quiz.response.alreadyCleared}
              result={quizResult}
              busy={busy}
              onAnswer={(choiceIndex) => void handleAnswer(choiceIndex)}
              onRetry={() => setQuizResult(undefined)}
              onClose={() => {
                setQuiz(undefined)
                setQuizResult(undefined)
              }}
            />
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

      {/*
        ★ 演出は app の直下に置く。サイドバーの内側だと、スクロール位置によって
        見えないことがある（記録できたのに何も起きていないように見える）。
      */}
      {burst && game.checkin && (
        <CheckinBurst
          result={burst}
          localOnly={mode === 'guest'}
          onDone={() => setBurst(undefined)}
        />
      )}

      {/*
        ★ カードの演出はポイントの演出のあと。同時に出さない（3つ重なると何も伝わらない）。
        獲得は必ず立ち止まっているときに起きるので、順に出しても取り逃さない。
      */}
      {burst === undefined && revealCards.length > 0 && game.cards && (
        <CardReveal cards={revealCards} onDone={() => setRevealCards([])} />
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
