/**
 * ログ出力用のマスク。
 *
 * ユーザー ID をそのままログへ出さない。FE と BE の両方から使う。
 */
export function maskId(value: string): string {
  if (value.length <= 8) return '*'.repeat(value.length)
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}
