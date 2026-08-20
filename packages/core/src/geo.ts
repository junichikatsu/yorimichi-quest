export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6_371_008.8

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** 2点間の距離（m）。Haversine 公式。 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 緯度1度あたりの距離（m）。緯度によらずほぼ一定 */
const M_PER_DEG_LAT = 111_320

/**
 * 現在地から東西・南北へ指定メートル動かした座標を返す。
 *
 * 経度1度あたりの距離は緯度によって縮むため、cos(緯度) で補正する。
 * これを忘れると、日本付近では東西方向の移動量が実際より約2割大きくなる。
 *
 * 数十〜数百メートルの移動を想定した近似で、極付近や数百km規模の移動には使わない。
 */
export function offsetByMeters(origin: LatLng, eastM: number, northM: number): LatLng {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos(toRadians(origin.lat))
  return {
    lat: origin.lat + northM / M_PER_DEG_LAT,
    // 極付近で 0 除算にならないよう下限を置く
    lng: origin.lng + eastM / Math.max(1, mPerDegLng),
  }
}

/** 表示用の距離文字列（1km 以上は km 表記） */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

/** 表示用の面積文字列（0.01km² 以上は km² 表記） */
export function formatArea(squareMeters: number): string {
  if (squareMeters < 10_000) return `${Math.round(squareMeters)}m²`
  return `${(squareMeters / 1_000_000).toFixed(2)}km²`
}
