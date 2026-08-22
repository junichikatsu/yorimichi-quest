import type { QuizAnswerResponse, QuizPrompt } from '@imanouchi/shared'
import { useState } from 'react'

interface QuizPanelProps {
  spotName: string
  quiz: QuizPrompt
  alreadyCleared: boolean
  result: QuizAnswerResponse | undefined
  busy: boolean
  onAnswer: (choiceIndex: number) => void
  onRetry: () => void
  onClose: () => void
}

/**
 * 現地の防災クイズ（FR-04）。
 *
 * ★ 設計原則 G-7 に従い、**不正解でもペナルティを与えず、必ず解説を出して
 * 即座に再挑戦できる**。「間違えた人を弾く」のではなく「間違えた人に
 * 学んでもらう」ための画面である。
 *
 * ★ 演出やロードで待たせない。回答直後に操作権を戻す（FR-04-6）。
 * 正解を表示するためにアニメーションを挟むと、歩きながら遊ぶ前提が崩れる。
 */
export function QuizPanel({
  spotName,
  quiz,
  alreadyCleared,
  result,
  busy,
  onAnswer,
  onRetry,
  onClose,
}: QuizPanelProps): React.JSX.Element {
  const [selected, setSelected] = useState<number | undefined>(undefined)
  const answered = result !== undefined

  const handleRetry = (): void => {
    setSelected(undefined)
    onRetry()
  }

  return (
    <section className="panel panel--quiz" aria-label="防災クイズ">
      <div className="panel__head">
        <div>
          {/* ★ クイズであることを目立たせる。チェックインの付属物ではない（FR-04・G-8） */}
          <p className="panel__category">
            <span className="quizcta__badge">防災クイズ</span> {spotName}
          </p>
          <h2 className="panel__title">{quiz.question}</h2>
        </div>
        <button type="button" className="button button--ghost" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      <ul className="quiz__options">
        {quiz.options.map((option, index) => {
          /*
           * ★ 正解と、自分が選んだ誤答の両方に印を付ける。
           * 正解だけを示すと、自分がどれを選んだか分からなくなる。
           */
          const isAnswer = answered && index === result.answerIndex
          const isPicked = index === selected
          const modifier = isAnswer
            ? ' quiz__option--answer'
            : answered && isPicked
              ? ' quiz__option--wrong'
              : ''

          return (
            <li key={option}>
              <button
                type="button"
                className={`quiz__option${modifier}`}
                disabled={answered || busy}
                onClick={() => {
                  setSelected(index)
                  onAnswer(index)
                }}
              >
                {option}
              </button>
            </li>
          )
        })}
      </ul>

      {answered && (
        <div
          className={`quiz__result quiz__result--${result.correct ? 'correct' : 'wrong'}`}
          role="status"
        >
          <p className="quiz__verdict">
            {/* 印は装飾。文言だけでも成立させる（読み上げでは二重に読まない） */}
            <span className="quiz__stamp" aria-hidden="true">
              {result.correct ? '◎' : '△'}
            </span>
            {result.correct ? '正解です' : 'おしい、もう一度'}
          </p>
          {/* ★ 正解・不正解のどちらでも解説を出す（FR-04-6） */}
          <p className="quiz__explanation">{result.explanation}</p>

          {result.pointsEarned > 0 && <p className="quiz__reward">+{result.pointsEarned}pt</p>}

          {result.canRetry && (
            <button type="button" className="button button--primary" onClick={handleRetry}>
              もう一度こたえる
            </button>
          )}
        </div>
      )}

      {alreadyCleared && !answered && (
        <p className="panel__note">
          このスポットのクイズは正解済みです。もう一度答えられますが、ポイントは増えません。
        </p>
      )}

      <p className="panel__note">
        まちがえてもポイントは減りません。解説を読んで、何度でも挑戦できます。
      </p>
    </section>
  )
}
