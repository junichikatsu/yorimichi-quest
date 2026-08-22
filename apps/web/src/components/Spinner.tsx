interface SpinnerProps {
  /** 帯の中や文字の隣に置く小さい版か */
  small?: boolean
}

/**
 * 待っていることを示す輪。
 *
 * ★ **1か所に置く。** 待つ場面は増える（起動・ログイン・チェックイン・設問の
 * 読み込み・送信・カードの一覧…）。場面ごとに描くと、同じ「待ち」が違う見た目に
 * なって、待っているのか壊れているのか読み手が判断できなくなる。
 *
 * ★ これは装飾である。**必ず文字を添えること**（読み上げでは何も読まれない）。
 * 色や動きだけに意味を持たせない（NFR-08）。
 *
 * ★ 動きは CSS 側で `prefers-reduced-motion` に従って止める。止まっても輪は残す
 * （消すと、何かが起きている最中だという手がかりが無くなる）。
 */
export function Spinner({ small = false }: SpinnerProps): React.JSX.Element {
  return <span className={small ? 'spinner spinner--small' : 'spinner'} aria-hidden="true" />
}
