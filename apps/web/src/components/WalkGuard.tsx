interface WalkGuardProps {
  /** 直近の速度（km/h）。歩いていることが伝わるように出す */
  speedKmh: number
  /** 開放済みの町丁目の数。歩いた成果が「見なくても増えている」ことを示す */
  unlockedCount: number
  /** 音を鳴らせているか。鳴らせないなら知らせが届かないので、そう書く */
  soundReady: boolean
  /** 「今すぐ見る」。歩いていても本人が必要なら開けなければならない */
  onDismiss: () => void
}

/**
 * 歩行中の操作止め（FR-02-9・NFR-14）。
 *
 * 歩いていることを検出したら地図を覆い、操作を受け付けない。
 * 「歩きながら見ないでください」と書くだけでは足りない。**見られる状態を残さない。**
 *
 * ★ ただし閉じ込めてはいけない。測位が乱れれば止まっているのに歩行中と判定される
 * ことがあり、そのとき開けなくなると地図が使えないアプリになる。
 * 「今すぐ見る」で必ず抜けられるようにしてある（抜けたあとは、止まるまで再表示しない）。
 *
 * ★ 進捗は音で伝える（FR-02-10）。覆っている最中に画面へ成果を出しても意味がない。
 */
export function WalkGuard({
  speedKmh,
  unlockedCount,
  soundReady,
  onDismiss,
}: WalkGuardProps): React.JSX.Element {
  return (
    <div className="walkguard" role="alertdialog" aria-label="歩行中">
      <div className="walkguard__body">
        <p className="walkguard__title">歩いている間は画面を見ないでください</p>

        <p className="walkguard__lead">
          このまま<strong>ポケットに入れて歩けます</strong>。
          歩いたところは記録され続けます。
        </p>

        <dl className="walkguard__stats">
          <div>
            <dt>いまの速さ</dt>
            <dd>{speedKmh.toFixed(1)} km/h</dd>
          </div>
          <div>
            <dt>歩ききった町丁目</dt>
            <dd>{unlockedCount}</dd>
          </div>
        </dl>

        <p className="walkguard__note">
          {soundReady
            ? '町丁目を歩ききると音でお知らせします。立ち止まると自動で戻ります。'
            : '音が使えないため、お知らせは画面だけになります。立ち止まると自動で戻ります。'}
        </p>

        <button type="button" className="button button--ghost walkguard__dismiss" onClick={onDismiss}>
          今すぐ見る
        </button>
        <p className="walkguard__caution">立ち止まってから操作してください。</p>
      </div>
    </div>
  )
}
