import type { GeolocationStatus } from '../hooks/useGeolocation.js'
import type { UserView } from '@imanouchi/shared'

interface StatusBarProps {
  user: UserView | undefined
  areaName: string
  geoStatus: GeolocationStatus
  spotCount: number
}

const GEO_LABELS: Record<GeolocationStatus, string> = {
  idle: '位置情報 未使用',
  watching: '位置情報 ON',
  denied: '位置情報 OFF',
  unavailable: '位置情報を利用できません',
}

export function StatusBar({ user, areaName, geoStatus, spotCount }: StatusBarProps): React.JSX.Element {
  return (
    <header className="statusbar">
      <div className="statusbar__brand">
        {user?.pictureUrl !== undefined && user.pictureUrl !== '' ? (
          <img className="statusbar__avatar" src={user.pictureUrl} alt="" width={32} height={32} />
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
