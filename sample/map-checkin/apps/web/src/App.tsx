import { interpolatePath, offsetByMeters } from '@map-checkin/core'
import {
  ITEM_DEFS,
  type Avatar,
  type ClientConfigResponse,
  type Equipment,
  type CardsResponse,
  type MeResponse,
  type QuizAnswerResponse,
  type QuizResponse,
  type SpotWithDistance,
} from '@map-checkin/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  fetchClientConfig,
  fetchCards,
  fetchMe,
  fetchQuiz,
  fetchSpots,
  postCheckin,
  postQuizAnswer,
  putAvatar,
  putEquipment,
} from './api.js'
import { AvatarCreator } from './components/AvatarCreator.js'
import { ExplorationPanel } from './components/ExplorationPanel.js'
import { HistoryPanel } from './components/HistoryPanel.js'
import { CardPanel } from './components/CardPanel.js'
import { JoystickControl } from './components/JoystickControl.js'
import { MapView } from './components/MapView.js'
import { QuizPanel } from './components/QuizPanel.js'
import { SpotList } from './components/SpotList.js'
import { SpotPanel } from './components/SpotPanel.js'
import { StatusBar } from './components/StatusBar.js'
import { useExploration } from './hooks/useExploration.js'
import { type Position, useGeolocation } from './hooks/useGeolocation.js'
import { withLocalDistance } from './spots.js'

interface Toast {
  kind: 'success' | 'error'
  message: string
}

/**
 * サーバーと同期する間隔（ms）。
 *
 * 表示に必要な情報のうち**位置に依存するのは距離と並び順だけ**で、これはクライアントで
 * 計算できる（`withLocalDistance`）。サーバーに問い合わせる必要があるのは、
 * 他のユーザーのチェックインで checkinCount が動いた場合など、自分の操作では起きない変化だけ。
 *
 * そのため移動では取り直さず、この間隔の定期同期に寄せている。
 * 自分の操作（チェックイン・クイズ・装備変更）の直後は、待たずにその場で取り直す。
 */
const SYNC_INTERVAL_MS = 30_000

