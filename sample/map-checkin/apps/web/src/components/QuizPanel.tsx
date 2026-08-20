import { ITEM_DEFS, type QuizAnswerResponse, type QuizPrompt } from '@map-checkin/shared'
import { useState } from 'react'

interface QuizPanelProps {
  quiz: QuizPrompt
  alreadyCleared: boolean
  result: QuizAnswerResponse | undefined
  busy: boolean
  onAnswer: (choiceIndex: number) => void
  onRetry: () => void
  onClose: () => void
}

/**
 * 現地クイズ（FR-04）。
 *
 * 設計原則 G-7 に従い、**不正解でもペナルティを与えず、必ず解説を出して即座に再挑戦できる**。
 * 「間違えた人を弾く」のではなく「間違えた人に学んでもらう」ための画面。
 */
export function QuizPanel({
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
          <p className="panel__category">防災クイズ</p>
          <h2 className="panel__title">{quiz.question}</h2>
        </div>
        <button type="button" className="button button--ghost" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>

      <ul className="quiz__options">
        {quiz.options.map((option, index) => {
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
        <div className={`quiz__result quiz__result--${result.correct ? 'correct' : 'wrong'}`}>
          <p className="quiz__verdict">{result.correct ? '正解です' : 'おしい、もう一度'}</p>
          {/* 正解・不正解のどちらでも解説を出す（FR-04-6） */}
          <p className="quiz__explanation">{result.explanation}</p>

          {result.pointsEarned > 0 && <p className="quiz__reward">+{result.pointsEarned}pt</p>}

          {result.acquiredItem && (
            <p className="quiz__reward">
              {ITEM_DEFS[result.acquiredItem].name} を手に入れた！
              <span className="quiz__use">{ITEM_DEFS[result.acquiredItem].use}</span>
            </p>
          )}

          {result.canRetry && (
            <button type="button" className="button button--primary" onClick={handleRetry}>
              もう一度こたえる
            </button>
          )}
        </div>
      )}

      {alreadyCleared && !answered && (
        <p className="panel__note">
          このスポットのクイズは正解済みです。もう一度答えられますが、報酬は増えません。
        </p>
      )}

      <p className="panel__note">
        まちがえてもポイントは減りません。解説を読んで、何度でも挑戦できます。
      </p>
    </section>
  )
}
