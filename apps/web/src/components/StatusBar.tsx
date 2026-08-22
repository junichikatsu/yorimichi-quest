import type { GeolocationStatus } from '../hooks/useGeolocation.js'
import type { UserView } from '@imanouchi/shared'
import { useEffect, useRef, useState } from 'react'
import { AvatarCanvas } from './AvatarCanvas.js'

interface StatusBarProps {
  user: UserView | undefined
  /**
   * 累計ポイント（FR-01-3・FR-03-2）。**undefined なら出さない。**
   *
   * ★ `user.totalPoints` を直接読まない。おためしではサーバーが累計を持たず、
   * 端末の中の値を出す必要がある。出どころの違いを親に寄せている。
   *
   * ★ 有事モードでは親が undefined を渡す（FR-08-2）。ここで `emergency` を
   * 見て分岐すると、隠す判定が画面ごとに散る。
   */
  totalPoints: number | undefined
  areaName: string
  geoStatus: GeolocationStatus
  spotCount: number
  /** キャラクターメイキングを開く（FR-01-6） */
  onOpenCreator: () => void
  /** 有事モードの切替を出すか（FR-08-1）。デモ用でサーバーから止められる */
  emergencyAvailable: boolean
  emergency: boolean
  onToggleEmergency: () => void
}

/** 跳ねている時間。CSS のアニメーションと同じ長さにそろえる */
const POINTS_BUMP_MS = 700

const GEO_LABELS: Record<GeolocationStatus, string> = {
  idle: '位置情報 未使用',
  watching: '位置情報 ON',
  denied: '位置情報 OFF',
  unavailable: '位置情報を利用できません',
  // ★ 模擬位置であることを隠さない。実測と同じ見た目にすると、
  //   デモの記録を実際に歩いた記録と取り違える
  simulated: 'デモ位置を使用中',
}

export function StatusBar({
  user,
  totalPoints,
  areaName,
  geoStatus,
  spotCount,
  onOpenCreator,
  emergencyAvailable,
  emergency,
  onToggleEmergency,
}: StatusBarProps): React.JSX.Element {
  /*
   * 増えた瞬間だけ跳ねさせる（FR-03-2）。
   *
   * ★ 演出は地図の上に出るのに、累計はここにある。数字が静かに置き換わるだけだと、
   * **増えたことに気づかない**。減ることは無いので、増えたときだけ動かす。
   *
   * ★ 動きは CSS 側で `prefers-reduced-motion` に従って落とす（NFR-08）。
   * 印を出すこと自体は変えない。
   */
  const [bumped, setBumped] = useState(false)
  const previousPointsRef = useRef(totalPoints)

  useEffect(() => {
    const previous = previousPointsRef.current
    previousPointsRef.current = totalPoints
    if (previous === undefined || totalPoints === undefined || totalPoints <= previous) return

    setBumped(true)
    const timer = setTimeout(() => setBumped(false), POINTS_BUMP_MS)
    return () => clearTimeout(timer)
  }, [totalPoints])

  return (
    <header className="statusbar">
      <div className="statusbar__brand">
        {/*
          ★ ここに出すのは LINE のアイコンではなくゲーム内のキャラクター。
          押すと作り直せる（FR-01-6）。LINE のアイコンは本人の写真でありうるため、
          常時表示するものとしては重い。
        */}
        {user ? (
          <button
            type="button"
            className="statusbar__avatar statusbar__avatar--button"
            onClick={onOpenCreator}
            aria-label="キャラクターをつくる"
          >
            <AvatarCanvas avatar={user.avatar} scale={1} />
          </button>
        ) : (
          <span className="statusbar__avatar statusbar__avatar--blank" aria-hidden="true" />
        )}
        {/*
          ★ クラスを付けて min-width: 0 を当てている。
          これが無いと、幅が足りないときに**1文字ずつ改行して縦に伸びる**
          （日本語はどこでも改行できるため、最小幅が1文字になる）。
        */}
        <div className="statusbar__names">
          <p className="statusbar__title">イマノウチ</p>
          <p className="statusbar__sub">
            {areaName} ・ {spotCount}件
          </p>
        </div>
        {/* 貯まっていることが平時は常に見えるようにする（FR-03-2 の付与が実感になる） */}
        <div className={bumped ? 'statusbar__points statusbar__points--bumped' : 'statusbar__points'}>
          {totalPoints !== undefined && (
            <>
              <span className="statusbar__points-value">{totalPoints}</span>
              <span className="statusbar__points-unit">pt</span>
            </>
          )}
        </div>
      </div>
      <div className="statusbar__right">
        <p className={`statusbar__geo statusbar__geo--${geoStatus}`}>{GEO_LABELS[geoStatus]}</p>
        {/*
          有事モードへの切替（FR-08-1）。
          ★ サーバーで止められるようにしてある。実利用者に見せると、実際に災害が
          起きたと誤認させうる。文言にも「デモ」を必ず含める。
        */}
        {emergencyAvailable && (
          <button
            type="button"
            className={
              emergency ? 'statusbar__mode statusbar__mode--on' : 'statusbar__mode'
            }
            onClick={onToggleEmergency}
            aria-pressed={emergency}
          >
            {emergency ? '平時に戻す' : '有事モード（デモ）'}
          </button>
        )}
      </div>
    </header>
  )
}
