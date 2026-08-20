# オープンデータ ソース一覧（東京都・区市町村）

| 項目 | 内容 |
| :--- | :--- |
| 目的 | 要件定義書 FR-10（オープンデータ取込）で使用する候補データセットの棚卸し |
| 調査日 | 2026-08-16（リンク生存確認：2026-08-19／デモ候補エリアの実地調査：2026-08-20） |
| 抽出条件 | ヒット件数が多い場合は**更新日が3年以内**のもので抽出（2023年8月以降のデータ） |
| 関連文書 | [要件定義書 FR-10](requirements.md)、[企画書 ②⑤オープンデータの利用状況](proposal.md) |

> **注記**
> - 元の一覧には「更新日が新しいデータセットがあった場合の古いほうのデータ」を示す印があったが、テキスト化の過程で失われている。同一自治体で複数行あるものは**新旧が混在している可能性がある**ため、採用時に更新日を確認すること。
> - **リンクの生存確認は 2026-08-19 に実施した（下記「0. リンク生存確認結果」）。ライセンス確認は未実施。** 取込前に自治体ごとの利用規約（CC-BY 4.0 / PDL / 独自規約）を確認する必要がある（要件定義書 NFR-09）。
> - 取込時は**出典・ライセンス・取得日をデータに保持する**こと（FR-10-2、NFR-10）。

---

## 0. リンク生存確認結果（2026-08-19）

本一覧に記載された **100件のURL** に対し、HTTPリクエスト（リダイレクト追従・タイムアウト25秒・ブラウザ相当のUA）で到達確認を行った。

| 結果 | 件数 | 内訳 |
| :--- | :--- | :--- |
| **到達（200）** | **75** | 取得可能 |
| **判定不能（202 / WAF）** | **17** | すべて `catalog.data.metro.tokyo.lg.jp`。下記参照 |
| **リンク切れ（404）** | **7** | 下表 |
| **拒否（403）** | **1** | 下表 |

### リンク切れ・拒否（8件）

| 章 | 対象 | 状態 | 影響と代替 |
| :--- | :--- | :--- | :--- |
| 2.6 | 杉並区（指定緊急・広域・緊急以外） | 404 | wagmap の `lid=993`。区の一覧ページから再取得が必要 |
| 3 | 板橋区（公共施設） | 404 | FR-02 のスポット候補。優先度は低い |
| 3 | 多摩市（公共施設） | 404 | 同上 |
| 3 | 目黒区（公共施設） | **403** | `data.bodik.jp`。ホットリンク制限の可能性があり、ブラウザでは開ける見込み。要手動確認 |
| **4.1** | **墨田区（クールスポット）** | **404** | **FR-10-1 該当。** ただし江東区（クーリングシェルター）は生存しており、デモ対象エリア次第では影響なし |
| **4.3** | **世田谷区（公衆トイレ）** | **404** | **FR-10-1 該当。** 4.3 の他13件は生存 |
| **4.3** | **杉並区（公衆トイレ）** | **404** | **FR-10-1 該当。** wagmap の `lid=998` |
| **4.3** | **府中市（公衆トイレ）** | **404** | **FR-10-1 該当。** |

### 判定不能：`catalog.data.metro.tokyo.lg.jp`（17件）

東京都オープンデータカタログサイトは **AWS WAF のボット判定（`x-amzn-waf-action: challenge`）**を返すため、HTTPクライアントからは URL の有効性を判定できない（HTTP 202 とチャレンジ用HTMLが返る）。**ブラウザでの手動確認が必要。**

対象は次の3群。

| 群 | 件数 | 章 |
| :--- | :--- | :--- |
| 区市町村の避難場所データセットページ | 12 | 2.1 / 2.2 |
| 港区の公共施設 | 1 | 3 |
| 浸水予想区域図・震災時火災の避難場所・3D点群 | 4 | 6 / 7 / 8 |

いずれも **FR-10-1 の一次データではない**（避難所・避難場所は東京都総務局の直CSVが一次ソースであり、そちらは生存を確認済み）。

### FR-10-1 の一次データはすべて生存している

作品提出フォーム 4-1（利用データ一覧）に登録する候補として、**要件定義書 FR-10-1 が指定する4データセットの一次リンクはすべて到達可能**である。

