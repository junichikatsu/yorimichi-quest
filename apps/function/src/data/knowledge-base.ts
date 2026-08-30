/**
 * ★ 自動生成ファイル。手で編集しないこと。
 *
 * 生成元: tools/kb/build.ts（#75・FR-04-2）／再生成: pnpm build:kb
 *
 * 構造化ナレッジベース。**クイズそのものではなく、クイズを書くための材料**である。
 * 提出物 3-2 の二段構えの真ん中に置かれる：
 *   取り込み（ここ）= 高性能モデル1回 → 利用時 = 軽量モデルが都度、この範囲だけで書く
 *
 * ★ **`reviewed: false` のものは配られない**（shared/knowledge.ts の usableEntries）。
 *   人が読んで true にするまで出題に使われない。これが 3-2 の
 *   「人が確かめたナレッジの範囲でしか書かせません」の実体である。
 *
 * ★ **レビューはこのファイルではなく `tools/kb/approved.json` で行う。**
 *   この diff を読み、正しければ台帳の `approved` を true にして再実行する。
 *   台帳は指紋を持っており、**中身が変われば承認は自動で外れる**（継ぎ足せない）。
 *
 * 生成時点: 2026-08-30
 * 件数: 全 12 件（確認済み 12 件 / **未確認 0 件**）
 * 内訳: カテゴリ 12 / 町丁目 0 / スポット 0
 *
 * 取り込み元の出典
 * - 避難所一覧データ（東京都総務局）（取得 2026-08-20）
 * - Tokyo Water Drinking Station（東京都水道局）（取得 2026-08-20）
 * - 公衆便所一覧（千代田区）（取得 2026-08-20）
 * - AED設置場所（港区）（取得 2026-08-20）
 */

import type { KnowledgeBase } from '@imanouchi/shared'

