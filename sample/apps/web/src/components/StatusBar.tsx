import type { MeResponse } from '@yorimichi-sample/shared'
import type { GeolocationStatus } from '../hooks/useGeolocation.js'

interface StatusBarProps {
  me: MeResponse | undefined
  geoStatus: GeolocationStatus
  areaName: string
}

const GEO_LABELS: Record<GeolocationStatus, string> = {
  idle: '位置情報を取得中…',
  watching: '位置情報 ON',
  denied: '位置情報 OFF',
  unavailable: '位置情報を利用できません',
  simulated: 'デモ位置を使用中',
}

export function StatusBar({ me, geoStatus, areaName }: StatusBarProps): React.JSX.Element {
  return (
    <header className="statusbar">
      <div className="statusbar__brand">
        <span className="statusbar__logo" aria-hidden="true">
          ⛩
        </span>
        <div>
          <h1 className="statusbar__title">YORIMICHI QUEST</h1>
          <p className="statusbar__area">{areaName}</p>
        </div>
      </div>

      <dl className="statusbar__stats">
        <div>
          <dt>ポイント</dt>
          <dd>{me?.user.totalPoints ?? 0}</dd>
        </div>
        <div>
          <dt>チェックイン</dt>
          <dd>{me?.user.checkinCount ?? 0}</dd>
        </div>
      </dl>

      <p className={`statusbar__geo statusbar__geo--${geoStatus}`}>{GEO_LABELS[geoStatus]}</p>
    </header>
  )
}
