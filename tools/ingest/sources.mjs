/**
 * 取込対象のオープンデータ（FR-10-1）。
 *
 * ★ ここが唯一の出典定義である。URL・文字コード・列名をコードに散らさない。
 * 出典と取得日は各スポットに保持する（FR-10-2）。
 *
 * 対象エリアは千代田区・港区（#6 決着）。**片方だけでは4カテゴリが揃わない。**
 * 千代田区は AED を、港区は公衆トイレを公開していない。
 */

export const TARGET_WARDS = ['千代田区', '港区']

/** 座標の妥当性確認に使う。都心から大きく外れた行は捨てる */
export const TOKYO_BBOX = { minLat: 35.5, maxLat: 35.9, minLng: 139.5, maxLng: 139.95 }

const marked = (value) => ['○', '◯', '有', 'あり', '1'].includes((value ?? '').trim())

export const SOURCES = [
  {
    key: 'shelter',
    title: '避難所一覧データ（東京都総務局）',
    url: 'https://www.opendata.metro.tokyo.lg.jp/soumu/130001_evacuation_center.csv',
    encoding: 'shift_jis',
    kind: 'csv',
    category: 'shelter',
    /**
     * 先頭に空行があり、2行目がヘッダになっている。行数を決め打ちせず
     * 「避難所_施設名称」を含む行をヘッダとして探す。
     */
    headerMatch: '避難所_施設名称',
    ward: (row) => row['指定市区町村名'],
    name: (row) => row['避難所_施設名称'],
    address: (row) => row['所在地住所'],
    lat: (row) => row['緯度'],
    lng: (row) => row['経度'],
    /**
     * ★ 空欄は「設備が無い」ではなく「未記入」である。
     * 記入されている○だけを属性にし、空欄は何も足さない。
     * この空欄そのものがクエストの対象になる（FR-12）。
     */
    attributes: (row) => {
      const out = []
      if (marked(row['エレベーター有/\n避難スペースが１階'])) out.push('エレベーターまたは1階に避難スペース')
      if (marked(row['スロープ等'])) out.push('スロープ等')
      if (marked(row['点字ブロック'])) out.push('点字ブロック')
      if (marked(row['車椅子使用者対応トイレ'])) out.push('車椅子使用者対応トイレ')
      const other = (row['その他'] ?? '').trim()
      if (other !== '') out.push(other)
      return out
    },
  },
  {
    key: 'water',
    title: 'Tokyo Water Drinking Station（東京都水道局）',
    url: 'https://www.opendata.metro.tokyo.lg.jp/suidou/R8/tokyowaterdrinkingstation_260227.csv',
    encoding: 'shift_jis',
    kind: 'csv',
    category: 'water',
    headerMatch: '施設名',
    /** 市区町村の列が無いため所在地の文字列で判定する */
    ward: (row) => TARGET_WARDS.find((w) => (row['所在地'] ?? '').includes(w)) ?? '',
    name: (row) => row['施設名'],
    address: (row) => row['所在地'],
    lat: (row) => row['緯度'],
    lng: (row) => row['経度'],
    /** 稼働停止に値が入っている行は落とす */
    skip: (row) => (row['稼働停止'] ?? '').trim() !== '',
    attributes: (row) => {
      const out = []
      const type = (row['タイプ'] ?? '').trim()
      if (type !== '') out.push(type)
      const place = (row['水飲み栓設置場所'] ?? '').replace(/\s+/g, ' ').trim()
      if (place !== '') out.push(`設置場所：${place}`)
      return out
    },
  },
  {
    key: 'toilet',
    title: '公衆便所一覧（千代田区）',
    url: 'https://www.opendata.metro.tokyo.lg.jp/chiyoda/131016_13public_toilet.csv',
    encoding: 'utf-8',
    kind: 'csv',
    category: 'accessible_toilet',
    headerMatch: '名称',
    ward: (row) => row['所在地_市区町村'],
    name: (row) => row['名称'],
    address: (row) => row['所在地_連結表記'],
    lat: (row) => row['緯度'],
    lng: (row) => row['経度'],
    attributes: (row) => {
      const out = []
      const bf = Number.parseInt((row['バリアフリートイレ数'] ?? '').trim(), 10)
      if (Number.isFinite(bf) && bf >= 1) out.push(`バリアフリートイレ ${bf}`)
      if (marked(row['車椅子使用者用トイレ有無'])) out.push('車椅子使用者用トイレ')
      if (marked(row['オストメイト設置トイレ有無'])) out.push('オストメイト対応')
      if (marked(row['乳幼児用設備設置トイレ有無'])) out.push('乳幼児用設備')
      const from = (row['利用開始時間'] ?? '').trim()
      const to = (row['利用終了時間'] ?? '').trim()
      if (from !== '' && to !== '') out.push(`${from}〜${to}`)
      return out
    },
  },
  {
    key: 'aed',
    title: 'AED設置場所（港区）',
    url: 'https://opendata.city.minato.tokyo.jp/dataset/a67952bc-b318-4ab4-a797-187607c4ecf4/resource/3ccd1270-9ea7-481b-a97a-19ca80d22d05/download/minato_aed.json',
    encoding: 'utf-8',
    kind: 'geojson',
    category: 'aed',
    ward: (row) => TARGET_WARDS.find((w) => (row['所在地'] ?? '').includes(w)) ?? '港区',
    name: (row) => row['施設名'],
    address: (row) => row['所在地'],
    /**
     * ★ 属性が「施設名」「所在地」しか無い。
     * 屋内か屋外か、24時間使えるかが分からないため、ここがクエストの主対象になる（FR-12）。
     */
    attributes: () => [],
  },
]
