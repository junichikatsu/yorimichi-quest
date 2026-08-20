import { formatArea } from '@map-checkin/core'
import { findChomeAt, type ExplorationSummary, type UnlockedAreaBounds } from '@map-checkin/shared'
import type { Position } from '../hooks/useGeolocation.js'

interface ExplorationPanelProps {
  summary: ExplorationSummary | undefined
  areaRadiusM: number
  mapEnabled: boolean
  /** 現在地。いまいる町丁目を出すために使う */
  position: Position | undefined
  /** 全面が開放された町丁目（#27） */
  unlockedAreas: UnlockedAreaBounds[]
}

export function ExplorationPanel({
  summary,
  areaRadiusM,
  mapEnabled,
  position,
  unlockedAreas,
}: ExplorationPanelProps): React.JSX.Element {
  const coverage = summary?.coveragePercent ?? 0
  const tileCount = summary?.tileCount ?? 0
  // 「300m四方の区画」ではなく町丁目で言えるようにする（#27）
  const chome = position ? findChomeAt(position.lat, position.lng) : undefined

  return (
    <section className="exploration" aria-label="探索状況">
      <h2 className="exploration__title">探索状況</h2>

      {chome && (
        <p className="exploration__chome">
          いま <strong>{chome.ward}{chome.name}</strong>
        </p>
      )}

      <p className="exploration__value">
        {coverage.toFixed(2)}
        <span className="exploration__unit">%{summary?.truncated ? ' 以上' : ''}</span>
      </p>

      {/* 数値は role="img" 側で読み上げるので、バー自体は装飾扱いにする */}
      <div
        className="exploration__bar"
        role="img"
        aria-label={`探索率 ${coverage.toFixed(2)}パーセント`}
      >
        <div className="exploration__bar-fill" style={{ width: `${Math.max(coverage, 0.5)}%` }} />
      </div>

      <dl className="exploration__stats">
        <div>
          <dt>塗った面積</dt>
          <dd>{formatArea(summary?.exploredAreaM2 ?? 0)}</dd>
        </div>
        <div>
          <dt>タイル数</dt>
          <dd>{tileCount}</dd>
        </div>
      </dl>

      <p className="exploration__note">
        {tileCount === 0
          ? mapEnabled
            ? '歩くと現在地のまわりの霧が晴れていきます。位置情報を許可してください。'
            : '歩いた場所が記録されます。位置情報を許可してください。'
          : mapEnabled
            ? '霧が晴れているところが、あなたの歩いた場所です。'
            : '地図を表示すると、歩いた場所の霧が晴れて見えます。'}
      </p>

      {unlockedAreas.length > 0 && (
        <div className="exploration__unlocked">
          <p className="exploration__unlocked-title">歩ききった町丁目（{unlockedAreas.length}）</p>
          <ul className="exploration__chomes">
            {unlockedAreas.map((area) => (
              <li key={area.areaKey} className="exploration__chome-item">
                {area.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="exploration__note">
        区画は国勢調査の町丁目です。一定割合を歩くとその町丁目の霧が全面で晴れます。
        千代田区・港区の外では境界データが無いため、歩いた跡だけが残ります。
      </p>

      <p className="exploration__note">
        探索率はエリア中心から半径{(areaRadiusM / 1000).toFixed(1)}kmの円を分母にした暫定値です。
      </p>
    </section>
  )
}
