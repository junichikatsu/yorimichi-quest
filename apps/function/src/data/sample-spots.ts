import { asSpotId, type AreaId, type Spot } from '@imanouchi/shared'

/**
 * ★ 動作確認用の固定データです。実在のオープンデータではありません。
 *
 * 設備の有無・属性はすべて架空で、避難所指定の有無や実際のバリアフリー状況を
 * 表すものではありません。実データは `pnpm ingest` で取り込みます（FR-10）。
 *
 * これを残しているのは、**テストと、実データを持ち込みたくない検証**のためです。
 * 画面には出典が出るので、どちらで動いているかは常に分かります。
 */

const SOURCE = 'sample-fixture'
const FETCHED_AT = '2026-08-20'

interface SampleSeed {
  id: string
  name: string
  category: Spot['category']
  lat: number
  lng: number
  address: string
  attributes: string[]
}

const SEEDS: readonly SampleSeed[] = [
  {
    id: 'sample-hibiya-park',
    name: '日比谷公園（サンプル避難場所）',
    category: 'shelter',
    lat: 35.6739,
    lng: 139.7568,
    address: '東京都千代田区日比谷公園（サンプル）',
    attributes: ['スロープ等', '車椅子使用者対応トイレ'],
  },
  {
    id: 'sample-toranomon-aed',
    name: '虎ノ門周辺 AED（サンプル）',
    category: 'aed',
    lat: 35.6673,
    lng: 139.7495,
    address: '東京都港区虎ノ門（サンプル）',
    attributes: [],
  },
  {
    id: 'sample-chiyoda-toilet',
    name: '内幸町 多目的トイレ（サンプル）',
    category: 'accessible_toilet',
    lat: 35.6712,
    lng: 139.7573,
    address: '東京都千代田区内幸町（サンプル）',
    attributes: ['バリアフリートイレ 1', 'オストメイト対応'],
  },
  {
    id: 'sample-shimbashi-water',
    name: '新橋 給水スポット（サンプル）',
    category: 'water',
    lat: 35.6663,
    lng: 139.7583,
    address: '東京都港区新橋（サンプル）',
    attributes: ['飲み口型'],
  },
]

/** areaId は設定に従わせる。固定するとエリアを変えた瞬間に1件も引けなくなる */
export function sampleSpots(areaId: AreaId, updatedAt: string): Spot[] {
  return SEEDS.map((seed) => ({
    spotId: asSpotId(seed.id),
    areaId,
    name: seed.name,
    category: seed.category,
    lat: seed.lat,
    lng: seed.lng,
    address: seed.address,
    attributes: [...seed.attributes],
    source: SOURCE,
    fetchedAt: FETCHED_AT,
    checkinCount: 0,
    updatedAt,
  }))
}
