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
 * 件数: 全 28 件（確認済み 12 件 / **未確認 16 件**）
 * 内訳: カテゴリ 28 / 町丁目 0 / スポット 0
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
      "entryId": "gen-accessible_toilet-1",
      "scope": "category",
      "key": "accessible_toilet",
      "category": "accessible_toilet",
      "context": "",
      "kind": "action",
      "claim": "オストメイト設備は、給水と給湯の蛇口を実際にひねり、汚物流しの排水が流れるところまで確かめて記録する。",
      "distractors": [
        "案内表示やマークにオストメイト対応と出ていれば、使える状態だと判断してよい",
        "使えるかどうかは、実際にオストメイトの人が来たときに確かめればよい"
      ],
      "why": "ストーマ装具の交換と洗浄には流水が必要で、水が出なければその場では対応できません。使えないことを災害後に初めて知ると、他のトイレを探して移動する時間と体力を失います。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-accessible_toilet-2",
      "scope": "category",
      "key": "accessible_toilet",
      "category": "accessible_toilet",
      "context": "",
      "kind": "action",
      "claim": "手すりは体重をかけて押し引きし、ぐらつきや固定部のゆるみがないところまで確かめる。",
      "distractors": [
        "手すりが取り付けられていることを目で見て確認できれば十分",
        "手すりがなくても、壁や便器のふたに手をついて立ち座りすればよい"
      ],
      "why": "手すりは全体重を預ける場所なので、ゆるんでいれば体を支えられず転倒します。避難生活中の骨折は歩けなくなることに直結し、その後の避難や受診が難しくなります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-accessible_toilet-3",
      "scope": "category",
      "key": "accessible_toilet",
      "category": "accessible_toilet",
      "context": "",
      "kind": "knowledge",
      "claim": "オストメイト用の汚物流しは水と排水があって初めて機能し、断水すると装具の洗浄も排出物の処理も代わりがきかない。",
      "distractors": [
        "オストメイトの人も、一般の便器を使えば同じように処理できる",
        "オストメイト設備は水が止まっていても使える"
      ],
      "why": "処理できないと排出物が皮膚に触れ続け、皮膚障害や感染につながります。トイレを我慢するために水分を控えると、脱水や血栓のリスクが上がります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-accessible_toilet-4",
      "scope": "category",
      "key": "accessible_toilet",
      "category": "accessible_toilet",
      "context": "",
      "kind": "knowledge",
      "claim": "バリアフリートイレは建物に1か所しかないことが多く、車いす利用者、オストメイト、乳幼児連れ、介助が必要な人の利用が重なる。",
      "distractors": [
        "バリアフリートイレは車いす利用者専用なので、他の人と重なることはない",
        "一般トイレが混雑していても、バリアフリートイレは空いている"
      ],
      "why": "1か所しかない設備が使用中や故障だと、待てない人がその場で行き詰まります。近くの別のバリアフリートイレをあらかじめ知っておくことが、我慢による体調悪化を防ぎます。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-aed-1",
      "scope": "category",
      "key": "aed",
      "category": "aed",
      "context": "",
      "kind": "action",
      "claim": "AEDを取りに行く人を「あなたが行ってください」と指名して頼む。",
      "distractors": [
        "周りの人全員に呼びかければ、誰かが自然にAEDを持ってきてくれる",
        "救急隊が到着するまで待ち、AEDは隊員に使ってもらう"
      ],
      "why": "漠然と呼びかけると全員が「自分以外が動く」と考えて誰も動かず、AEDの到着が数分遅れます。心停止では1分ごとに救命率が約7〜10%下がるため、指名して役割を確定させることが生死を分けます。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-aed-2",
      "scope": "category",
      "key": "aed",
      "category": "aed",
      "context": "",
      "kind": "action",
      "claim": "AEDのふたを開けて電源を入れ、音声ガイダンスの指示どおりに操作する。",
      "distractors": [
        "使い方を知らない人が触ると危険なので、講習を受けた人が来るまで待つ",
        "電気ショックが必要かどうかを自分で判断してからパッドを貼る"
      ],
      "why": "AEDは心電図を自動解析し、ショックが不要なら通電しない仕組みで、資格がなくても市民が使えます。ためらって待つ時間がそのまま心停止の時間になり、脳へのダメージが進みます。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-aed-3",
      "scope": "category",
      "key": "aed",
      "category": "aed",
      "context": "",
      "kind": "knowledge",
      "claim": "AEDが建物の外に設置されていれば、施設が閉まっている夜間や休日でも取りに行ける。",
      "distractors": [
        "AEDは精密機器なので、屋内の受付や事務室に置くのが望ましい",
        "屋外設置のAEDは雨や気温の影響で作動しないことがある"
      ],
      "why": "心停止は深夜や休日にも起こりますが、屋内設置だと施錠された時間帯はまったく使えません。屋外設置なら時間帯を問わず取り出せるため、設置場所が屋内か屋外かを事前に知っておくことが重要です。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-aed-4",
      "scope": "category",
      "key": "aed",
      "category": "aed",
      "context": "",
      "kind": "knowledge",
      "claim": "AEDは入口から見える位置にあるほど、到着した人が迷わず取り出せる。",
      "distractors": [
        "AEDは目立たない場所に置いたほうが、いたずらや盗難を防げて安全",
        "設置場所は施設の職員が把握していれば、案内表示は必要ない"
      ],
      "why": "探し回る時間は胸骨圧迫が止まる時間でもあり、そのまま救命率の低下につながります。初めて訪れた人でも入口から視認できることが、数分の短縮を生みます。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-shelter-1",
      "scope": "category",
      "key": "shelter",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "避難所に着いたら、まず受付で名簿に自分と家族の名前を登録する。",
      "distractors": [
        "短時間だけ休むつもりなら受付を通さなくてよい",
        "物資や毛布を受け取らないなら名簿の記入は必要ない"
      ],
      "why": "名簿は安否確認と家族の再会、必要な物資量の把握に使われ、登録がないと救助側から「所在不明」のまま扱われます。医療や配慮の必要も受付を通して初めて共有されます。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-shelter-2",
      "scope": "category",
      "key": "shelter",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "入口の段差やドアの幅で入れないときは、その場で運営者や職員に伝えて、別の出入口や介助の手配を求める。",
      "distractors": [
        "段差がある施設は車いすやベビーカーでは使えないので、別の避難所を探すしかない",
        "バリアフリー表示がない避難所は受け入れを断られる決まりになっている"
      ],
      "why": "多くの施設は仮設スロープや人手による介助、通常は使わない出入口で対応できますが、伝えない限り運営者は困っている人がいることに気づけません。入口で引き返して屋外や自宅に戻ることが、低体温症や余震による被害につながります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-shelter-3",
      "scope": "category",
      "key": "shelter",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "オストメイト対応の設備（装具を洗浄・処理できる流しなど）は多機能トイレの中に置かれることが多いが、すべての避難所にあるわけではない。",
      "distractors": [
        "多機能トイレがあればオストメイト対応の設備も必ず備わっている",
        "装具の交換は一般の個室トイレでも同じように行える"
      ],
      "why": "装具を適切に交換・洗浄できないと排泄物の漏れによる皮膚障害や感染が起こり、避難生活の中では治療が遅れて重症化しやすくなります。設備の有無を先に確認できれば、予備の装具や洗浄用の水を持って避難する判断ができます。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-shelter-4",
      "scope": "category",
      "key": "shelter",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "ペットと一緒に避難すること（同行避難）と、屋内で同じ空間に滞在できること（同伴避難）は別の扱いで、居場所の条件は施設ごとに決められている。",
      "distractors": [
        "同行避難が認められている避難所では、ペットと同じ部屋で過ごせる",
        "ペットは避難所に連れて行けないと全国一律で決まっている"
      ],
      "why": "多くの場合ケージや屋根のある別スペースでの受け入れとなるため、キャリーやリード、数日分の餌を用意しておけば受け入れ条件を満たせます。「連れて行けない」と思い込んで自宅に留まる選択が、津波や火災、家屋倒壊からの逃げ遅れに直結します。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-water-1",
      "scope": "category",
      "key": "water",
      "category": "water",
      "context": "",
      "kind": "action",
      "claim": "給水スポットへ向かう前に、口の広い空容器と、運搬用の台車やキャリーカートを用意する。",
      "distractors": [
        "断水時は給水場所で容器が配られるので、手ぶらで行けばよい",
        "運ぶ回数を減らせるので、容器は20リットルなど大きいものを選ぶとよい"
      ],
      "why": "水は1リットルで約1キログラムあり、抱えて運べる量は思ったより少ないため、容器と運搬手段がないと必要量を持ち帰れません。無理に抱えて運ぶと転倒やけが、腰の故障につながり、その後の避難行動ができなくなります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-water-2",
      "scope": "category",
      "key": "water",
      "category": "water",
      "context": "",
      "kind": "action",
      "claim": "使う前に、その給水スポットが改札の内側など入場や利用手続きが必要な区域にあるかを確認する。",
      "distractors": [
        "駅の構内にある給水スポットは、駅の外からでも自由に使える",
        "地図やアプリに載っている給水スポットは、いつでも誰でも入れる場所にある"
      ],
      "why": "断水時は容器を持って移動するだけで体力と時間を消耗するため、到着してから入れないと分かると次の場所へ向かう余力が残りません。真夏や高齢者・小さな子ども連れでは、この一往復の無駄が脱水や熱中症に直結します。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-water-3",
      "scope": "category",
      "key": "water",
      "category": "water",
      "context": "",
      "kind": "knowledge",
      "claim": "蛇口や給水口の高さと足元の空間の広さが、車いすの人や子どもが自分で水をくめるかどうかを決める。",
      "distractors": [
        "付き添う人がいれば、設備の高さや足元の広さは問題にならない",
        "しゃがんだり背伸びをすれば誰でも使えるので、高さは気にしなくてよい"
      ],
      "why": "自分で水を確保できるかどうかは、支援が届かない時間帯に飲む水があるかどうかを分けます。無理な姿勢での給水は転倒や容器の落下を招き、災害時のけがは治療も避難も難しくなります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "gen-water-4",
      "scope": "category",
      "key": "water",
      "category": "water",
      "context": "",
      "kind": "knowledge",
      "claim": "給水口にボトルを直接置けるかどうかで、その場で飲むだけの設備か、水を持ち帰れる設備かが変わる。",
      "distractors": [
        "給水スポットと呼ばれる設備なら、どれでも容器に直接水を入れられる",
        "上向きに水が出る水飲み場でも、時間をかければ同じように容器を満たせる"
      ],
      "why": "断水時に必要なのは持ち帰れる水であり、その場で飲めるだけの設備では自宅や避難先で使う分を確保できません。家族の分を運べる場所かどうかを事前に知っておくと、断水直後の限られた時間を移動に無駄にしません。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。**未レビュー。一次資料の確認が必要**",
          "url": "",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
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