| データセット | リンク | 状態 |
| :--- | :--- | :--- |
| 避難所一覧（東京都総務局） | `https://www.opendata.metro.tokyo.lg.jp/soumu/130001_evacuation_center.csv` | **200**（13.8MB） |
| 避難場所一覧（東京都総務局） | `https://www.opendata.metro.tokyo.lg.jp/soumu/130001_evacuation_area.csv` | **200**（255KB） |
| データ項目定義書 | `https://www.opendata.metro.tokyo.lg.jp/soumu/R4/130001_evacuation_center-area_spec.xlsx` | **200** |
| Tokyo Water Drinking Station（東京都水道局） | `https://www.opendata.metro.tokyo.lg.jp/suidou/R8/tokyowaterdrinkingstation_260227.csv` | **200**（112KB） |
| クーリングシェルター（江東区） | `https://www.opendata.metro.tokyo.lg.jp/koto/131083_202_cooling_shelter.csv` | **200** |
| AED設置場所（狛江市） | `https://www.opendata.metro.tokyo.lg.jp/komae/132195_aed.csv` | **200** |
| 公衆トイレ（4.3の16件中13件） | 千代田・墨田・目黒・中野・荒川・葛飾・多摩・西東京・狛江・東大和・国分寺・国立・あきる野 | **200** |

> 避難所一覧は **13.8MB** と大きい。デモ対象エリア（Issue #6）で絞り込んでから取り込むこと（FR-10-3）。
>
> AED・公衆トイレは自治体ごとに公開元が分かれるため、**デモ対象エリアが確定してからそのエリアの公開元を追加調査する**（4.3・5章の調査メモを参照）。

---

## 0.1 デモ対象エリアの実地調査（2026-08-20）

> **決定：デモ対象エリアは千代田区・港区（2026-08-20、Issue #6 決着）。**
> 両区を**1つのエリアパーティション**へまとめて投入する（要件定義書 6.2・FR-10-3）。

候補として挙がった**千代田区・港区**について、FR-10-1 の4カテゴリが実在するかを
API とファイル実体で確認した。件数は実データを数えた値。**この調査結果が決定の根拠である。**

### 結論：**どちらか一方では必ず1カテゴリが欠ける**

| データ | 千代田区 | 港区 | 出所 |
| :--- | :--- | :--- | :--- |
| 避難所・避難場所 | **14件** | **58件** | 東京都総務局の都全域CSV（両区とも収録） |
| 給水スポット（Drinking Station） | **11件** | **27件** | 東京都水道局の都全域CSV（同上） |
| 公衆トイレ | **37件** | **0件（未公開）** | 千代田区のみ公開 |
| AED | **0件（未公開）** | **226件** | 港区のみ公開 |
| 区が公開するデータセット総数 | 29件 | **268件** | 東京都オープンデータカタログ |

**千代田区に AED、港区に公衆トイレが存在しない。** 港区は「だれでもトイレ」「多目的」
「ユニバーサル」などの別名も含めて 268 件を検索したが、トイレ系は 1 件も無かった。

したがって FR-10-1 の4カテゴリをそろえるには**両区を取込対象にする必要がある**。
これが2区に決めた理由であり、片方に絞る選択はカテゴリを1つ落とすことを意味する。

### 追加で判明したデータ

| 区 | データ | リンク | 備考 |
| :--- | :--- | :--- | :--- |
| 港区 | AED設置場所 | https://opendata.city.minato.tokyo.jp/dataset/a67952bc-b318-4ab4-a797-187607c4ecf4/resource/3ccd1270-9ea7-481b-a97a-19ca80d22d05/download/minato_aed.json | **GeoJSON**。同データセットに CSV も登録されているが、実体は HTML ページで直接は使えない |
| 港区 | バリアフリー観光ルート | https://opendata.city.minato.tokyo.jp/dataset/minato_barrier_free_kankou | 要配慮者向け（ペルソナ④）の材料になりうる |
| 港区 | 防災系データ 15件 | https://opendata.city.minato.tokyo.jp/dataset/29751bf2-8198-47ed-819c-15a753369cb7/resource/d4553ccf-f750-402b-a614-c7241a27ccb6/download/opendata-ichiran.csv | 災害時公衆電話・防災行政無線・消火水槽など。目録CSVから確認できる |

### FR-12（データ辞書）に直結する発見

**千代田区の公衆トイレは 39 列あり、バリアフリー属性を既に持っている。**

> バリアフリートイレ数／車椅子使用者用トイレ有無／**オストメイト設置トイレ有無**／
> 乳幼児用設備設置トイレ有無／利用開始時刻・終了時刻

つまり FR-12-6（行政データに既に存在する項目は収集対象から外す）の対象である。
市民に集めてもらうべきなのは、公開データが持てない粒度——**レバーの形状、入口の段差の実際の高さ、
掲示された利用時間が実態と合っているか**——になる。

**一方、港区の AED は属性が「施設名」「所在地」の 2 つしか無い。**
「24時間使えるか」「屋内か屋外か」「設置階」はいずれも公開されていない。
Issue #14 のデータ辞書に AED の項目を入れる根拠は、この実データで裏付けられている。

