import {
  SPOT_CATEGORY_GLYPHS,
  SPOT_CATEGORY_LABELS,
  SPOT_CATEGORIES,
  chomeRecordCounts,
  type SpotWithDistance,
} from '@map-checkin/shared'

interface CoveragePanelProps {
  spots: SpotWithDistance[]
}

/** 一覧に出す町丁目の数。全256区画を並べても読めない */
const SHOW = 8

/**
 * 町丁目ごとの記録件数（FR-09）。
 *
 * ★ これは**行政へ返すための集計**であって、プレイヤーに危険度を見せる画面ではない。
 *
 * 「設備が少ない町丁目」を目立たせると、リスクを地図上の優劣として提示することになり、
 * 設計原則 G-2（リスクを物理的な危険と結びつけない）に反する。そのため
 * **件数の多い順**に並べ、少ない側を強調しない。色でも順位づけしない。
 *
 * 1件も記録が無い町丁目は出さない。**「データが無い」と「設備が無い」は違う**ためである。
 */
export function CoveragePanel({ spots }: CoveragePanelProps): React.JSX.Element {
  const counts = chomeRecordCounts(spots)
  const covered = counts.length
  const population = counts.reduce((sum, entry) => sum + entry.chome.population, 0)
  const records = counts.reduce((sum, entry) => sum + entry.total, 0)

  return (
    <section className="panel" aria-label="町丁目ごとの記録">
      <div className="panel__head">
        <div>
          <p className="panel__category">行政へ返す単位</p>
          <h2 className="panel__title">町丁目ごとの記録</h2>
        </div>
      </div>

      <dl className="coverage__stats">
        <div>
          <dt>記録のある町丁目</dt>
          <dd>{covered}</dd>
        </div>
        <div>
          <dt>その人口</dt>
          <dd>{population.toLocaleString('ja-JP')}人</dd>
        </div>
        <div>
          <dt>記録件数</dt>
          <dd>{records}</dd>
        </div>
      </dl>

      {counts.length === 0 ? (
        <p className="panel__note">まだ記録がありません。</p>
      ) : (
        <ul className="coverage__list">
          {counts.slice(0, SHOW).map((entry) => (
            <li key={entry.chome.code} className="coverage__item">
              <div className="coverage__name">
                <span>{entry.chome.name}</span>
                <span className="coverage__pop">
                  {entry.chome.population > 0
                    ? `${entry.chome.population.toLocaleString('ja-JP')}人`
                    : '居住人口なし'}
                </span>
              </div>
              <ul className="coverage__cats">
                {SPOT_CATEGORIES.filter((category) => entry.counts[category] > 0).map((category) => (
                  <li key={category} className={`coverage__cat coverage__cat--${category}`}>
                    <span aria-hidden="true">{SPOT_CATEGORY_GLYPHS[category]}</span>
                    <span className="coverage__count">{entry.counts[category]}</span>
                    <span className="coverage__catname">{SPOT_CATEGORY_LABELS[category]}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {counts.length > SHOW && (
        <p className="panel__note">ほか {counts.length - SHOW} の町丁目にも記録があります。</p>
      )}

      <p className="panel__note">
        区画は国勢調査の町丁目です。人口はその区画の国勢調査人口で、記録件数は表示中のスポット数です。
        件数が少ないことは設備が無いことを意味しません。
      </p>
    </section>
  )
}
