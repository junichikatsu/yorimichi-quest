import type { GeolocationStatus } from '../hooks/useGeolocation.js'
import type { UserView } from '@imanouchi/shared'
import { AvatarCanvas } from './AvatarCanvas.js'

interface StatusBarProps {
  user: UserView | undefined
  areaName: string
  geoStatus: GeolocationStatus
  spotCount: number
  /** キャラクターメイキングを開く（FR-01-6） */
  onOpenCreator: () => void
}

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
  areaName,
  geoStatus,
  spotCount,
  onOpenCreator,
}: StatusBarProps): React.JSX.Element {
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
        <div>
          <p className="statusbar__title">イマノウチ</p>
          <p className="statusbar__sub">
            {areaName} ・ {spotCount}件
          </p>
        </div>
      </div>
      <p className={`statusbar__geo statusbar__geo--${geoStatus}`}>{GEO_LABELS[geoStatus]}</p>
    </header>
  )
}
