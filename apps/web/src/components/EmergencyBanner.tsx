interface EmergencyBannerProps {
  onExit: () => void
}

/**
 * 有事モードであることの表示（FR-08-2）。
 *
 * ★ 「デモ表示であり実際の災害情報ではない」を**常時**出す。消してはいけない。
 *
 * 防災アプリが災害の発生を思わせる画面を出すことは、それ自体が危険である。
 * 切替はデモ用のスイッチであり（FR-08-1）、災害情報 API との連動は対象外
 * （FR-08-6）なので、この画面は**何も検知していない**。
 * 検知していないものを検知したように見せない。
 */
export function EmergencyBanner({ onExit }: EmergencyBannerProps): React.JSX.Element {
  return (
    <div className="emergency-banner" role="alert">
      <div className="emergency-banner__text">
        <p className="emergency-banner__title">有事モード（デモ表示）</p>
        <p className="emergency-banner__note">
          実際の災害情報ではありません。動作確認のための切替です。
        </p>
      </div>
      <button type="button" className="emergency-banner__exit" onClick={onExit}>
        平時に戻す
      </button>
    </div>
  )
}