### 取込・設定で先に潰しておく点

| 論点 | 内容 |
| :--- | :--- |
| **件数が上限を超える** | 4カテゴリ合計で 373 件になり、`MAX_SPOTS_PER_REQUEST`（既定 200）を超える。**AED 226 件を撮影ルート周辺に絞って投入する**のが現実的 |
| **GeoJSON 対応** | 港区 AED は GeoJSON。取込スクリプト（FR-10-2）は CSV だけでなく GeoJSON も扱う必要がある |
| **探索率の分母** | `AREA_RADIUS_M`（既定 1500m）の円は約 7km²。千代田＋港は約 32km² あるため覆えない。**撮影ルートの中心に合わせて設定**しないと探索率がほとんど動かない |
| 相互検証の密度 | エリアを広げるほど同一スポットに複数人が来なくなる（UA-2）。**取込は両区、撮影と検証は徒歩圏の1ルートに閉じる**のが望ましい |

## 0.2 取込の実施結果（2026-08-20）

取込スクリプト（`sample/map-checkin/tools/ingest/`）を作成し、**実データ 370 件を取り込んだ**（FR-10-2）。
`pnpm ingest` で再実行できる。ネットワークへ出るのはこのスクリプトだけで、関数側は生成済みの
ファイルを読む。

| カテゴリ | 千代田区 | 港区 | 計 |
| :--- | ---: | ---: | ---: |
| 避難所・避難場所 | 14 | 58 | 72 |
| 給水スポット | 11 | 27 | 38 |
| バリアフリートイレ | 36 | 未公開 | 36 |
| AED | 未公開 | 224 | 224 |
| **計** | **61** | **309** | **370** |

### 取込で判明した実務上の事実

| 事実 | 影響 |
| :--- | :--- |
| **文字コードが揃っていない** | 避難所と給水は CP932、千代田区は UTF-8 BOM 付き。出典ごとに定義しないと文字化けする |
| **避難所CSVは都全域13.8MB** | 実行時に落とす作りにできない。取込は事前実行してファイルを生成する方式にした |
| **先頭に空行がある** | 避難所CSVはヘッダが2行目。行数の決め打ちではなく列名で探す必要がある |
| **座標が無い行がある** | 千代田区の錦華公園は緯度経度が未記入。取り込めないため除外した |
| **区外のデータが混ざる** | 港区のAEDに**箱根町の保養施設2件**が含まれる。都内の範囲で除外した |

### 空欄の実態 — これが FR-12 の根拠である

**公開データは「項目が存在するのに値が入っていない」状態が広く残っている。**
空欄は「設備が無い」ではなく「未記入」であり、ここがクエストの対象になる。

| データ | 空欄の状況 |
| :--- | :--- |
| 避難所（72件） | スロープ等・点字ブロックが**各26件空欄**、車椅子使用者対応トイレが**11件空欄** |
| 千代田区 公衆便所（37件） | 「車椅子使用者用トイレ有無」が**37件すべて空欄**。一方でオストメイトは33件記入済み |
| 港区 AED（224件） | 属性が「施設名」「所在地」の**2つだけ**。屋内・屋外や24時間利用可否が分からない |

千代田区の例が象徴的である。**列は用意されているのに、37件すべてで車椅子の可否が空欄**になっている。
現地に行けば1秒で分かる情報が、公開データからは一件も読み取れない。

### 出典表示

取り込んだデータのライセンスは出典明記を求めるため、**画面のフッタに出典と取得日を表示している**。
畳めるが消せない作りにした。架空のサンプルデータで動かしているときは、そうであることが表示される。

## 0.3 町丁目境界の取込（2026-08-20）

**東京都のカタログに町丁目ポリゴンは無い。** 千代田区（29件）・港区（268件）のデータセットを
全件確認したが、あるのは町丁目別人口の CSV だけで、境界の図形は含まれていない。

そのため **e-Stat（政府統計の総合窓口）の国勢調査 小地域（町丁・字等別）境界データ**を使う。
東京都のオープンデータではないが、提出フォームの審査基準は「オープンデータや**民間データ等**を
有効活用しているか」であり対象内である（都以外の利用可を確認済み）。

| 出典 | 形式 | URL |
| :--- | :--- | :--- |
| 国勢調査 小地域（町丁・字等別）境界データ（e-Stat） | Shapefile（ZIP） | https://www.e-stat.go.jp/gis/statmap-search?type=2 |

取得は `dlserveyId=A002005212020&code=<自治体コード>&coordSys=1&format=shape&downloadType=5` で、
**GeoJSON 形式は 404 になる**（Shapefile のみ）。

