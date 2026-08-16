import { asAreaId, asSpotId, type Spot } from '@map-checkin/shared'

/**
 * ★ サンプルデータです。実在のオープンデータではありません。
 *
 * 都心の実在する公共スペースを題材に、おおよその座標で作った**デモ用の固定データ**。
 * 設備の有無・属性はすべて架空で、避難所指定の有無や実際のバリアフリー状況を表すものではありません。
 * 本番では FR-10-1 のオープンデータ（東京都防災マップ避難所一覧、自治体標準オープンデータセット等）を
 * 取込・正規化して置き換えます。
 */
const AREA_ID = asAreaId('chiyoda')
const SOURCE = 'sample-fixture'
const FETCHED_AT = '2026-08-16'

interface SampleSpotSeed {
  id: string
  name: string
  category: Spot['category']
  lat: number
  lng: number
  address: string
  attributes: string[]
}

const SEEDS: SampleSpotSeed[] = [
  {
    id: 'sample-hibiya-park',
    name: '日比谷公園（サンプル避難場所）',
    category: 'shelter',
    lat: 35.6739,
    lng: 139.7568,
    address: '東京都千代田区日比谷公園（サンプル）',
    attributes: ['広域避難場所', '車いす対応', 'ペット同伴可'],
  },
  {
    id: 'sample-kokyo-gaien',
    name: '皇居外苑（サンプル避難場所）',
    category: 'shelter',
    lat: 35.681,
    lng: 139.757,
    address: '東京都千代田区皇居外苑（サンプル）',
    attributes: ['車いす対応', '大規模スペース'],
  },
  {
    id: 'sample-kitanomaru-park',
    name: '北の丸公園（サンプル避難場所）',
    category: 'shelter',
    lat: 35.691,
    lng: 139.75,
    address: '東京都千代田区北の丸公園（サンプル）',
    attributes: ['車いす対応'],
  },
  {
    id: 'sample-chiyoda-cityhall',
    name: '千代田区役所（サンプル避難所）',
    category: 'shelter',
    lat: 35.694,
    lng: 139.7536,
    address: '東京都千代田区九段南（サンプル）',
    attributes: ['エレベーターあり', '車いす対応', '要配慮者スペース'],
  },
  {
    id: 'sample-tokyo-station-aed',
    name: '東京駅丸の内口（サンプルAED）',
    category: 'aed',
    lat: 35.6812,
    lng: 139.7671,
    address: '東京都千代田区丸の内（サンプル）',
    attributes: ['24時間利用可'],
  },
  {
    id: 'sample-yurakucho-aed',
    name: '有楽町駅前（サンプルAED）',
    category: 'aed',
    lat: 35.6749,
    lng: 139.7628,
    address: '東京都千代田区有楽町（サンプル）',
    attributes: ['駅構内'],
  },
  {
    id: 'sample-otemachi-aed',
    name: '大手町オフィス街（サンプルAED）',
    category: 'aed',
    lat: 35.6866,
    lng: 139.766,
    address: '東京都千代田区大手町（サンプル）',
    attributes: ['平日日中のみ'],
  },
  {
    id: 'sample-hibiya-toilet',
    name: '日比谷公園 多目的トイレ（サンプル）',
    category: 'accessible_toilet',
    lat: 35.6742,
    lng: 139.7555,
    address: '東京都千代田区日比谷公園（サンプル）',
    attributes: ['オストメイト', '車いす旋回スペース', '段差なし', 'ベビーベッド'],
  },
  {
    id: 'sample-marunouchi-toilet',
    name: '丸の内 多目的トイレ（サンプル）',
    category: 'accessible_toilet',
    lat: 35.68,
    lng: 139.7645,
    address: '東京都千代田区丸の内（サンプル）',
    attributes: ['車いす対応', '手すりあり', '段差約2cm'],
  },
  {
    id: 'sample-kudanshita-toilet',
    name: '九段下 多目的トイレ（サンプル）',
    category: 'accessible_toilet',
    lat: 35.6957,
    lng: 139.7519,
    address: '東京都千代田区九段北（サンプル）',
    attributes: ['オストメイト', '点字ブロックあり'],
  },
  {
    id: 'sample-hibiya-water',
    name: '日比谷公園 給水所（サンプル）',
    category: 'water',
    lat: 35.6735,
    lng: 139.758,
    address: '東京都千代田区日比谷公園（サンプル）',
    attributes: ['車いす対応の高さ'],
  },
  {
    id: 'sample-tokyo-station-water',
    name: '東京駅前 給水スポット（サンプル）',
    category: 'water',
    lat: 35.6805,
    lng: 139.7665,
    address: '東京都千代田区丸の内（サンプル）',
    attributes: ['ボトル給水対応'],
  },
]

export function sampleSpots(updatedAt: string): Spot[] {
  return SEEDS.map((seed) => ({
    spotId: asSpotId(seed.id),
    areaId: AREA_ID,
    name: seed.name,
    category: seed.category,
    lat: seed.lat,
    lng: seed.lng,
    address: seed.address,
    attributes: seed.attributes,
    source: SOURCE,
    fetchedAt: FETCHED_AT,
    checkinCount: 0,
    updatedAt,
  }))
}
