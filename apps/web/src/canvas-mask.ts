/**
 * 作った形（マスク）をキャンバスへ当てる（#72）。
 *
 * ★ **図形ごとに `destination-in` を当ててはいけない。** この合成は描画のたびに
 * 「その形の外」を消すため、図形を2つ以上描くと**全部の交差**しか残らない。
 * 歩いたところは何十個もの円と区画でできているので、結果はほぼ空になる。
 *
 * ★ 霧（`destination-out`）は消しが足し合わさるので、同じ書き方でも動いてしまう。
 * **そのせいで「霧は晴れているのにハザードだけ出ない」という形で不具合を出した。**
 * だから形は別のキャンバスに1枚作り、ここで**1回だけ**当てる。
 *
 * ★ 呼ぶ側の合成モードを壊さない。戻してから返る（呼び出しの順序に依存させない）。
 */

/** 当てられる合成モード。ここに増やすときは「1回で当たるか」を必ず確かめること */
export type MaskMode = 'destination-in' | 'destination-out'

/** キャンバスの文脈のうち、ここで使うところだけ（テストのために最小にしてある） */
export interface MaskTarget {
  globalCompositeOperation: GlobalCompositeOperation
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void
}

export function applyMask(
  ctx: MaskTarget,
  mask: CanvasImageSource,
  mode: MaskMode,
  width: number,
  height: number,
): void {
  const previous = ctx.globalCompositeOperation
  ctx.globalCompositeOperation = mode
  ctx.drawImage(mask, 0, 0, width, height)
  ctx.globalCompositeOperation = previous
}
