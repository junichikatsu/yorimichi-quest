import { formatDistance } from '@imanouchi/core'
import { SPOT_CATEGORY_LABELS, type SpotWithDistance } from '@imanouchi/shared'
import { buildCheckinView, type SpotProgress } from '../checkin-view.js'

interface SpotPanelProps {
  spot: SpotWithDistance
  /** チェックインできる半径（m）。サーバーから配られる（FR-03-1） */
  checkinRadiusM: number
  progress: SpotProgress
  busy: boolean
  /** 現在時刻。制限の残りを出すために受け取る（テスト可能にするため引数にする） */
  now: number
  /**
   * チェックインとクイズの導線を出すか。
   *
   * ★ 有事モードでは出さない（FR-08-2）。有事に「ポイントが増える」操作を
   * 見せると、点数のために危険な場所へ向かわせうる（NFR-14）。
   * 判定は `emergency.ts` の `gameElements` に寄せてある。
   */
  actionsVisible: boolean
  onCheckin: () => void
  /**
   * 現地確認アンケートを開く（FR-12-3）。
   *
   * ★ チェックイン後は自動で開くが、**スキップされたときの戻り道が必要**である
   * （FR-12-11 でスキップを許しているので、ここが無いと二度と開けない）。
   * このサービスが集めているデータは、この面でしか増えない。
   */
  onOpenSurvey: () => void
  /** クイズを開く（FR-04-1）。チェックイン後は自動で開くので、ここは見直し用 */
  onOpenQuiz: () => void
  onClose: () => void
}

/**
 * スポット詳細（FR-02-2）。
 *
 * ★ 属性が空のときに「設備なし」とは書かない。オープンデータの空欄は
 * 「設備が無い」ではなく「未記入」であり、そこがこのサービスで埋める対象である（FR-12）。
 * 断定すると、無いはずのものを無いと言い切ったことになる。
 */
export function SpotPanel({
  spot,
  checkinRadiusM,
  progress,
  busy,
  now,
  actionsVisible,
  onCheckin,
  onOpenSurvey,
  onOpenQuiz,
  onClose,
}: SpotPanelProps): React.JSX.Element {
  const checkinView = buildCheckinView({
    distanceM: spot.distanceM,
    radiusM: checkinRadiusM,
    progress,
    now,
  })

  return (
    <section className="panel" aria-label="スポット詳細">
      <div className="panel__head">
        <div>
          <p className="panel__category">{SPOT_CATEGORY_LABELS[spot.category]}</p>
          <h2 className="panel__title">{spot.name}</h2>
        </div>
        <button type="button" className="button button--ghost" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      {spot.address !== '' && <p className="panel__address">{spot.address}</p>}

      {spot.distanceM !== null && (
        <p className="panel__distance">現在地から {formatDistance(spot.distanceM)}</p>
      )}

      {spot.attributes.length > 0 ? (
        <ul className="tags">
          {spot.attributes.map((attribute) => (
            <li key={attribute} className="tags__item">
              {attribute}
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel__note">
          設備の情報が公開データに記載されていません。現地で確かめられる項目です。
        </p>
      )}

      {spot.source !== '' && (
        <p className="panel__source">
          出典 {spot.source}
          {spot.fetchedAt !== '' && `（取得 ${spot.fetchedAt}）`}
        </p>
      )}

      {/* ---------------- チェックイン（FR-03） ---------------- */}

      {actionsVisible && (
      <div className="checkin">
        <button
          type="button"
          className="button button--primary checkin__button"
          disabled={!checkinView.enabled || busy}
          onClick={onCheckin}
        >
          {busy ? '記録しています…' : checkinView.label}
        </button>

        {checkinView.note !== undefined && <p className="checkin__note">{checkinView.note}</p>}

        <dl className="checkin__stats">
          <div>
            <dt>ここへ来た回数</dt>
            <dd>{progress.visitCount}</dd>
          </div>
          <div>
            {/* みんなの回数（FR-03-4 の貢献度）。集計が無いので書き込み時に数えている */}
            <dt>みんなの記録</dt>
            <dd>{spot.checkinCount}</dd>
          </div>
        </dl>

        {/*
          ★ 現地確認アンケート（FR-12-3）。チェックイン後に自動で開くが、
          **スキップされたときの戻り道**としてここにも置く（FR-12-11）。

          ★ クイズより先に置く。画面の並びも「アンケート → クイズ」にそろえる。
          このサービスが集めているデータは、この面でしか増えない。
        */}
        <div className="surveycta">
          <p className="surveycta__head">
            <span className="survey__badge">現地チェック</span>
            <span className="surveycta__lead">
              見て分かることを教えてください。行政データに無い情報が地図に増えます
            </span>
          </p>
          <button
            type="button"
            className="button button--primary surveycta__button"
            onClick={onOpenSurvey}
          >
            この場所のことを教える
          </button>
          <p className="quizcta__note">分からない項目は「わからない」で大丈夫です。</p>
        </div>

        {/*
          ★ クイズはチェックイン後に自動で開く（FR-04-1）。
          この導線は「解説をもう一度読みたい」「あとで挑戦したい」ための入口である。

          ★ 控えめな見た目にしない。**防災クイズはこのサービスの目的そのもの**
          （FR-04・G-8）であり、チェックインの副産物ではない。ポイントの付く
          チェックインだけが目立つと、点数を集める遊びに読み替えられる。
        */}
        <div className={progress.quizCleared ? 'quizcta quizcta--done' : 'quizcta'}>
          <p className="quizcta__head">
            <span className="quizcta__badge">防災クイズ</span>
            <span className="quizcta__lead">
              {progress.quizCleared
                ? '正解済み。解説はいつでも読み直せます'
                : 'この場所で出る1問。正解するとポイントが増えます'}
            </span>
          </p>
          <button type="button" className="button button--quiz quizcta__button" onClick={onOpenQuiz}>
            {progress.quizCleared ? 'クイズと解説をもう一度見る' : 'クイズに挑戦する'}
          </button>
          <p className="quizcta__note">まちがえてもポイントは減りません。</p>
        </div>
      </div>
      )}
    </section>
  )
}
