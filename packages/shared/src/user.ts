import type { UserId } from './ids.js'

/**
 * ユーザー（FR-01）。
 *
 * LINE のプロフィール（表示名・アイコン）は**都度 LINE から取り直さず、
 * ログイン時に受け取った値を保存して使う**（FR-01-2）。
 * 表示のたびに外部APIを叩くと、LINE 側の障害でアプリが表示できなくなる。
 */
export interface UserProfile {
  userId: UserId
  /** LINE の表示名。空文字はありうる（LINE 側で未設定の場合） */
  displayName: string
  /** LINE のアイコンURL。未設定なら空文字 */
  pictureUrl: string
  /** 累計ポイント（FR-01-3） */
  totalPoints: number
  /**
   * 獲得した称号（FR-01-3）。
   *
   * 付与の条件は FR-07 で決める。ここでは**保持する場所だけ**を用意している。
   */
  titles: string[]
  /**
   * 位置情報の利用に同意した日時（FR-01-4）。
   *
   * ★ undefined は「まだ同意していない」を意味する。
   * これが無いとクライアントは同意画面を出すか出さないかを判断できない。
   * 同意は撤回されうるので、真偽値ではなく日時で持つ。
   */
  locationConsentAt: string | undefined
  createdAt: string
  lastActiveAt: string
}

/** クライアントへ返す形。内部だけの項目は今のところ無いが、境界は分けておく */
export interface UserView {
  userId: UserId
  displayName: string
  pictureUrl: string
  totalPoints: number
  titles: string[]
  /** 同意済みかどうか。日時そのものは画面で使わないので真偽値に落とす */
  locationConsentGiven: boolean
  createdAt: string
}

export function toUserView(profile: UserProfile): UserView {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl,
    totalPoints: profile.totalPoints,
    titles: profile.titles,
    locationConsentGiven: profile.locationConsentAt !== undefined,
    createdAt: profile.createdAt,
  }
}
