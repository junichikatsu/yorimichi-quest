import { CHOME_SOURCE, type AreaId, type DataSourceCredit, type Spot } from '@map-checkin/shared'
import { loadConfig } from '../config.js'
import { OPENDATA_SOURCES, opendataSpots } from './opendata-spots.js'
import { sampleSpots } from './sample-spots.js'

/**
 * 投入するスポットを選ぶ。
 *
 * 既定は取込スクリプトが生成した**実データ**（FR-10）。`SEED_DATASET=sample` で
 * 架空の固定データに切り替わる。
 *
 * ★ 切り替え式にしているのは、**架空データを実データとして見せないため**である。
 * 画面には出典と取得日が出るので（FR-10-2）、どちらを使っているかが常に分かる。
 */

export function datasetSpots(areaId: AreaId, updatedAt: string): Spot[] {
  return loadConfig().seedDataset === 'sample'
    ? sampleSpots(areaId, updatedAt)
    : opendataSpots(areaId, updatedAt)
}

/**
 * 出典表示（FR-10-2）。
 *
 * ライセンスが出典明記を求めるため、画面に出す必要がある。**任意の飾りではない。**
 * サンプルデータのときは架空である旨を出す。
 */
export function dataSourceCredits(): DataSourceCredit[] {
  if (loadConfig().seedDataset === 'sample') {
    return [
      { title: 'サンプルデータ（架空・実在のオープンデータではありません）', url: '', fetchedAt: '' },
      { title: CHOME_SOURCE.title, url: CHOME_SOURCE.url, fetchedAt: CHOME_SOURCE.fetchedAt },
    ]
  }
  return [
    ...OPENDATA_SOURCES.map((s) => ({ title: s.title, url: s.url, fetchedAt: s.fetchedAt })),
    // 町丁目の境界。e-Stat は出典明記が利用の条件なので、サンプルデータでも実データでも出す
    { title: CHOME_SOURCE.title, url: CHOME_SOURCE.url, fetchedAt: CHOME_SOURCE.fetchedAt },
  ]
}
