import { useEffect, useRef } from 'react'

/**
 * 一定時間で自分から消える演出の時計。
 *
 * ★ **これは実機だけで起きた不具合の修正である。** 演出（ポイント・カード・帯）は
 * それぞれが `setTimeout` を張っていたが、依存配列に `onDone` を入れていた。
 * 親は `onDone={() => setBurst(undefined)}` のように**毎回新しい関数**を渡すため、
 * 親が描き直されるたびに効果が張り直され、`clearTimeout` → `setTimeout` で
 * **時計が最初から数え直しになっていた。**
 *
 * ★ 手元では気づけない。実機では `watchPosition` が1秒ほどごとに位置を返し、
 * そのたびに新しい座標オブジェクトが入って親が描き直される。**描き直しの間隔が
 * 演出の表示時間（1.8〜3.2秒）より短いので、時計は永久に終わらない。**
 * 結果、ポイントの表示が出たまま消えず、次のカードもアンケートも出てこない。
 * 端末をスリープさせると測位が止まり、描き直しも止まって時計が満了する——
 * だから「スリープして戻したらアンケートが出た」。
 *
 * ★ 直し方は**呼び出し側に頼らない**形にする。`useCallback` で包んでもらう手も
 * あるが、包み忘れれば同じ不具合が戻る。**演出の側で親の関数の同一性に依存しない
 * ようにする**（最新の関数を ref に持ち、時計は張り直さない）。
 * 同じ考え方は `MapView` の `checkinHandlerRef` でも使っている。
 *
 * @param onDone  時間が来たら呼ぶ。**毎回新しい関数でよい**
 * @param delayMs 出しておく時間
 * @param resetKey これが変わったときだけ数え直す。**演出の中身**を渡すこと
 *                 （2件目が1件目の残り時間で消えるのを防ぐ）
 */
export function useAutoDismiss(onDone: () => void, delayMs: number, resetKey: unknown): void {
  /*
   * ★ 最新の関数を持つ。描画中に代入せず、効果の中で入れ替える
   * （下の時計の効果より先に宣言してあるので、時計が動く前に最新になっている）。
   */
  const latest = useRef(onDone)
  useEffect(() => {
    latest.current = onDone
  }, [onDone])

  useEffect(() => {
    // ★ `latest.current` を呼ぶ。`onDone` を直接渡すと依存に入れざるを得なくなる
    const timer = setTimeout(() => latest.current(), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs, resetKey])
}