| | 区画数 | 人口 |
| :--- | ---: | ---: |
| 千代田区（13101） | 116 | — |
| 港区（13103） | 140 | — |
| **計** | **256** | **327,166人** |

### 属性に人口と世帯数が付いている

`S_NAME`（町丁目名）・`KEY_CODE`（11桁コード）に加え、**`JINKO`（人口）・`SETAI`（世帯数）・
`AREA`（面積m²）**を持つ。これが FR-09 の集計の分母になる。記録件数を人口と並べられるため、
「集めたデータを行政の単位で返す」という主張が数字で裏付けられる。

人口 0 の町丁目が実在する（丸の内など事業所地区）。0 を欠損として扱わないこと。

### 用途

| 用途 | 内容 |
| :--- | :--- |
| 場所の言い方 | 「300m四方の区画」ではなく「麻布十番一丁目」と言える（#27） |
| 集計単位 | 町丁目ごとの記録件数と人口を並べる（FR-09） |
| 踏破率の分母 | 面積をタイル面積で割って区画内のタイル数を出す |

> **危険度としては見せない。** 「設備が少ない町丁目」を強調すると、リスクを地図上の優劣として
> 提示することになり、設計原則 G-2 に反する。件数の多い順に並べ、少ない側を強調しない。
> 記録が 0 件の町丁目は表示しない（**データが無いことと設備が無いことは違う**）。

### 調査方法のメモ

東京都オープンデータカタログ（`catalog.data.metro.tokyo.lg.jp`）は WAF のボット判定により
ブラウザ以外からは開けないが（0章参照）、**CKAN の API（`/api/3/action/...`）は通る**。
区市町村のデータセットは `package_search?q=name:t<自治体コード>*` で列挙できる
（千代田区 131016、港区 131032）。今後の調査はこの経路を使うのが早い。

---

## 1. 東京都防災マップ

| 対象 | 提供元 | 形式 | リンク |
| :--- | :--- | :--- | :--- |
| 東京都防災マップ（本体） | 東京都 | サイト | https://map.bosai.metro.tokyo.lg.jp/index.html |
| 避難所一覧データ | 東京都総務局 | CSV | https://www.opendata.metro.tokyo.lg.jp/soumu/130001_evacuation_center.csv |
| 避難場所一覧データ | 東京都総務局 | CSV | https://www.opendata.metro.tokyo.lg.jp/soumu/130001_evacuation_area.csv |
| データ項目定義書 | 東京都総務局 | XLSX | https://www.opendata.metro.tokyo.lg.jp/soumu/R4/130001_evacuation_center-area_spec.xlsx |

---

## 2. 避難所・避難場所データ（区市町村）

### 2.1 指定緊急避難場所

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| 小金井市 | CSV | https://www.opendata.metro.tokyo.lg.jp/koganei/03_shiteihinanbasyo.csv |
| 西東京市 | XLSX | https://www.opendata.metro.tokyo.lg.jp/nishitokyo/132292_evacuation_space.xlsx |
| 台東区 | CSV | https://www.city.taito.lg.jp/kusei/online/opendata/seikatu/shisethutizujouhou.files/20250314_shitei_kinkyu_hinan.csv |
| あきる野市 | CSV | https://www.city.akiruno.tokyo.jp/cmsfiles/contents/0000015/15465/132284_evacuation_space2022.csv |
| 羽村市 | CSV | https://www.opendata.metro.tokyo.lg.jp/hamura/132276_evacuation_space.csv |
| 豊島区 | CSV | https://www.opendata.metro.tokyo.lg.jp/toyoshima/R4_evacuation_space.csv |
| 清瀬市 | ページ | https://www.city.kiyose.lg.jp/opendata/opendata/opendataichiran/1001605.html |
| あきる野市 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t132284d3100000007/resource/ec798134-5f45-445f-97b5-30300515f37b |
| 清瀬市 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t132217d0000000009/resource/626bb09f-14ed-4ee4-bf1a-b1d342588199 |
| 小金井市 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t132101d0000000022/resource/3adde52f-3186-45ac-a4a7-844f12a5a7fa |
| 練馬区 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t131202d0000000130/resource/f8651a81-4fa7-46dc-acf1-57498fafec7e |
| 豊島区 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t131164d0000000003/resource/5e1831de-0541-4f79-a07b-80a156f8cce8 |
| 羽村市 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t132276d0000000003/resource/96ecf0c6-408b-4472-b00d-fe589c0af485 |
| 西東京市 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t132292d0000000011/resource/743948a0-9e0a-4bc9-80f2-bebb8e3f5ec1 |
| 杉並区 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t131156d0000000200/resource/080ae59e-628b-4f7c-bcb0-9da588cf4d35 |
| 台東区 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t131067d0000000382/resource/3e0b989c-a3cb-46fa-8bc7-9706e5c1c60f |
| 八王子市（地震） | ページ | https://www.city.hachioji.tokyo.jp/emergency/bousai/m12873/saigai/p035634.html |
| 八王子市（風水害） | ページ | https://www.city.hachioji.tokyo.jp/emergency/bousai/m12873/saigai/p035635.html |
| 新宿区 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t131041d0000000115/resource/ee2a79e8-3420-482f-be76-75a4939022d0 |
| 稲城市 | XLSX | https://www.city.inagi.tokyo.jp/_res/projects/default_project/_page_/001/009/446/010_hyojun.xlsx |