export function App(): React.JSX.Element {
  const [config, setConfig] = useState<ClientConfigResponse | undefined>(undefined)
  /** サーバーから受け取ったままの一覧。距離と並びは表示直前にクライアントで付け直す */
  const [rawSpots, setRawSpots] = useState<SpotWithDistance[]>([])
  const [me, setMe] = useState<MeResponse | undefined>(undefined)
  const [selectedSpotId, setSelectedSpotId] = useState<string | undefined>(undefined)
  const [toast, setToast] = useState<Toast | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [fatalError, setFatalError] = useState<string | undefined>(undefined)
  const [cards, setCards] = useState<CardsResponse | undefined>(undefined)
  const [quiz, setQuiz] = useState<QuizResponse | undefined>(undefined)
  const [quizResult, setQuizResult] = useState<QuizAnswerResponse | undefined>(undefined)
  const [quizSpotId, setQuizSpotId] = useState<string | undefined>(undefined)
  const [creatorOpen, setCreatorOpen] = useState(false)
  /** スマートフォンでのボトムシートの開閉。広い画面では常に開いた扱いになる */
  const [sheetOpen, setSheetOpen] = useState(false)
  const [joystickClosed, setJoystickClosed] = useState(false)

  const geo = useGeolocation()
  const exploration = useExploration(config?.exploration)

  useEffect(() => {
    fetchClientConfig()
      .then(setConfig)
      .catch((err: unknown) => {
        setFatalError(err instanceof Error ? err.message : '設定を取得できませんでした')
      })
  }, [])

  // 現在地が動くたびに探索済みタイルへ積む（同じタイルなら track 側で捨てられる）。
  // 依存はフックが返す関数そのもの。exploration は毎レンダー別オブジェクトになるため使わない。
  const { track: trackExploration, trackPath, error: explorationError } = exploration

  useEffect(() => {
    if (!geo.position) return
    trackExploration(geo.position)
  }, [geo.position, trackExploration])

  useEffect(() => {
    if (!explorationError) return
    setToast({ kind: 'error', message: explorationError })
  }, [explorationError])

  /**
   * サーバーとの同期。
   *
   * 現在地は渡さない。距離と並び順はクライアントで付け直すため、
   * リクエストが位置に依らなくなり、同じ内容を何度も取り直さずに済む。
   */
  const reload = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const [spotsResponse, meResponse, cardsResponse] = await Promise.all([
        fetchSpots(undefined),
        fetchMe(),
        fetchCards(),
      ])
      setRawSpots(spotsResponse.spots)
      setMe(meResponse)
      setCards(cardsResponse)
    } catch (err: unknown) {
      // 定期同期の失敗でトーストを出すと、通信が不安定なときに出っぱなしになる
      if (options?.silent === true) return
      setToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'データを取得できませんでした',
      })
    }
  }, [])

  useEffect(() => {
    if (!config) return
    void reload()
  }, [config, reload])

  // 定期同期。他のユーザーの行動による変化を拾う。裏に回っている間は止める
  useEffect(() => {
    if (!config) return

    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void reload({ silent: true })
    }, SYNC_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [config, reload])

  /** 距離と並び順はここで付ける。現在地が動いても通信は発生しない */
  const spots = useMemo(() => withLocalDistance(rawSpots, geo.position), [rawSpots, geo.position])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // 見せたいものが出たらシートを開く。ユーザーが毎回引き上げる手間をなくす
  useEffect(() => {
    if (selectedSpotId !== undefined || quiz !== undefined || creatorOpen) setSheetOpen(true)
  }, [selectedSpotId, quiz, creatorOpen])

  const selectedSpot = spots.find((spot) => spot.spotId === selectedSpotId)

  const handleCheckin = useCallback(async () => {
    if (!selectedSpot || !geo.position) return
    setBusy(true)
    try {
      const result = await postCheckin(selectedSpot.spotId, geo.position)
      const { base, multiplier, firstVisitBonus } = result.breakdown
      const bonusText = firstVisitBonus > 0 ? ` ＋初回${firstVisitBonus}pt` : ''
      const itemText = result.acquiredItem
        ? ` ／ ${ITEM_DEFS[result.acquiredItem].name} を手に入れた`
        : ''
      setToast({
        kind: 'success',
        message: `+${result.pointsEarned}pt 獲得（${base}pt ×${multiplier}${bonusText}）${itemText}`,
      })
      await reload()

      // FR-04-1: チェックインに続けてそのスポットのクイズを出す
      try {
        const response = await fetchQuiz(selectedSpot.spotId)
        setQuiz(response)
        setQuizResult(undefined)
        setQuizSpotId(selectedSpot.spotId)
      } catch {
        // クイズが用意されていないカテゴリもある。チェックイン自体は成功しているので黙って進む
      }
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

  /**
   * ジョイスティックによるデバッグ移動。
   *
   * 毎フレーム呼ばれるため、state の更新を待たずに ref を先に進める。
   * state だけを見ると 1 フレーム前の位置から動かすことになり、
   * 倒し続けても速度が出ない（更新のたびに巻き戻る）。
   */
  const positionRef = useRef<Position | undefined>(undefined)
  useEffect(() => {
    positionRef.current = geo.position
  }, [geo.position])

  const handleJoystickMove = useCallback(
    (eastM: number, northM: number) => {
      const base = positionRef.current ?? config?.area.center
      if (!base) return

      const next = offsetByMeters(base, eastM, northM)
      positionRef.current = next
      geo.simulate(next)
    },
    [config, geo],
  )

  const handleAnswerQuiz = useCallback(
    async (choiceIndex: number) => {
      if (!quiz || !quizSpotId) return
      setBusy(true)
      try {
        const result = await postQuizAnswer(quizSpotId, quiz.quiz.quizId, choiceIndex)
        setQuizResult(result)
        // 正解でポイントとアイテムが動くため、ステータスとリュックを取り直す
        if (result.correct) await reload()
      } catch (err: unknown) {
        setToast({
          kind: 'error',
          message: err instanceof Error ? err.message : '回答を送れませんでした',
        })
      } finally {
        setBusy(false)
      }
    },
    [quiz, quizSpotId, reload],
  )

  const handleSaveAvatar = useCallback(
    async (avatar: Avatar) => {
      setBusy(true)
      try {
        await putAvatar(avatar)
        await reload()
        setCreatorOpen(false)
        setToast({ kind: 'success', message: 'すがたを保存しました' })
      } catch (err: unknown) {
        setToast({
          kind: 'error',
          message: err instanceof Error ? err.message : 'すがたを保存できませんでした',
        })
      } finally {
        setBusy(false)
      }
    },
    [reload],
  )

  const handleEquip = useCallback(
    async (equipment: Equipment) => {
      setBusy(true)
      try {
        await putEquipment(equipment)
        await reload()
      } catch (err: unknown) {
        setToast({
          kind: 'error',
          message: err instanceof Error ? err.message : '装備を変更できませんでした',
        })
      } finally {
        setBusy(false)
      }
    },
    [reload],
  )

  /**
   * デモ用：現在地から選択スポットまで「歩いた」ことにして軌跡を塗る。
   *
   * 現地に行かずに霧が晴れる様子を確認するための導線（「現在地をこの場所に設定する」と同趣旨）。
   * 送信上限を超える距離では点が飛び、軌跡が破線状になる。
   */
  const handleSimulateWalk = useCallback(async () => {
    if (!selectedSpot || !geo.position || !config) return
    setBusy(true)
    try {
      const path = interpolatePath(
        geo.position,
        { lat: selectedSpot.lat, lng: selectedSpot.lng },
        config.exploration.tileSizeM,
        config.exploration.maxPointsPerRequest,
      )
      const added = await trackPath(path)
      geo.simulate({ lat: selectedSpot.lat, lng: selectedSpot.lng })
      setToast({ kind: 'success', message: `${added}マス分の霧が晴れました` })
    } finally {
      setBusy(false)
    }
  }, [selectedSpot, geo, config, trackPath])

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

  // 位置情報が使えない環境でも導線を確認できるようにする（デバッグ用）
  const needsJoystick = geo.status === 'denied' || geo.status === 'unavailable' || geo.status === 'simulated'
  const sheetLabel = quiz
    ? '防災クイズ'
    : creatorOpen
      ? 'キャラクターをつくる'
      : selectedSpot
        ? selectedSpot.name
        : 'メニュー'

  return (
    <div className="app">
      <StatusBar
        me={me}
        exploration={exploration.summary}
        geoStatus={geo.status}
        areaName={config.area.name}
        onOpenCreator={() => setCreatorOpen((open) => !open)}
      />

      <main className="app__main">
        {canUseMap ? (
          <MapView
            token={config.mapboxToken}
            area={config.area}
            spots={spots}
            exploredTiles={exploration.tiles}
            unlockedAreas={exploration.unlockedAreas}
            revealRadiusM={config.exploration.revealRadiusM}
            position={geo.position}
            selectedSpotId={selectedSpotId}
            onSelectSpot={setSelectedSpotId}
            avatar={me?.user.avatar}
            equipment={me?.user.equipment}
          />
        ) : (
          <div className="map map--fallback">
            <p className="map__notice">
              Mapbox のアクセストークンが未設定のため、一覧表示で動作しています。
            </p>
            <SpotList spots={spots} selectedSpotId={selectedSpotId} onSelectSpot={setSelectedSpotId} />
          </div>
        )}

        {needsJoystick &&
          (joystickClosed ? (
            <button
              type="button"
              className="joystick-reopen"
              onClick={() => setJoystickClosed(false)}
            >
              デバッグ移動
            </button>
          ) : (
            <JoystickControl onMove={handleJoystickMove} onClose={() => setJoystickClosed(true)} />
          ))}

        <aside className={`sidebar${sheetOpen ? ' sidebar--open' : ''}`}>
          <button
            type="button"
            className="sidebar__handle"
            onClick={() => setSheetOpen((open) => !open)}
            aria-expanded={sheetOpen}
          >
            <span className="sidebar__grip" aria-hidden="true" />
            <span className="sidebar__handle-label">{sheetLabel}</span>
            <span className="sidebar__handle-hint">{sheetOpen ? '閉じる' : '開く'}</span>
          </button>

          <div className="sidebar__body">
          {creatorOpen && me && (
            <AvatarCreator
              avatar={me.user.avatar}
              equipment={me.user.equipment}
              busy={busy}
              onSave={(avatar) => void handleSaveAvatar(avatar)}
              onClose={() => setCreatorOpen(false)}
            />
          )}

          {quiz && (
            <QuizPanel
              quiz={quiz.quiz}
              alreadyCleared={quiz.alreadyCleared}
              result={quizResult}
              busy={busy}
              onAnswer={(choiceIndex) => void handleAnswerQuiz(choiceIndex)}
              onRetry={() => setQuizResult(undefined)}
              onClose={() => {
                setQuiz(undefined)
                setQuizResult(undefined)
                setQuizSpotId(undefined)
              }}
            />
          )}

          {selectedSpot ? (
            <SpotPanel
              spot={selectedSpot}
              checkinRadiusM={config.checkinRadiusM}
              position={geo.position}
              busy={busy}
              onCheckin={() => void handleCheckin()}
              onSimulateHere={() => geo.simulate({ lat: selectedSpot.lat, lng: selectedSpot.lng })}
              onSimulateWalk={() => void handleSimulateWalk()}
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

          <CardPanel cards={cards} busy={busy} onEquip={(equipment) => void handleEquip(equipment)} />

          <ExplorationPanel
            summary={exploration.summary}
            areaRadiusM={config.exploration.areaRadiusM}
            mapEnabled={canUseMap}
          />

            <HistoryPanel me={me} />
          </div>
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
