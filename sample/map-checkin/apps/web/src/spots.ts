import { distanceMeters } from '@map-checkin/core'
import type { SpotWithDistance } from '@map-checkin/shared'
import type { Position } from './hooks/useGeolocation.js'

/**
 * スポット一覧に現在地からの距離を付け直す。
 *
 * サーバーは位置を渡すと距離を計算して距離順に並べて返すが、**位置による絞り込みはしない**
 * （エリア内の全件を返す）。つまり位置が変わっても返ってくるスポットの顔ぶれは同じで、
 * 変わるのは distanceM と並び順だけである。
 *
 * この 2 つはクライアントでも同じ計算（`distanceMeters`）で出せるため、
 * 歩くたびに `GET /v1/spots` を叩き直す必要がない。
 * サーバーへの問い合わせは、他のユーザーの行動で checkinCount が動きうる分の
 * 定期同期だけで足りる。
 */
export function withLocalDistance(
  spots: SpotWithDistance[],
  position: Position | undefined,
): SpotWithDistance[] {
  if (!position) {
    // 位置が無いときはサーバーと同じく名前順にそろえる
    return [...spots]
      .map((spot) => ({ ...spot, distanceM: null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }

  return spots
    .map((spot) => ({ ...spot, distanceM: distanceMeters(position, spot) }))
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
}