> 小金井市・西東京市・台東区・あきる野市・羽村市・豊島区・清瀬市は、直リンクとカタログページの**両方**を採録している。取込時はどちらか一方（更新日の新しいほう）を選ぶこと。

### 2.2 広域避難場所

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| 調布市 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t132080d3100000422/resource/e11b21bd-8d5b-47a4-aaf7-3aa6047c9ec0 |
| 港区 | CSV | https://opendata.city.minato.tokyo.jp/dataset/dc609dcf-892a-4a20-8f74-f62ce9fc806d/resource/f636e5b8-088f-42e2-b95c-d0978d4e339c/download/minatokushisetsujoho_kouen.csv |
| 小金井市 | CSV | https://www.opendata.metro.tokyo.lg.jp/koganei/03_shiteihinanbasyo.csv |
| 中野区 | CSV | https://www2.wagmap.jp/nakanodatamap/nakanodatamap/opendatafile/map_32/CSV/opendata_6000680.csv |
| 品川区 | CSV | https://www.opendata.metro.tokyo.lg.jp/shinagawa/kouikihinanbasho.csv |
| 品川区（別データ） | CSV | https://www.opendata.metro.tokyo.lg.jp/shinagawa/hinanjo.csv |
| 品川区（別データ・RDF） | RDF | https://www.opendata.metro.tokyo.lg.jp/shinagawa/hinanjo.rdf |
| 杉並区 ⚠**404** | ページ | https://www2.wagmap.jp/suginami/OpenDataDetail?lid=993&mids=53 |

> 港区の広域避難場所として挙がっている CSV は**公園施設情報**（`minatokushisetsujoho_kouen.csv`）で、3章の公共施設一覧にも同じ URL が入っている。内容を確認して分類を確定すること。

### 2.3 緊急避難場所

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| 日野市 | ページ | https://www.city.hino.lg.jp/opendata/about/1026816/1026809.html |

### 2.4 指定緊急以外

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| 台東区（風水害） | CSV | https://www.city.taito.lg.jp/kusei/online/opendata/bousai/husuigai.files/husuigai.csv |
| 文京区 | CSV | https://www.city.bunkyo.lg.jp/documents/6059/kinkyuhinanbasyo-hinanjo.csv |
| 稲城市 | XLSX | https://www.city.inagi.tokyo.jp/_res/projects/default_project/_page_/001/009/446/010_hyojun.xlsx |

### 2.5 避難場所

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| 大田区 | XLS | https://www.opendata.metro.tokyo.lg.jp/ota/131113_hinanjyo_syugoubasyo_chikubetu.xls |

### 2.6 指定緊急・広域・緊急以外

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| 調布市 | XLSX | https://www.city.chofu.lg.jp/documents/4684/3_1.xlsx |
| 港区 | CSV | https://opendata.city.minato.tokyo.jp/dataset/5ead16f9-7a78-4f9a-a08c-afb66ad06b07/resource/46bd922e-ae9c-49b9-991a-609df5cc726b/download/minatokushisetsujoho_hinanjyo.csv |
| 町田市 | CSV | https://www.city.machida.tokyo.jp/shisei/opendata/shisetsu/hinanshisetsu.files/132098_evacuation_space.csv |
| 北区 | CSV | https://www.city.kita.lg.jp/_res/projects/default_project/_page_/001/014/461/hinan_suigai-2.csv |
| 墨田区 | CSV | https://www.city.sumida.lg.jp/kuseijoho/sumida_info/opendata/opendata_ichiran/bosai_data/hinan_data.files/hinan_20220301.csv |

---

## 3. 公共施設一覧データ

学校・公民館・体育館などの施設基本情報。

