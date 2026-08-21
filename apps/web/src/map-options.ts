import type { AreaSummary } from '@imanouchi/shared'
import type { MapOptions } from 'mapbox-gl'

/**
 * 地図の初期設定（FR-02-1）。
 *
 * ★ `container` 以外を純粋な関数に切り出してある。**言語と投影法はどちらも
 * 外れても地図が表示されてしまう**ため、検査で固定したい。
 * 前者は表記が英語に戻り、後者は霧の半径がずれる。どちらも見て気づきにくい。
 */

export const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

/**
 * 地名の言語。
 *
 * ★ 既定では英語表記になる（"Tokyo Station" 等）。千代田区・港区を歩く日本語の
 * サービスで英語の地名が出ると、現地の看板と突き合わせられない。
 *
 * クラシックスタイル（streets-v12）でもこの指定は効く。ラベルのレイヤーを
 * 1 枚ずつ `text-field` で書き換える必要はない（GL JS v2.11 以降）。
 * 端末の言語設定には従わせない。日本語のサービスとして固定する。
 */
const LANGUAGE = 'ja'

/**
 * 漢字・かなを描くフォント。
 *
 * ★ 指定しないと `sans-serif` で描かれる。本文（styles.css）と揃えないと、
 * 地図の中だけ別の書体になる。CJK は端末側のフォントで描かれるため、
 * ここで並べたものが実際に使われる。
 */
const LOCAL_IDEOGRAPH_FONTS =
  "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', Meiryo, sans-serif"

/**
 * 地図の操作部品の文言。
 *
 * ★ 読み上げと PC のツールチップに出る。ここを訳さないと、日本語の画面の中で
 * 拡大・縮小だけが "Zoom in" になる（NFR-08）。
 */
const LOCALE = {
  'NavigationControl.ZoomIn': '拡大',
  'NavigationControl.ZoomOut': '縮小',
  'NavigationControl.ResetBearing': '北を上に戻す',
  'AttributionControl.ToggleAttribution': '出典を表示',
  'LogoControl.Title': 'Mapbox のロゴ',
  'Map.Title': '地図',
  'ScrollZoomBlocker.CtrlMessage': 'Ctrl キーを押しながらスクロールすると拡大・縮小します',
  'ScrollZoomBlocker.CmdMessage': '⌘ キーを押しながらスクロールすると拡大・縮小します',
  'TouchPanBlocker.Message': '2 本指で地図を動かせます',
}

/**
 * `container` を除いた地図の初期設定。
 *
 * ★ 帰属表示（`attributionControl`）を消さない。Mapbox の利用規約で必須であり、
 * 提出資料のスクリーンショットにも写っている必要がある（FR-02-6）。
 */
export function mapOptions(area: AreaSummary): Omit<MapOptions, 'container'> {
  return {
    style: MAP_STYLE,
    // 測位できるまではエリア中心。位置が届いたら追従で現在地へ移す
    center: [area.center.lng, area.center.lat],
    zoom: area.zoom,
    /*
     * ★ 霧の半径計算がメルカトル前提（MapView の metersToPixels）。
     * 既定の globe のままだと低ズームで半径がずれる。
     */
    projection: 'mercator',
    attributionControl: true,
    language: LANGUAGE,
    localIdeographFontFamily: LOCAL_IDEOGRAPH_FONTS,
    locale: LOCALE,
  }
}
