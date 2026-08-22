interface SheetProps {
  /**
   * 何を出している板か。
   *
   * - `spot`: スポット詳細。**地図を隠さない**（暗幕を敷かず、外側は地図に触れる）
   * - `quiz`: 防災クイズ。答えるための面なので暗幕を敷いて他を触らせない
   */
  kind: 'spot' | 'quiz'
  /** 読み上げ用の名前 */
  label: string
  children: React.ReactNode
}

/**
 * 画面に重ねる板（FR-02-2・FR-04-1）。
 *
 * ★ サイドバーの中に置いてはいけないものを、ここに寄せる。**スマホでは
 * サイドバーが地図の下に積まれるため、選んでも押しても画面の外に出る。**
 * 実際にそうなった（ピンを押しても何も起きないように見え、チェックインしても
 * 出題があることに気づけない）。
 *
 * ★ 別画面にはしない。重ねるだけなので地図は作り直されず、閉じれば中心と
 * 縮尺はそのまま残る。画面遷移にすると、戻ったときに見ていた場所を失う。
 *
 * ★ 下寄せにする（広い画面のクイズだけ中央）。片手で持ったときに、押すものが
 * 親指の届く側へ来る（NFR-08）。
 *
 * ★ 重ね方を1か所に置く理由: 「暗幕を敷くか」「外側が触れるか」「どれが前に
 * 出るか」は板ごとに違う。画面ごとに書くと、**片方だけ直して食い違う。**
 */
export function Sheet({ kind, label, children }: SheetProps): React.JSX.Element {
  return (
    <div
      className={`sheet sheet--${kind}`}
      role="dialog"
      /*
       * ★ 暗幕を敷く板だけ aria-modal を立てる。スポット詳細は外側の地図を
       * そのまま触れるので、閉じ込めていると伝えるのは嘘になる。
       */
      aria-modal={kind === 'quiz' ? true : undefined}
      aria-label={label}
    >
      <div className="sheet__body">{children}</div>
    </div>
  )
}