| 地域・提供元 | 形式 | リンク |
| :--- | :--- | :--- |
| 東京都デジタルサービス局（推奨データセット） | CSV | https://www.opendata.metro.tokyo.lg.jp/suisyoudataset/130001_public_facility.csv |
| だれでも東京 | CSV | https://www.opendata.metro.tokyo.lg.jp/digitalservice/130001_Daredemo_Tokyo_public_facilities.csv |
| 多摩市 ⚠**404** | CSV | https://www.city.tama.lg.jp/_res/projects/default_project/_page_/001/006/787/tamashisetsu.csv |
| 港区（公園） | CSV | https://opendata.city.minato.tokyo.jp/dataset/dc609dcf-892a-4a20-8f74-f62ce9fc806d/resource/f636e5b8-088f-42e2-b95c-d0978d4e339c/download/minatokushisetsujoho_kouen.csv |
| 港区（複数リンクあり） | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t131032d0000000014 |
| 稲城市 | XLSX | https://www.city.inagi.tokyo.jp/_res/projects/default_project/_page_/001/009/446/501.xlsx |
| 板橋区 ⚠**404** | CSV | https://www.city.itabashi.tokyo.jp/_res/projects/default_project/_page_/001/006/127/202503211.csv |
| 東久留米市 | CSV | https://www.opendata.metro.tokyo.lg.jp/higashikurume/132225_public_facility.csv |
| 清瀬市 | ページ | https://www.city.kiyose.lg.jp/opendata/opendata/opendataichiran/1001604.html |
| 調布市 | CSV | https://www.city.chofu.lg.jp/documents/13850/132080_public_facility.csv |
| 品川区 | CSV | https://www.opendata.metro.tokyo.lg.jp/shinagawa/kokyoshisetsu.csv |
| 府中市 | XLSX | https://www.city.fuchu.tokyo.jp/gyosei/opendata/index.files/13206_public_facility.xlsx |
| 青梅市 | XLSX | https://www.opendata.metro.tokyo.lg.jp/ome/ods/132055_public_facility.xlsx |
| 墨田区 | CSV | https://www.opendata.metro.tokyo.lg.jp/sumida/131075_public_facility.csv |
| 東村山市 | CSV | https://www.opendata.metro.tokyo.lg.jp/higashimurayama/20240619_public_facility.csv |
| 新宿区 | CSV | https://data.odp.jig.jp/viewcsv/jp/tokyo/shinjuku/772.csv |
| 目黒区 ⚠**403** | CSV | https://data.bodik.jp/dataset/8fb2f443-a8fd-47c6-a527-6a961fca8928/resource/f119ff15-e5e1-44e7-836f-aa5e20c9a46c/download/131105_public_facility_20220616.csv |
| 杉並区 | CSV | https://www.city.suginami.tokyo.jp/documents/1345/131156_public_facility_1.csv |
| 三鷹市 | CSV | https://www.city.mitaka.lg.jp/opendata/koukyoushisetsu.csv |

---

## 4. 暑さ・水分補給対策データ

### 4.1 Tokyoクールシェアスポット

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| 江東区（クーリングシェルター） | CSV | https://www.opendata.metro.tokyo.lg.jp/koto/131083_202_cooling_shelter.csv |
| 墨田区（クールスポット） ⚠**404** | CSV | https://www.city.sumida.lg.jp/kuseijoho/sumida_info/opendata/opendata_ichiran/mousyo-kaihi.files/coolshelter_20240802.csv |

### 4.2 Tokyo Water Drinking Station

| 提供元 | 形式 | リンク |
| :--- | :--- | :--- |
| 東京都水道局 | CSV | https://www.opendata.metro.tokyo.lg.jp/suidou/R8/tokyowaterdrinkingstation_260227.csv |

### 4.3 公衆トイレ

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| **千代田区（37件・バリアフリー属性つき）** | CSV | https://www.opendata.metro.tokyo.lg.jp/chiyoda/131016_13public_toilet.csv |
| 墨田区 | CSV | https://www.opendata.metro.tokyo.lg.jp/sumida/131075_public_toilet.csv |
| 目黒区 | CSV | https://data.bodik.jp/dataset/73861054-d37f-4d84-a7ac-7d1010aae790/resource/79060cab-e0e4-468b-bac6-b82d4610df47/download/131105_public_toilet_20210401.csv |
| 世田谷区 ⚠**404** | XLSX | https://www.city.setagaya.lg.jp/documents/4424/toilet2024.xlsx |
| 杉並区 ⚠**404** | ページ | https://www2.wagmap.jp/suginami/OpenDataDetail?lid=998&mids=53 |
| 中野区 | CSV | https://www2.wagmap.jp/nakanodatamap/nakanodatamap/opendatafile/map_50/CSV/opendata_550070.csv |
| 荒川区 | CSV | https://www.city.arakawa.tokyo.jp/documents/23112/131181_public_toilet.csv |
| 葛飾区 | CSV | https://www.opendata.metro.tokyo.lg.jp/katsushika/131229_public_toilet.csv |
| 多摩市（公共施設トイレ一覧） | CSV | https://www.city.tama.lg.jp/_res/projects/default_project/_page_/001/006/788/132241_public_toilet.csv |
| 府中市 ⚠**404** | CSV | https://www.city.fuchu.tokyo.jp/gyosei/opendata/index.files/132063_public_toilet.csv |
| 西東京市 | XLSX | https://www.opendata.metro.tokyo.lg.jp/nishitokyo/132292_public_toilet.xlsx |
| 狛江市 | CSV | https://www.opendata.metro.tokyo.lg.jp/komae/132195_public_toilet.csv |
| 東大和市 | CSV | https://www.opendata.metro.tokyo.lg.jp/higashiyamato/ods/132209_public_toilet.csv |
| 国分寺市 | CSV | https://www.opendata.metro.tokyo.lg.jp/kokubunji/132144_public_toilet.csv |
| 国立市 | CSV | https://www.opendata.metro.tokyo.lg.jp/kunitachi/132152_public_toilet.csv |
| あきる野市（観光トイレ） | CSV | https://www.city.akiruno.tokyo.jp/cmsfiles/contents/0000015/15465/132284_tourist-toilets_2022.csv |

