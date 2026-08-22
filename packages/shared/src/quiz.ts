import { z } from 'zod'
import type { CardView } from './card.js'

/**
 * クイズ（FR-04）。
 *
 * ★ この共有パッケージには**正解を置かない**。
 * shared はフロントエンドのバンドルにそのまま含まれるため、ここに正解を書くと
 * 配信された JavaScript を開けば答えが読める。出題データ本体（正解つき）は
 * サーバー側の `apps/function/src/data/quiz-bank.ts` に置き、採点もサーバーで行う。
 */

/** 出題データのキー。固定データも生成結果も同じ形にそろえる */
export const QUIZ_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/

export function isQuizId(value: string): boolean {
  return QUIZ_ID_PATTERN.test(value)
}

/**
 * 出題。**選択肢だけを返し、どれが正解かは含めない。**
 *
 * ★ `generatedBy` を持たせているのは、Dify のクイズ生成（AI-3・FR-04-2）へ
 * 差し替えたときに、画面と運用で「どちらで出ているか」が分かるようにするため。
 * 生成が落ちて固定データに落ちたことに気づけないと、生成の不具合が隠れる。
 */
export interface QuizPrompt {
  quizId: string
  question: string
  options: string[]
  /** 固定データか、Dify 生成か */
  generatedBy: 'fixture' | 'llm'
}

/**
 * 出題の種類（FR-04-7 / 設計原則 G-8）。
 *
 * `action` は「まず何をするか」を問うもの、`knowledge` は設備・備蓄などモノや
 * 情報を問うもの。**行動を先に出す**ため、選ぶときは action を優先する。
 */
export const QUIZ_KINDS = ['action', 'knowledge'] as const

export type QuizKind = (typeof QUIZ_KINDS)[number]

export const quizAnswerRequestSchema = z.object({
  quizId: z.string().regex(QUIZ_ID_PATTERN),
  /** 選択肢の番号。範囲は出題側の選択肢数で改めて検査する */
  choiceIndex: z.number().int().min(0).max(9),
})

export type QuizAnswerRequest = z.infer<typeof quizAnswerRequestSchema>

export interface QuizAnswerResponse {
  correct: boolean
  /** 正解の選択肢。**不正解でも返す**（FR-04-6：必ず解説を見せる） */
  answerIndex: number
  /** 正解・不正解のどちらでも表示する解説（FR-04-6） */
  explanation: string
  pointsEarned: number
  /**
   * 加点後の累計ポイント。
   *
   * ★ おためし（ゲスト）では 0 が返る。サーバーが累計を持たないためである。
   * 画面は `saved` を見て、端末に持っている累計へ加算する。
   */
  totalPoints: number
  /**
   * 再挑戦できるか。
   *
   * FR-04-6 によりペナルティを課さないため、不正解なら常に true を返す。
   */
  canRetry: boolean
  /**
   * 今回はじめて達成したカード（FR-14）。
   *
   * ★ **「今回の新規」はサーバーが判定する。** クライアントが前回の一覧と差分を
   * 取る作りにすると、再読み込みで演出が消えたり二重に出たりする。
   * 何も増えなければ空配列。
   */
  acquiredCards: CardView[]
  /**
   * この結果をサーバーが保存したか。
   *
   * ★ おためし（ゲスト）では false。採点はサーバーで行うが、
   * 記録は端末の中だけに置く（サーバーへは書かない）。
   */
  saved: boolean
}
