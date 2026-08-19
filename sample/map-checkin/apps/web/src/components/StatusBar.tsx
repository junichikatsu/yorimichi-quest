import type { ExplorationSummary, MeResponse } from '@map-checkin/shared'
import type { GeolocationStatus } from '../hooks/useGeolocation.js'
import { AvatarCanvas } from './AvatarCanvas.js'

interface StatusBarProps {
  me: MeResponse | undefined
  exploration: ExplorationSummary | undefined
  geoStatus: GeolocationStatus
  areaName: string
  onOpenCreator: () => void
}

const GEO_LABELS: Record<GeolocationStatus, string> = {
  idle: '位置情報を取得中…',
  watching: '位置情報 ON',
  denied: '位置情報 OFF',
  unavailable: '位置情報を利用できません',
  simulated: 'デモ位置を使用中',
}

export function StatusBar({
  me,
  exploration,
  geoStatus,
  areaName,
  onOpenCreator,
}: StatusBarProps): React.JSX.Element {
  return (
    <header className="statusbar">
      <div className="statusbar__brand">
        {me ? (
          <button
            type="button"
            className="statusbar__avatar"
            onClick={onOpenCreator}
            aria-label="キャラクターをつくる"
          >
            <AvatarCanvas avatar={me.user.avatar} equipment={me.user.equipment} scale={2} />
          </button>
        ) : (
          <span className="statusbar__logo" aria-hidden="true">
            ⛩
          </span>
        )}
        <div className="statusbar__names">
          <h1 className="statusbar__title">YORIMICHI QUEST</h1>
          <p className="statusbar__area">{me ? `${me.user.avatar.name} ／ ${areaName}` : areaName}</p>
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
        <div>
          <dt>探索率</dt>
          <dd>{(exploration?.coveragePercent ?? 0).toFixed(2)}%</dd>
        </div>
      </dl>

      <p className={`statusbar__geo statusbar__geo--${geoStatus}`}>{GEO_LABELS[geoStatus]}</p>
    </header>
  )
}