> **調査メモ（原文ママ）**: 「力尽きた。各自治体ありそう」
> 公衆トイレは多くの自治体が公開しているとみられ、上記は網羅的ではない。デモ対象エリア（Issue #6）が決まってから、そのエリア分を追加調査するのが効率的。

---

## 5. 防災インフラデータ

| 対象 | 提供元 | 形式 | リンク |
| :--- | :--- | :--- | :--- |
| AED設置場所 | 狛江市 | CSV | https://www.opendata.metro.tokyo.lg.jp/komae/132195_aed.csv |
| **AED設置場所（226件）** | **港区** | **GeoJSON** | https://opendata.city.minato.tokyo.jp/dataset/a67952bc-b318-4ab4-a797-187607c4ecf4/resource/3ccd1270-9ea7-481b-a97a-19ca80d22d05/download/minato_aed.json |
| 消火栓 位置情報 | 東京消防庁 | XLSX | https://www.opendata.metro.tokyo.lg.jp/shoubou/2025/syoukasenitizyouhou.xlsx |
| 防火水槽等 位置情報 | 東京消防庁 | XLSX | https://www.opendata.metro.tokyo.lg.jp/shoubou/2025/boukasuisoutouitizyouhou.xlsx |

> **調査メモ（原文ママ）**: 「AEDも各自治体ある。絞りたい」
> AED は自治体ごとに公開されており数が多いため、対象エリアを絞ってから収集する方針。

---

## 6. 災害リスク・ハザードデータ

| 対象 | 提供元 | 形式 | リンク |
| :--- | :--- | :--- | :--- |
| 浸水予想区域図 | 東京都建設局 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t000014d0000000029 |
| 土砂災害警戒区域 | 東京都建設局 | ダウンロードページ | https://d-keikai.metro.tokyo.lg.jp/GisDownload |
| 地震に関する地域危険度一覧 | 東京都都市整備局 | CSV | https://www.toshiseibi.metro.tokyo.lg.jp/bosai/chousa_6/download/all2.csv?2209= |

> 要件定義書 FR-04-4（ハザード文脈を踏まえた避難シミュレーションクイズ）で使う候補。

---

## 7. 給水拠点・避難場所関連（東京都）

| 対象 | 提供元 | 形式 | リンク |
| :--- | :--- | :--- | :--- |
| 給水拠点一覧 | 東京都水道局 | CSV | https://www.opendata.metro.tokyo.lg.jp/suidou/R7/kyoten_20251211.csv |
| 避難場所などに関するパンフレット | 東京都都市整備局 | PDF | https://www.toshiseibi.metro.tokyo.lg.jp/bosai/hinan/pdf/pamphlet_09.pdf |
| 震災時火災における避難場所等の一覧（複数リンクあり） | 東京都都市整備局 | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t000008d0000000013 |

---

## 8. 3D都市モデル・空間データ

| 対象 | 地域 | 形式 | リンク |
| :--- | :--- | :--- | :--- |
| 3D都市モデル | — | — | （リンク未取得。調査メモ「3Dデジタルマップいっぱいあります」） |
| 点群データ | 多摩地域（複数あり） | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t000029d0000000020 |
| 点群データ | 島嶼部（複数あり） | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t000029d0000000019 |
| 点群データ | 区部（複数あり） | カタログ | https://catalog.data.metro.tokyo.lg.jp/dataset/t000029d0000000024 |
| 土地利用現況調査 | 区部（2017年） | PDF | https://www.toshiseibi.metro.tokyo.lg.jp/seisaku/tochi_c/pdf/tochi_3/tochi_all.pdf?1407 |
| 土地利用現況調査 | 多摩・島嶼部（2017年） | PDF | https://www.toshiseibi.metro.tokyo.lg.jp/seisaku/tochi_c/pdf/tochi_4/tochi_all.pdf |

