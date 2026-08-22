interface StartGateProps {
  /** おためしを許すか（サーバー設定） */
  guestAvailable: boolean
  busy: boolean
  onLineLogin: () => void
  onGuest: () => void
  /** 直前の失敗の説明。LINE ログインが失敗して戻ってきた場合に出す */
  message: string
}

/**
 * 開き方の選択（LINE ログイン / おためし）。
 *
 * ★ LINE アプリの中では出さない。中で開いているならログインは済んでおり、
 * 選ばせる意味がない（呼び出し側で判定している）。
 *
 * ★ おためしを既定にしない。記録が残るほうが本来の姿であり、
 * 「あとで移せません」を先に伝えたうえで選ばせる。
 */
export function StartGate({
  guestAvailable,
  busy,
  onLineLogin,
  onGuest,
  message,
}: StartGateProps): React.JSX.Element {
  return (
    <div className="start">
      <div className="start__body">
        <h1 className="start__title">イマノウチ</h1>
        <p className="start__lead">
          歩いて集める防災データ。千代田区・港区の避難所・給水・AED・
          バリアフリートイレを地図で見て、歩いたところを記録します。
        </p>

        {message !== '' && (
          <p className="start__message" role="alert">
            {message}
          </p>
        )}

        <button
          type="button"
          className="button button--primary start__button"
          onClick={onLineLogin}
          disabled={busy}
        >
          LINE でログイン
        </button>
        <p className="start__note">歩いた記録が残り、次に開いたとき続けられます。</p>

        {guestAvailable && (
          <>
            <button
              type="button"
              className="button button--ghost start__button"
              onClick={onGuest}
              disabled={busy}
            >
              ログインせずに試す
            </button>
            {/*
              ★ できないことを先に書く。あとで「記録が消えた」と気づくほうが悪い。
              おためしはサーバーへ何も書かないので、端末を変えると引き継げない。
            */}
            <p className="start__note">
              地図と有事モードは同じように動きます。
              <strong>歩いた記録はこの端末の中だけに残り</strong>、
              ログインしても引き継げません。
            </p>
          </>
        )}
      </div>
    </div>
  )
}
