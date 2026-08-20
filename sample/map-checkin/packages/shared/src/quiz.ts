import { z } from 'zod'
import type { ItemKey } from './item.js'

/**
 * クイズ（FR-04）。
 *
 * ★ この共有パッケージには**正解を置かない**。
 * shared はフロントエンドのバンドルにそのまま含まれるため、ここに正解を書くと
 * 配信された JavaScript を開けば答えが読める。出題データ本体（正解つき）は
 * サーバー側の `apps/function/src/data/quiz-bank.ts` に置き、採点もサーバーで行う。
 */

export const QUIZ_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/

/** 出題。選択肢だけを返し、どれが正解かは含めない */
export interface QuizPrompt {
  quizId: string
  question: string
  options: string[]
  /** LLM 生成か固定データか。MOCK_MODE では常に 'fixture' */
  generatedBy: 'fixture' | 'llm'
}

export const quizAnswerRequestSchema = z.object({
  quizId: z.string().regex(QUIZ_ID_PATTERN),
  choiceIndex: z.number().int().min(0).max(9),
})

export type QuizAnswerRequest = z.infer<typeof quizAnswerRequestSchema>

export interface QuizAnswerResponse {
  correct: boolean
  /** 正解の選択肢。不正解でも返す（FR-04-6：必ず解説を見せる） */
  answerIndex: number
  /** 正解・不正解のどちらでも表示する解説 */
  explanation: string
  pointsEarned: number
  totalPoints: number
  /** 今回はじめて手に入れたアイテム。既に持っていた場合や不正解なら undefined */
  acquiredItem: ItemKey | undefined
  /**
   * 再挑戦できるか。
   * FR-04-6 によりペナルティを課さないため、不正解なら常に true を返す。
   */
  canRetry: boolean
}