> 企画書では「東京都デジタルツイン実現プロジェクト 3D点群・都市モデルデータ」を利用予定データに挙げているが、**MVP では使わない**（要件定義書 3.1 のスコープ外）。Final Stage 以降の演出・分析用の候補。

---

## 9. 各自治体のオープンデータ一覧（横断調査用）

個別データセットではなく、その自治体が公開しているデータの目録。デモ対象エリアが決まったあと、
そのエリアの自治体で何が公開されているかを調べる入口として使う。

| 地域 | 形式 | リンク |
| :--- | :--- | :--- |
| 西東京市 | XLSX | https://www.opendata.metro.tokyo.lg.jp/nishitokyo/132292_open_data_list.xlsx |
| 豊島区 | CSV | https://www.opendata.metro.tokyo.lg.jp/toyoshima/R4_open_data_list.csv |
| 羽村市 | CSV | https://www.opendata.metro.tokyo.lg.jp/hamura/132276_open_data_list.csv |
| 青梅市 | XLSX | https://www.opendata.metro.tokyo.lg.jp/ome/132055_open_data_list.xlsx |
| 多摩市 | CSV | https://www.city.tama.lg.jp/_res/projects/default_project/_page_/001/006/760/open_data_list.csv |
| 練馬区 | CSV | https://www.city.nerima.tokyo.jp/kusei/tokei/opendata/opendatasite/index.files/131202_open_data_list.csv |
| 稲城市 | XLSX | https://www.city.inagi.tokyo.jp/_res/projects/default_project/_page_/001/009/446/014_hyojun.xlsx |
| 港区 | CSV | https://opendata.city.minato.tokyo.jp/dataset/29751bf2-8198-47ed-819c-15a753369cb7/resource/d4553ccf-f750-402b-a614-c7241a27ccb6/download/opendata-ichiran.csv |
| 目黒区（行政情報目録） | CSV | https://data.bodik.jp/dataset/6ebbede4-7a19-41d7-a6d1-5fcbf3be0091/resource/9e3000cc-1ba8-4f4c-b682-f32fad9086c0/download/202103.csv |

---

## 要件定義書との対応

| 要件 | 必要なデータ | 本一覧の該当箇所 |
| :--- | :--- | :--- |
| FR-10-1 | 避難所・避難場所一覧 | 1章、2章 |
| FR-10-1 | 自治体標準オープンデータセット（バリアフリートイレ・AED） | 4.3章、5章 |
| FR-10-1 | クールシェアスポット／Drinking Station | 4.1章、4.2章 |
| FR-02 | 公共施設（スポット候補） | 3章 |
| FR-04-4 | ハザードマップ（浸水・土砂・地域危険度） | 6章 |
| FR-08 | 給水拠点 | 7章 |
| EX（将来） | 3D都市モデル・点群 | 8章 |

## 次にやること

- [x] デモ対象エリアの確定（**千代田区・港区**／2026-08-20、Issue #6 決着）
- [x] リンク生存確認（2026-08-19 実施。0章参照）
- [x] デモ候補エリア（千代田区・港区）のデータ実在確認（2026-08-20 実施。0.1章参照）
- [ ] `catalog.data.metro.tokyo.lg.jp` の17件をブラウザで手動確認（WAF によりHTTPクライアントでは判定不能）
- [ ] 404 の7件について、各自治体のオープンデータ一覧ページから現行URLを再取得する（9章のリンクが起点）
- [ ] 対象エリア分の更新日の確認（重複行の新旧判定を含む）
- [ ] 自治体ごとのライセンス確認（CC-BY 4.0 / PDL / 独自規約）
- [ ] 列定義の突合（自治体標準オープンデータセット準拠かどうか。CSV の文字コード・座標系のばらつきも確認）
- [x] 取込スクリプトの作成（2026-08-20 実施。`pnpm ingest`／0.2章参照。CSV・GeoJSON 両対応）
- [x] 町丁目境界の取込（2026-08-20 実施。`pnpm ingest:boundaries`／0.3章参照）
- [ ] AED の投入範囲を撮影ルート周辺に絞る（FR-10-4：取込実測 370 件が `MAX_SPOTS_PER_REQUEST` 200 を超える）
- [ ] `AREA_CENTER` / `AREA_RADIUS_M` を撮影ルートの中心に設定（FR-10-5：既定の半径では両区 32km² を覆えない）
