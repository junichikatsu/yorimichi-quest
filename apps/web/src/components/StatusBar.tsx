import type { GeolocationStatus } from '../hooks/useGeolocation.js'
import { equippedKeys, type UserView } from '@imanouchi/shared'
import { AvatarCanvas } from './AvatarCanvas.js'

interface StatusBarProps {
  user: UserView | undefined
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
  emergencyAvailable,
  emergency,
  onToggleEmergency,
}: StatusBarProps): React.JSX.Element {
  /*
   * ★ 累計ポイントはここに出さない（`MapPoints` が地図の左上に出す）。
   *
   * 上の帯にハザードの知らせを出すようにしたため、ここに置いたままだと横に
   * 並んで押し合い、**スマホでは折り返して状態バーが画面を占める**。
   */
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
            <AvatarCanvas avatar={user.avatar} equip={equippedKeys(user.equipment)} scale={1} />
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
