import type { GuestId, UserId } from '@imanouchi/shared'

export interface AppEnv {
  Variables: {
    /**
     * LINE ログイン済みのユーザーID。
     *
     * ★ おためし（ゲスト）では**入らない**。ここを読むルートは、
     * ゲストからは呼べない（許可制のゲートで弾いている：middleware/auth.ts）。
     */
    userId: UserId
    /** おためし利用のID。データストアへは書かない。レート制限とログの単位 */
    guestId: GuestId
  }
}
