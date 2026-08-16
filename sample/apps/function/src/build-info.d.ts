/**
 * esbuild の define でビルド時に埋め込む値。
 *
 * ローカル起動（tsx）では定義されないため、参照側は必ず
 * `typeof __BUILD_INFO__ !== 'undefined'` で存在を確認すること。
 */
declare const __BUILD_INFO__: {
  version: string
  commit: string
  builtAt: string
}

declare const __STATIC_ASSETS__: Record<
  string,
  {
    contentType: string
    /** テキストは utf8、バイナリは base64 で埋め込む（define は JSON なので文字列しか持てない） */
    encoding: 'utf8' | 'base64'
    body: string
  }
>