export const KNOWLEDGE_BASE: KnowledgeBase = {
  "generatedAt": "2026-08-30",
  "entries": [
    {
      "entryId": "seed-aed-time-1",
      "scope": "category",
      "key": "aed",
      "category": "aed",
      "context": "AEDについて、いざという時に確認しておくと役に立つのはどれですか。",
      "kind": "knowledge",
      "claim": "24時間使える場所にあるか",
      "distractors": [
        "製造メーカー",
        "設置された年"
      ],
      "why": "店舗の中にあるAEDは営業時間外に使えません。「近くにあるが夜は取り出せない」という状況を事前に知っておくことが、実際に使えるかどうかを分けます。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-aed-use-1",
      "scope": "category",
      "key": "aed",
      "category": "aed",
      "context": "倒れている人を見つけたとき、AEDが届くまでにすべきことはどれですか。",
      "kind": "action",
      "claim": "大声で助けを呼び、胸骨圧迫を始める",
      "distractors": [
        "到着を静かに待つ",
        "体を揺すって起こす"
      ],
      "why": "心停止では時間の経過とともに救命率が下がります。周囲に声をかけて119番とAEDの手配を頼み、その間も胸骨圧迫を続けることが最も効果があります。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-shelter-action-1",
      "scope": "category",
      "key": "shelter",
      "category": "shelter",
      "context": "大きな地震で強い揺れを感じました。まずすることはどれですか。",
      "kind": "action",
      "claim": "頭を守って身を低くし、揺れが収まるのを待つ",
      "distractors": [
        "避難所へ向かって走り出す",
        "持ち出し袋をまとめる"
      ],
      "why": "揺れている最中に動くと、家具の転倒や落下物でけがをします。まず頭を守って身を低くし、収まってから移動してください。備蓄や持ち出し袋が役に立つのは、この最初の数十秒を生き延びた後です。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-shelter-flood-1",
      "scope": "category",
      "key": "shelter",
      "category": "shelter",
      "context": "大雨で道路が冠水しています。歩いて避難するとき、最も危険なのはどれですか。",
      "kind": "action",
      "claim": "外れたマンホールや側溝に落ちる",
      "distractors": [
        "靴が濡れる",
        "景色が見えにくい"
      ],
      "why": "濁った水では足元がまったく見えず、外れたマンホールや側溝への転落が起きています。膝の上まで水が来たら無理に歩かず、高い場所へ移動してください。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-shelter-open-1",
      "scope": "category",
      "key": "shelter",
      "category": "shelter",
      "context": "避難所について、行ってみるまで分からないことが多いのはどれですか。",
      "kind": "knowledge",
      "claim": "その時に開設されているか",
      "distractors": [
        "建物の名前",
        "おおよその場所"
      ],
      "why": "場所は公開データで分かりますが、開設状況は載っていません。「警報が出て避難所へ行ったら開いていなかった」という声は実際に寄せられています。だからこそ現地で確かめた情報に価値があります。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-shelter-toilet-1",
      "scope": "category",
      "key": "shelter",
      "category": "shelter",
      "context": "避難所でトイレが使いにくいと、なぜ命に関わるのですか。",
      "kind": "knowledge",
      "claim": "水を飲むのを控えてしまい、脱水から血栓ができやすくなる",
      "distractors": [
        "待ち時間が長くなる",
        "掃除の手間が増える"
      ],
      "why": "トイレが不衛生だったり夜に暗かったりすると、利用を避けようとして水分を控える人が出ます。脱水は血液を濃くし、エコノミークラス症候群の引き金になります。トイレは快適さではなく命の問題です。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-toilet-access-1",
      "scope": "category",
      "key": "accessible_toilet",
      "category": "accessible_toilet",
      "context": "車いすの人がトイレを使えるかどうかを左右するのは、次のうちどれですか。",
      "kind": "knowledge",
      "claim": "中で向きを変えられる広さがあるか",
      "distractors": [
        "鏡の大きさ",
        "壁の色"
      ],
      "why": "入口を通れても、中で方向転換できなければ使えません。旋回スペースの有無は写真で確認しやすく、当事者にとっては行けるかどうかを決める情報です。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-toilet-action-1",
      "scope": "category",
      "key": "accessible_toilet",
      "category": "accessible_toilet",
      "context": "車いすやベビーカーの家族と避難します。出発前にまず確かめることはどれですか。",
      "kind": "action",
      "claim": "通る道に段差や工事がないか",
      "distractors": [
        "避難所の建物が新しいか",
        "持ち物が全部そろっているか"
      ],
      "why": "避難所にたどり着けるかは、建物ではなく「そこまでの道」で決まります。段差や工事で通れないと、引き返す間に状況が悪くなります。持ち物をそろえるより先に、通れる道を決めてください。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-toilet-water-1",
      "scope": "category",
      "key": "accessible_toilet",
      "category": "accessible_toilet",
      "context": "断水したとき、避難所のトイレはどうなりますか。",
      "kind": "knowledge",
      "claim": "水洗が使えなくなり、携帯トイレや仮設の備えが必要になる",
      "distractors": [
        "自動で井戸水に切り替わる",
        "特に影響はない"
      ],
      "why": "断水すると水洗トイレは使えません。屋外の仮設トイレへ向かった高齢者が転倒し、動けなくなった事例も報告されています。携帯トイレやマンホールトイレの備えがあるかは重要な情報です。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-water-action-1",
      "scope": "category",
      "key": "water",
      "category": "water",
      "context": "地震の揺れが収まりました。水について、まずすることはどれですか。",
      "kind": "action",
      "claim": "断水する前に、浴槽などへ生活用水を確保する",
      "distractors": [
        "給水拠点へ向かう",
        "ペットボトルを買いに行く"
      ],
      "why": "断水は揺れの直後ではなく少し経ってから起きることがあります。まだ水が出るうちに浴槽へ溜めておけば、トイレや手洗いに使えます。給水拠点が開くまでには時間がかかるため、先に手元で確保するほうが確実です。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-water-route-1",
      "scope": "category",
      "key": "water",
      "category": "water",
      "context": "給水拠点へ水をもらいに行くとき、事前に知っておきたいのはどれですか。",
      "kind": "knowledge",
      "claim": "そこまでの道に段差や坂がないか",
      "distractors": [
        "拠点の建物の築年数",
        "周辺の店の営業時間"
      ],
      "why": "水は1リットルで1キログラムあります。10リットル運べば10キログラムで、段差や長い坂があると往復は大きな負担になります。道の状態は現地を歩いた人でないと分かりません。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    },
    {
      "entryId": "seed-water-supply-1",
      "scope": "category",
      "key": "water",
      "category": "water",
      "context": "断水に備えて、1人が1日に必要とされる飲料水の目安はどれくらいですか。",
      "kind": "knowledge",
      "claim": "約3リットル",
      "distractors": [
        "約0.5リットル",
        "約10リットル"
      ],
      "why": "飲料と調理をあわせて1人1日3リットルが目安です。3日分で9リットル、できれば1週間分の備蓄が推奨されています。運ぶ手段（給水タンクや台車）も一緒に考えておくと安心です。",
      "sources": [
        {
          "title": "イマノウチ・ヨリミチ 固定出題データ（チーム作成・一次資料の紐づけはレビュー時）",
          "url": "",
          "fetchedAt": "2026-08-22"
        }
      ],
      "reviewed": true
    }
  ]
}
