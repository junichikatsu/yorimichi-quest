import {
  SURVEY_VALUES,
  type SurveyAnswerResponse,
  type SurveyFieldView,
  type SurveyResponse,
  type SurveyValue,
} from '@imanouchi/shared'
import { useEffect, useRef, useState } from 'react'

interface SurveyPanelProps {
  survey: SurveyResponse
  result: SurveyAnswerResponse | undefined
  busy: boolean
  /** おためし（ゲスト）か。記録がサーバーへ残らないことを断る */
  localOnly: boolean
  onSubmit: (answers: Record<string, SurveyValue>, note: string) => void
  /** 答えずにクイズへ進む */
  onSkip: () => void
  /** 回答のあとクイズへ進む */
  onNext: () => void
  onClose: () => void
}

/**
 * スポットの現地確認アンケート（FR-12）。
 *
 * ★ **このサービスが集めているデータは、ここでしか増えない。** チェックイン
 * （FR-03）とクイズ（FR-04）は行政データを1件も増やさない。だからチェックインの
 * 直後、設備を目の前にしているうちに出す（クイズは知識なので、どこでも答えられる）。
 *
 * ★ 選択肢は3つある（「わからない」を含む）。**2択にしてはいけない。** 「無い」と
 * 「見ていない」が同じ値に潰れると、オストメイト設備が「無い」という誤りが公開データに
 * 載り、それを見た人が現地で行き詰まる。答えないことは失敗ではないと画面でも示す。
 *
 * ★ スキップできる。答えないと進めない形にすると、歩行中モード（FR-02-9）や
 * 高齢者の利用（NFR-08）で詰まる。**答えたほうが得**という形で誘う（報酬は
 * サーバーが決める）。
 *
 * ★ 「あと何問」を出さない。3問しかないので、残り数を出すと作業に見える。
 */
