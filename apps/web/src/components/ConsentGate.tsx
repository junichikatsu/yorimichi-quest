interface ConsentGateProps {
  displayName: string
  busy: boolean
  onAgree: () => void
}

/**
 * 位置情報の同意（FR-01-4）。
 *
 * ★ 同意を得るまで、ブラウザの位置情報 API を呼ばない。
 * OS の許可ダイアログが先に出ると、「何のために使うのか」を説明する前に
 * 判断させることになる。順序が逆になっている実装が多いが、ここは守る。
 *
 * ★ 何に使うかを具体的に書く。「サービス向上のため」では同意にならない。
 */
export function ConsentGate({ displayName, busy, onAgree }: ConsentGateProps): React.JSX.Element {
  return (
    <section className="consent" aria-label="位置情報の利用について">
      <h1 className="consent__title">
        {displayName === '' ? 'ようこそ' : `${displayName} さん、ようこそ`}
      </h1>

      <p className="consent__lead">
        イマノウチは、歩いて防災データを集めるアプリです。現在地を使います。
      </p>

      <dl className="consent__uses">
        <div>
          <dt>何に使うか</dt>
          <dd>近くの避難所・AED・バリアフリートイレ・給水スポットを地図に出すため</dd>
        </div>
        <div>
          <dt>どこまで送るか</dt>
          <dd>地図の表示と距離の計算に使います。移動の軌跡そのものは保存しません</dd>
        </div>
        <div>
          <dt>やめられるか</dt>
          <dd>いつでも取り消せます。端末側の設定でも止められます</dd>
        </div>
      </dl>

      <button type="button" className="button button--primary" disabled={busy} onClick={onAgree}>
        同意して始める
      </button>

      <p className="consent__note">
        同意しない場合も、スポットの一覧は見られます（距離は表示されません）。
      </p>
    </section>
  )
}
