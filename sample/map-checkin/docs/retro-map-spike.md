# 地図のドット絵調表示（spike）

> 検討中の試作です。既定の表示には影響しません。本採用するかは実物を見てから決めます。
> 関連: [issue #11](https://github.com/junichikatsu/yorimichi-quest/issues/11)

## 使い方

URL に `?retro=1` を付ける。

```
http://localhost:3000/?retro=1
```

外すと元の表示に戻る。Mapbox のアクセストークンが未設定だと地図自体が出ない（一覧表示になる）ので、
このフラグも効かない。

## 何をしているか

「ドット絵調」は 3 つの独立した問題に分解できる。この spike は **1 と 2 だけ**を実装している。

| | 項目 | この spike | 実装 |
| :--- | :--- | :--- | :--- |
| 1 | 解像度（ドットの粗さ） | ✅ | `window.devicePixelRatio` の差し替え |
| 2 | 色（パレット） | ✅ | color-theme（3D LUT）でファミコンのパレットへ |
| 3 | 形・ディテール量 | ❌ | カスタムスタイル JSON、ラベルのフォント、マーカー、霧の形 |

3 に手を付けていないため、**道路やラベルの情報量は元のまま**。色と粒だけが変わる。

### 1. 解像度

Mapbox GL JS はキャンバスの大きさをこう決めている（`mapbox-gl-dev.js:107796`）。

```js
_resizeCanvas(width, height) {
  const pixelRatio = exported.devicePixelRatio || 1;
  this._canvas.width  = pixelRatio * Math.ceil(width);   // バッキングストア
  this._canvas.height = pixelRatio * Math.ceil(height);
  this._canvas.style.width  = `${width}px`;              // 表示上の大きさ
  ...
}
```

`exported.devicePixelRatio` は `window.devicePixelRatio` を毎回読む getter（`:9155`）で、
内部に保持していない。したがってここを差し替えると、**表示上の大きさはそのままでバッキングストアだけが粗くなる**。
あとは canvas に `image-rendering: pixelated` を当てれば最近傍で拡大されてドットが立つ。

比率はコンテナ幅から毎回計算していて、キャンバス幅がファミコンの横解像度 256px に寄るようにしている。
画面が大きいほどドットも大きくなるので、見た目の粗さは端末によらずだいたい揃う。

霧のキャンバスも同じ `window.devicePixelRatio` を読んでいるため、
何もしなくても地図と同じドットの粗さに揃う。

### 2. 色

Mapbox GL JS v3 の color-theme（3D LUT）を使う。
「この色が来たらこの色を出す」という変換テーブルなので、**スタイルのレイヤーを 1 つも書き換えずに**
基本地図まるごとを別のパレットへ寄せられる。

LUT はファミコンのパレット 55 色への最近傍写像として実行時に作り、`map.setColorTheme()` へ渡している。
アセットとしてリポジトリに置く必要はない（生成 26ms / base64 約 13KB）。

Mapbox が受け取る形式（`mapbox-gl-dev.js:80809-80817` で確認）:

- base64 の PNG（cube strip 形式）
- 高さ 32px 以下、幅は高さの 2 乗（32³ なら 1024×32）
- 渡すとタイルが全再読み込みされる

cube strip の軸の対応は `apps/web/src/retro/lut.ts` の `cubeStripInput` に切り出してある。
**色がおかしいときに最初に疑うのはここ**。根拠は Mapbox のシェーダ `applyLUT(lut, col)` が
`col.rbg` と入れ替えて 3D テクスチャを引いている点。

## ファイル

```
apps/web/src/retro/
  index.ts        フラグ判定と devicePixelRatio の差し替え
  lut.ts          cube strip LUT の生成
  nes-palette.ts  ファミコンのパレットと最近傍探索
  retro.test.ts   DOM を使わない部分のテスト
```

呼び出しは `apps/web/src/components/MapView.tsx`、`image-rendering` の指定は
`apps/web/public/styles.css` の `.map--retro`。

## 検証済みのこと

ヘッドレス Chrome で確認した（Mapbox のトークンが不要な範囲）。

- LUT は 1024×32 の PNG で、Mapbox の要件（高さ ≤ 32 / 幅 = 高さ²）を満たす
- 生成 26ms、base64 で約 13KB、一度だけ生成してキャッシュ
- 黒→黒、純赤→`#f83800`、純青→`#0000fc`、純緑→`#00b800`、白→`#fcfcfc` とパレットの色に落ちる
- LUT 全体に現れる色は 55 色ちょうど（パレット外の色が混ざっていない）
- 800px 幅のコンテナで `devicePixelRatio` が 0.32 になり、キャンバス幅が 256px になる
- 後始末を呼ぶと `devicePixelRatio` が元に戻る

## 未検証・確認したいこと

**実機と Mapbox のトークンが要るもの。**

- `streets-v12` で `setColorTheme` が効くか（ドキュメントは Mapbox Standard 前提の記述）
- 見た目として成立しているか。地図として読めるか
- スマートフォンでの描画性能。とくに霧の再描画と重なったとき
- 歩きながら見て酔わないか

## 既知の限界

- **アンチエイリアスが残る。** Mapbox の線描画はシェーダ内で AA をかけるので、
  低解像度バッファの中でもドット境界に中間色が出る。完全に潰すには自前の canvas へ
  取り込んでパレット量子化する工程（範囲外）が要る
- **LUT はレイヤー描画時に適用され、レイヤー間の合成より前。** 最終画像のポスタライズではない
- **マーカー・コントロール・帰属表示は DOM なので鮮明なまま。** 地図だけが粗くなるので浮いて見える。
  マーカーのドット絵化は範囲外
- **`window.devicePixelRatio` の差し替えは Mapbox の公開 API ではない。** 実装が変われば効かなくなる。
  `apps/web/src/retro/index.ts` の中だけで完結させてある

## Mapbox の利用条件

**ロゴの加工は禁止、帰属表示は可読でなければならない**（[Attribution requirements](https://docs.mapbox.com/help/getting-started/attribution/)）。

このため `.map__gl` のコンテナごと拡大縮小する実装は採れない。
ロゴ・帰属表示・ナビゲーションコントロールはキャンバスの兄弟要素なので、
**キャンバスだけを粗くする**現在の方式ならこの条件を満たす。

## 対外的な表記

「ファミコン」は任天堂の商標。公開する文言では「8bit 風」「レトロドット絵風」とする。