export function SurveyPanel({
  survey,
  result,
  busy,
  localOnly,
  onSubmit,
  onSkip,
  onNext,
  onClose,
}: SurveyPanelProps): React.JSX.Element {
  const [answers, setAnswers] = useState<Record<string, SurveyValue>>({})
  const [note, setNote] = useState('')

  const answered = result !== undefined
  const answeredCount = Object.keys(answers).length

  /*
   * 送ったら結果まで送る。
   *
   * ★ 結果は設問の**下**に出る。板の高さが足りないと画面の外に出るので、
   * 「送ったのに何も起きていない」ように見える（クイズで同じことが起きた）。
   */
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!answered) return
    resultRef.current?.scrollIntoView({ block: 'nearest' })
  }, [answered])

  /* ---------------- 回答済み（読み取り専用） ---------------- */

  /*
   * ★ 回答済みなら送信させない。同じ人が答え直せる形にすると、集計から差し引く
   * 処理が必要になり、そこが報酬と閾値（FR-06-2）の操作口になる。
   * ただし**自分が何と答えたかは見せる**。答えたのに何も残っていない画面にしない。
   */
  if (survey.alreadyAnswered && !answered) {
    return (
      <section className="panel panel--survey">
        <Head survey={survey} onClose={onClose} />

        <p className="panel__note">
          この場所のアンケートには回答済みです。施設の変化は、別の人の回答で追いかけます。
        </p>

        <ul className="survey__mine">
          {survey.fields.map((field) => (
            <li key={field.fieldKey}>
              <p className="survey__question">{field.question}</p>
              <p className="survey__mineValue">
                {labelOf(field, survey.myAnswers[field.fieldKey])}
              </p>
            </li>
          ))}
        </ul>

        <button type="button" className="button button--primary survey__next" onClick={onNext}>
          防災クイズへ
        </button>
      </section>
    )
  }

  /* ---------------- 回答したあと ---------------- */

  if (answered) {
    return (
      <section className="panel panel--survey">
        <Head survey={survey} onClose={onClose} />

        <div ref={resultRef} className="survey__result" role="status">
          <p className="survey__verdict">
            <span className="survey__stamp" aria-hidden="true">
              ✓
            </span>
            {result.recordedCount > 0
              ? `${result.recordedCount}件の情報が、この場所に増えました`
              : '回答を受け取りました'}
          </p>

          {result.pointsEarned > 0 && (
            <p className="survey__reward">+{result.pointsEarned}pt</p>
          )}

          {/*
            ★ 閾値に達した項目だけを知らせる（FR-06-2）。1人の回答では確定しない
            ことを、確定したときにだけ言うことで伝える。
          */}
          {result.verifiedFieldKeys.length > 0 && (
            <p className="survey__verified">
              {result.verifiedFieldKeys.length}件が、別の人の回答と一致して「検証済み」になりました。
            </p>
          )}

          {localOnly ? (
            <p className="panel__note">
              おためしのため、この回答は<strong>どこにも保存されません</strong>。
              LINEでログインすると、答えた内容が地図の情報として残ります。
            </p>
          ) : (
            <p className="panel__note">
              同じ場所で別の人が同じ答えを出すと「検証済み」になり、行政へ渡すデータに入ります。
            </p>
          )}
        </div>

        <button type="button" className="button button--primary survey__next" onClick={onNext}>
          防災クイズへ
        </button>
      </section>
    )
  }

  /* ---------------- 回答する ---------------- */

  return (
    <section className="panel panel--survey">
      <Head survey={survey} onClose={onClose} />

      <p className="survey__lead">
        見て分かるものだけで大丈夫です。<strong>分からなければ「わからない」</strong>を選んでください。
        {/*
          ★ 「わからない」でもポイントは同じ、と明記する。書かないと、点数のために
          断定する人が出る。断定はそのまま公開データの誤りになる。
        */}
        どれを選んでもポイントは同じです。
      </p>

      <ul className="survey__fields">
        {survey.fields.map((field) => (
          <li key={field.fieldKey} className="survey__field">
            <p className="survey__question">
              {field.question}
              {/*
                ★ 「行政データに無い項目」であることを見せる（FR-12-3）。
                自分の回答が何を埋めているのかが分かると、答える意味が伝わる。
              */}
              {field.intent === 'fill' ? (
                <span className="survey__tag survey__tag--fill">記録がない</span>
              ) : (
                <span className="survey__tag survey__tag--verify">記録を確かめる</span>
              )}
            </p>
            <p className="survey__why">{field.why}</p>

            <div className="survey__choices" role="group" aria-label={field.question}>
              {SURVEY_VALUES.map((value) => {
                const picked = answers[field.fieldKey] === value
                return (
                  <button
                    key={value}
                    type="button"
                    className={`survey__choice${picked ? ' survey__choice--picked' : ''}`}
                    aria-pressed={picked}
                    disabled={busy}
                    onClick={() =>
                      setAnswers((current) =>
                        /*
                         * ★ 同じものをもう一度押したら取り消す。押し間違えたときに
                         * 直せないと、間違った答えをそのまま送ることになる。
                         */
                        current[field.fieldKey] === value
                          ? omit(current, field.fieldKey)
                          : { ...current, [field.fieldKey]: value },
                      )
                    }
                  >
                    {labelOf(field, value)}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      {/*
        ★ 自由記述は最後に、任意として置く。選択肢で拾えない「見つけ方」を受ける
        （行政データは「設置場所：ホーム」までしか持っていない）。

        ★ 上限を数字で見せる。超えたぶんが黙って切られると、書いた人は気づけない。
      */}
      <label className="survey__noteLabel" htmlFor="survey-note">
        ひとこと（任意）
      </label>
      <textarea
        id="survey-note"
        className="survey__note"
        rows={2}
        maxLength={survey.noteMaxLength}
        placeholder={survey.notePlaceholder}
        value={note}
        disabled={busy}
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="survey__noteCount">
        {note.length} / {survey.noteMaxLength}
      </p>

      <button
        type="button"
        className="button button--primary survey__submit"
        /*
         * ★ 1問も答えていないなら送らせない。空の回答を受けても記録は増えず、
         * 「送ったのに何も増えない」だけになる。スキップの導線が別にある。
         */
        disabled={busy || answeredCount === 0}
        onClick={() => onSubmit(answers, note)}
      >
        {answeredCount === 0
          ? '答えを選んでください'
          : `この内容で送る（+${survey.pointsIfAnswered}pt）`}
      </button>

      {/*
        ★ スキップの出口を必ず置く。答えられない場所・答えたくない場所はある。
        押しにくくはするが、隠さない。
      */}
      <button type="button" className="button button--ghost survey__skip" onClick={onSkip}>
        今回は答えずにクイズへ
      </button>
    </section>
  )
}

function Head({
  survey,
  onClose,
}: {
  survey: SurveyResponse
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="panel__head">
      <div>
        <p className="panel__category">
          {/* ★ 何のための質問なのかを先に出す。「アンケート」だけでは作業に見える */}
          <span className="survey__badge">現地チェック</span> {survey.spotName}
        </p>
        <h2 className="panel__title">{survey.title}</h2>
      </div>
      <button type="button" className="button button--ghost" onClick={onClose} aria-label="閉じる">
        ×
      </button>
    </div>
  )
}

/** 選択肢の文言。「はい／いいえ」ではなく現物の言葉を出す（後から読める記録にする） */
function labelOf(field: SurveyFieldView, value: SurveyValue | undefined): string {
  switch (value) {
    case 'yes':
      return field.yesLabel
    case 'no':
      return field.noLabel
    case 'unknown':
      return 'わからない'
    default:
      return '未回答'
  }
}

function omit(
  answers: Record<string, SurveyValue>,
  fieldKey: string,
): Record<string, SurveyValue> {
  const next = { ...answers }
  delete next[fieldKey]
  return next
}
