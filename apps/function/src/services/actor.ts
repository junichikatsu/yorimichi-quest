import type { UserId } from '@imanouchi/shared'

/**
 * この操作を行っているのは誰か。
 *
 * ★ 「ゲストかどうか」を真偽値で持たない。真偽値だと `userId` が空文字や
 * ダミー値で渡る余地が残り、**ゲストの記録が誰かの行として書かれうる**。
 * ゲストには userId を持たせない形にして、型で不可能にしている。
 *
 * ★ ゲストが通れるのは許可制のゲート（middleware/auth.ts）を抜けた経路だけである。
 * その上で、書き込みを伴う処理は各サービスが `kind` を見て自分で分岐する。
 */
export type Actor = { kind: 'line'; userId: UserId } | { kind: 'guest' }
