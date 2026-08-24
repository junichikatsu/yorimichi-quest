import type { SpotCategory } from '@imanouchi/shared'

/**
 * 利用状況の計測（GA4・#82）。
 *
 * ★ **測定タグはここに無い。** 配信時に HTML へ差し込む（`apps/function/src/static.ts`）。
 * 測定IDは環境変数なので、バンドルにも画面のコードにも入らない。
 *
 * ★ **タグが無い状態が正常である。** `GA_MEASUREMENT_ID` 未設定なら計測タグは
 * 1バイトも出ないので `gtag` も存在しない。ローカル開発とテストは常にこの状態で、
 * 呼び出し側に条件を書かせない（何も送らずに返る）。
 *
 * ★ **送っていいのは「何が起きたか」だけである。**
 * 用途ごとに関数を切ってあるのは、呼び出し側が中身を自由に組めないようにするため。
 * 次のものは**渡す口を用意していない**。
 *
 * | 送らないもの | なぜ |
 * | :--- | :--- |
 * | LINE の userId・表示名 | 個人を識別できる。計測に要らない |
 * | 緯度経度（丸めた値も） | 同意画面で「移動の軌跡そのものは保存しません」と書いている。外へ送れば矛盾する |
 * | スポットの個別ID | どこに居るかが分かる。`category` までで足りる |
 */

/** GA4 へ渡せる値。オブジェクトも配列も入れない（中身が増えると送る内容が読めなくなる） */
type EventParams = Record<string, string | number | boolean>

/**
 * 計測タグが定義するグローバル関数。
 *
 * ★ `window` ではなく `globalThis` を見る。タグは古典スクリプトで `function gtag()` を
 * 宣言するので、ブラウザではどちらでも同じものを指す。`globalThis` にしておくと
 * **画面のない環境（テスト）でも同じ経路を通せる**。
 */
function sink(): ((command: 'event', name: string, params?: EventParams) => void) | undefined {
  const fn = (globalThis as { gtag?: unknown }).gtag
  return typeof fn === 'function'
    ? (fn as (command: 'event', name: string, params?: EventParams) => void)
    : undefined
}

function send(name: string, params?: EventParams): void {
  const gtag = sink()
  if (!gtag) return

  try {
    gtag('event', name, params)
  } catch {
    /*
     * ★ 計測の失敗でアプリを止めない。通信が細い場所・広告ブロッカー・
     * WebView の制限で落ちうるが、いずれも遊べなくする理由にはならない。
     */
  }
}

/**
 * 起動（セッションが確立したところ）。
 *
 * ★ 入口の別を持たせる。LINE から来たのか、ブラウザのおためしなのかで
 * **配布チャネルの効き方が変わる**（#82）。
 */
export function trackAppStart(mode: 'line' | 'guest'): void {
  send('app_start', { mode })
}

/** チェックインの成功。実際に現地まで行ったかが分かる */
export function trackCheckin(category: SpotCategory): void {
  send('checkin', { category })
}

/**
 * 現地確認アンケートの送信。
 *
 * ★ **このサービスが集めたいものは、ここでしか増えない。** 起動数より先に
 * この数を見る（チェックインとクイズは行政データを1件も増やさない）。
 */
export function trackSurveyAnswered(): void {
  send('survey_answered')
}

/** 防災クイズの回答。正誤も送る（学習まで進んでいるかを見る） */
export function trackQuizAnswered(correct: boolean): void {
  send('quiz_answered', { correct })
}

/** 有事モードの切替（FR-08-1）。デモで何が見られているかが分かる */
export function trackEmergencyMode(on: boolean): void {
  send('emergency_mode', { on })
}
