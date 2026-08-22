import type { QuizAnswerResponse, QuizPrompt } from '@imanouchi/shared'
import { useEffect, useRef, useState } from 'react'

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
 *
 * ★ 画面に重ねて出す（重ね方は `Sheet` に寄せてある）。サイドバーの中に置くと、
 * **スマホでは地図の下に積まれて画面の外にあり、チェックインしても出題がある
 * ことに気づけない**（実際にそうなった）。
 *
 * ★ 外側を触っても閉じない（`Sheet` が暗幕で受け止める）。**解説を読み終える
 * 前に消えては困る**（誤って触れただけで学ぶ機会が消える）。閉じるのは × と
 * 「地図にもどる」だけにする。
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

  /*
   * 答えたら解説まで送る。
   *
   * ★ 結果は選択肢の**下**に出る。板の高さが足りないと画面の外に出るので、
   * 「答えたのに何も起きていない」ように見える。解説を必ず見せる設計
   * （FR-04-6）は、解説が見えるところに無ければ成立しない。
   *
   * ★ 動きは付けない（`behavior` を指定しない＝即座に送る）。動きを減らす
   * 設定を尊重するため（NFR-08）で、ここは演出ではなく位置合わせである。
   */
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!answered) return
    resultRef.current?.scrollIntoView({ block: 'nearest' })
  }, [answered])

  const handleRetry = (): void => {
    setSelected(undefined)
    onRetry()
  }

  return (
    <section className="panel panel--quiz">
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
          ref={resultRef}
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

      {/*
        ★ 読み終えたあとの出口を大きく置く。× だけだと、重ねて出している以上
        「どうやって地図に戻るのか」が分からない（× は小さく、位置も上端である）。
      */}
      {answered && (
        <button type="button" className="button button--ghost quiz__back" onClick={onClose}>
          地図にもどる
        </button>
      )}
    </section>
  )
}
