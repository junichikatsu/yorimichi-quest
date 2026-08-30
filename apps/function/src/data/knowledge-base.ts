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
 * 件数: 全 44 件（確認済み 12 件 / **未確認 32 件**）
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
      "claim": "バリアフリートイレに着いたら、オストメイト設備の水が実際に出るか、汚物流しが詰まっていないかを自分で確かめ、使えないときはすぐ施設の運営者に別の場所と手段を相談する。",
      "distractors": [
        "案内表示や施設の一覧にオストメイト設備と書かれていれば、災害時もそのまま使える",
        "装具の交換は普通の個室トイレでもできるので、設備の状態確認は落ち着いてからでよい"
      ],
      "why": "オストメイトの装具交換は水がないと汚物や皮膚の処理ができず、皮膚炎や感染、装具の漏れにつながります。使えないと分かるのが遅れるほど、代わりの水や物資を確保する時間がなくなります。",
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
      "claim": "便座に座る前に、そばの手すりを握ってぐらつかないかを確かめ、体重を預けられないと感じたら介助を頼むか別の場所を使う。",
      "distractors": [
        "手すりが付いていれば、固定の状態まで確かめる必要はない",
        "手すりがない個室でも、壁や扉に手をついて立ち座りすればよい"
      ],
      "why": "立ち座りは転倒が最も起きやすい動作で、便器や床に頭を打てば重い外傷になります。高齢者が大腿骨を折ると、その後の避難生活を自力で続けられなくなります。",
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
      "claim": "バリアフリートイレは1つの施設に1か所しかないことが多く、車いすの人、オストメイト、介助が必要な人、乳幼児連れが同じ1室に集中する。",
      "distractors": [
        "バリアフリートイレは車いす利用者専用なので、ほかの人と重なることはない",
        "数が少なくても、順番に使えば待ち時間はほとんど出ない"
      ],
      "why": "待ち時間が長いと、排泄を我慢したり水分を控えたりする人が出ます。避難生活での水分不足は脱水、膀胱炎、血のかたまりが肺に詰まる病気(エコノミークラス症候群)につながり、死亡例もあります。",
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
      "claim": "バリアフリートイレは中から施錠して1人で使うため、非常呼び出しボタンや外から解錠できる仕組みがなければ、中で倒れても外から気づかれない。",
      "distractors": [
        "非常呼び出しボタンは、どのバリアフリートイレにも必ず付いている",
        "中で倒れても、声を出せば外を通る人が気づいてくれる"
      ],
      "why": "個室内での転倒や持病の急変は、発見が遅れるほど命に関わります。呼び出す手段がない場所を使うときは、外で誰かに待ってもらうか、声をかけてもらう約束をしておく必要があります。",
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
      "claim": "AEDは自分で取りに行かず、周囲の特定の人を指さして「AEDを持ってきてください」と名指しで頼む。",
      "distractors": [
        "自分がいちばん場所を知っているなら、胸骨圧迫を中断して自分で取りに行く",
        "周りに人が集まっていれば、誰かが気づいてAEDを持ってきてくれる"
      ],
      "why": "胸骨圧迫が止まると脳や心臓への血流が途絶えるため、圧迫はAED到着まで続ける必要があります。名指しせずに呼びかけると誰も動かないことがあり、その数分が生死を分けます。",
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
      "claim": "AEDが届いたらすぐにふたを開け、電源を入れて音声ガイダンスの指示どおりに操作する。",
      "distractors": [
        "講習を受けた人が来るまで、AEDには手を触れずに待つ",
        "電気ショックが必要かどうかを自分で見極めてからボタンを押す"
      ],
      "why": "AEDは心電図を自動で解析し、必要なとき以外はショックを流さない設計です。電気ショックは1分遅れるごとに救命の可能性が下がるため、待つ時間そのものが命を削ります。",
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
      "claim": "AEDが屋外の収納ボックスに設置されていれば、建物が閉まっている時間帯でも取り出せる。",
      "distractors": [
        "AEDは精密機器なので、屋内の受付や事務室に置くのが望ましい",
        "夜間や休日は施設が閉まっているので、AEDは使えないものと考えておくほうがよい"
      ],
      "why": "心停止は夜間や休日にも起こり、建物が施錠されていると屋内のAEDには手が届きません。屋外設置かどうかを普段から知っておくと、探し回る時間をなくせます。",
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
      "claim": "AEDは入口や通路など見える位置にあり、案内表示が出ているほど短時間で持ち出せる。",
      "distractors": [
        "AEDは盗難やいたずらを防ぐため、人目につかない場所に保管したほうがよい",
        "設置場所は施設の職員が把握していれば十分で、外から見える表示は必要ない"
      ],
      "why": "探している時間は胸骨圧迫が止まる時間や除細動の遅れに直結します。場所がすぐ目に入れば、居合わせた誰でも数十秒で持ち出して使えます。",
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
      "claim": "避難所に着いたら最初に受付を済ませ、名前・人数と、車いす・ベビーカー・介助・医療などの必要な配慮をその場で伝える。",
      "distractors": [
        "場所を確保して落ち着いてから、あとでまとめて受付すればよい",
        "短時間立ち寄るだけなら受付はしなくてよい"
      ],
      "why": "受付名簿は物資や食料の数、安否照会、個別支援の割り振りの基礎になります。登録が漏れると必要な支援や薬が届かず、家族や職場からの安否確認もできません。",
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
      "claim": "ペットと避難するときは、自宅を出る前にケージ・リード・数日分のフードと薬を用意し、避難所の掲示や受付で受け入れ方法を確認する。",
      "distractors": [
        "ペット同伴の掲示が無い避難所には連れて行けないので、自宅に残るしかない",
        "ペットと一緒に避難できる避難所なら、人と同じ部屋で一緒に過ごせる"
      ],
      "why": "ペットを理由に避難をためらうと、浸水や倒壊の危険が残る自宅に留まることになります。受け入れ方法を先に確認すれば、飼い主自身が逃げ遅れずに済みます。",
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
      "claim": "指定緊急避難場所は災害の危険から命を守るために一時的に逃げる場所で、指定避難所は自宅に戻れない人が滞在する場所であり、役割が異なる。",
      "distractors": [
        "どの施設も災害の種類に関係なく同じように使える",
        "学校や公園は自動的に避難場所と避難所の両方を兼ねている"
      ],
      "why": "施設ごとに対応する災害（洪水・土砂災害・地震など）が指定されています。役割や対応災害を混同すると、浸水する場所や崖の近くへ避難してしまう危険があります。",
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
      "claim": "オストメイト（人工肛門・人工膀胱）の人はストーマ装具の交換に汚物流しや温水などの設備が必要で、一般のトイレでは対応できないことがある。",
      "distractors": [
        "多目的トイレがあれば、オストメイト対応の設備も必ず備わっている",
        "ストーマ装具は数日交換しなくても支障はない"
      ],
      "why": "装具を交換できないと排泄物の漏れや皮膚障害、感染につながります。交換を避けようとして水分や食事を控えると、体調悪化を招きます。",
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
      "claim": "給水スポットへ行くときは、口が広く運べる重さの容器を自分で持って行く。",
      "distractors": [
        "給水スポットには容器が備え付けられているので、手ぶらで行けばよい",
        "一度で多く汲めるよう、20リットルのタンクを一つだけ持って行く"
      ],
      "why": "水は1リットルで約1キログラムあり、大きすぎる容器は満水にすると持ち上げられず、その場に置いて帰ることになります。運べる重さに分けた容器がないと、せっかく給水できても自宅まで水が届きません。",
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
      "claim": "平常時に一度立ち寄り、自分のボトルに直接入れられるか、改札やゲートの外から使えるかを実際に確かめる。",
      "distractors": [
        "駅や公共施設の中にある水なら、誰でもいつでも使える",
        "災害時には案内が出るので、事前に場所を見ておく必要はない"
      ],
      "why": "改札の内側にある設備は入場しないと使えず、注ぎ口の形によっては手持ちの容器に入れられません。断水してから気づくと、水を求めて移動を繰り返すことになり、体力と時間を失います。",
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
      "claim": "注ぎ口が座ったままの高さで使えるかどうかで、車いすの人や子どもが自分で水を汲めるかが決まる。",
      "distractors": [
        "付き添いの人がいれば、注ぎ口の高さは問題にならない",
        "高さへの配慮は背の低い子ども向けのもので、車いすの人には関係ない"
      ],
      "why": "断水が続くと給水は一度で終わらず、何度も往復する行動になります。自分で汲めない高さだと毎回だれかの手を借りることになり、支援が途切れたときに水分が取れなくなります。",
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
      "claim": "汲んだ水道水は時間とともに消毒の効果が弱まるため、飲用には長く置かず早めに使い切る。",
      "distractors": [
        "市販のペットボトルの水と同じように、数か月は保存できる",
        "汲んだ水は沸かしておけば、より長く保存できる"
      ],
      "why": "容器の中で細菌が増えた水を飲むと、下痢や吐き気で体から水分が失われます。断水中の脱水は медのケアにつながりにくく、特に子どもと高齢者では体調が急に悪化します。",
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
      "entryId": "haz-flood-deep-1",
      "scope": "hazard",
      "key": "flood-deep",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "浸水想定区域の外にある避難先と、徒歩でも行ける経路を平常時に決めて家族と共有しておく。",
      "distractors": [
        "避難先や経路は、避難情報が出てから家族と相談して決めれば間に合う。",
        "移動先は自治体が指定した避難場所の中からしか選べない。"
      ],
      "why": "3m以上の浸水が想定される場所では区域の外まで移動する必要があり、移動距離が長いぶん判断が遅れると道路が冠水して徒歩でも通れなくなる。行き先を決めていないと家族が別々の場所を探して合流できず、増水した水路や道路に迷い込む危険が高まる。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水の浸水想定区域（最大 3m以上）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-deep-2",
      "scope": "hazard",
      "key": "flood-deep",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "深い浸水が想定される場所では、水が引くまでに時間がかかり、建物の上の階が浸水を免れても電気・水道・エレベーターが止まって孤立するおそれがある。",
      "distractors": [
        "上の階に水と食料を備えておけば、浸水しても外に出ずに過ごせる。",
        "浸水した水は雨がやめばすぐに引くので、一晩待てば外に出られる。"
      ],
      "why": "孤立すると救助を待つ間に持病の薬や医療機器の電源が絶たれ、体調の悪化が命に直結する。水没した建物は救助隊もボートやヘリでしか近づけず、助けが届くまで数日かかることがある。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水の浸水想定区域（最大 3m以上）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-hightide-deep-1",
      "scope": "hazard",
      "key": "flood-hightide-deep",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "この場所の浸水想定は2階でも危険が及ぶ深さのため、避難情報が出たら上の階へ上がるのではなく、浸水想定区域の外へ移動する。",
      "distractors": [
        "鉄筋コンクリートなど頑丈な建物であれば、3階以上に上がることで区域の外へ出なくてもよい。",
        "水が道路に上がり始めてから移動を始めれば、区域の外まで間に合う。"
      ],
      "why": "3m以上の浸水が起きた場合、2階に留まると水位より下になり逃げ場を失う。停電や断水で救助を待つ間の孤立も長引くため、水が来る前に区域の外へ出ておく必要がある。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水と高潮の浸水想定区域（最大 3m以上）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-hightide-deep-2",
      "scope": "hazard",
      "key": "flood-hightide-deep",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "3m以上という浸水想定の深さは、建物の2階にいても安全とは言えないことを意味する。",
      "distractors": [
        "3mは大人の身長より少し高い程度なので、2階まで上がれば水面より上にいられる。",
        "示された深さは道路面での値であり、建物の中の水位はそこまで上がらない。"
      ],
      "why": "深さの意味を取り違えると「上の階へ上がれば足りる」と判断し、立ち退きの機会を失う。浸水が始まってからでは徒歩でも車でも移動が難しくなり、溺水や長期の孤立につながる。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水と高潮の浸水想定区域（最大 3m以上）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-hightide-mid-1",
      "scope": "hazard",
      "key": "flood-hightide-mid",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "この場所の浸水想定は1階が水没しうる深さのため、避難するときは建物の2階以上に上がる。",
      "distractors": [
        "この深さの想定なら、玄関や窓を土のうや止水板でふさげば1階に留まれる。",
        "浸水が始まってから、水の深さを見て歩いて別の場所へ移ればよい。"
      ],
      "why": "1階が水没しうる想定の深さでは、1階に残ると出入口や階段が使えなくなり逃げ道を失う。水が流れ出すと歩行も車の移動も困難になるため、水が来る前に上の階へ移動しておくことが生死を分ける。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水と高潮の浸水想定区域（最大 0.5〜3m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-hightide-mid-2",
      "scope": "hazard",
      "key": "flood-hightide-mid",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "この場所では、川からの洪水と、台風などで海から押し寄せる高潮の両方による浸水が想定されている。",
      "distractors": [
        "強い雨が降っていなければ、浸水のおそれはない。",
        "川から離れていれば、浸水想定の対象にはならない。"
      ],
      "why": "高潮は雨量ではなく台風の風や気圧によって海面が上がって起こるため、雨や川の水位だけを見ていると避難の判断が遅れる。二つの原因があることを知っておけば、どの警報や情報で動き始めるかを前もって決めておける。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水と高潮の浸水想定区域（最大 0.5〜3m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-hightide-shallow-1",
      "scope": "hazard",
      "key": "flood-hightide-shallow",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "避難所へ向かう途中で道路が浸水していたら、その水の中を歩かず、近くの頑丈な建物の上の階へ入って情報を確認し続ける。",
      "distractors": [
        "足首程度の深さなら流されないので、浸水した道を歩いて通り抜けてよい",
        "浸水した道でも自動車を使えば安全に通過できる"
      ],
      "why": "水が濁っていると、ふたの外れたマンホールや側溝、道路の段差が水面下で見えなくなり、転落や転倒で身動きが取れなくなる。膝より浅い流れでも足をすくわれて流されることがある。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水と高潮の浸水想定区域（最大 0.5m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-hightide-shallow-2",
      "scope": "hazard",
      "key": "flood-hightide-shallow",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "避難する場所は災害の種類ごとに指定されているため、地震のときに向かう場所が水害のときにも使えるとはかぎらない。",
      "distractors": [
        "避難する場所は一度指定されれば、どの災害でも同じ場所へ行けばよい",
        "一番近い避難所へ行けば、災害の種類にかかわらず受け入れてもらえる"
      ],
      "why": "水害のときに使えない場所へ向かうと、たどり着いても入れず、水が迫る中で移動をやり直すことになる。水害で安全に動ける時間は限られるため、種類ごとの指定を平常時に確かめておく必要がある。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水と高潮の浸水想定区域（最大 0.5m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-mid-1",
      "scope": "hazard",
      "key": "flood-mid",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "避難情報や川の水位の情報を確認し、水が来る前の明るい時間帯に移動を終える。",
      "distractors": [
        "水が実際に足元まで来てから動き出しても間に合う",
        "夜になって道路がすいてから車で移動したほうが安全だ"
      ],
      "why": "浸水が始まると側溝やマンホールの位置が水面下に隠れ、浅い流れでも歩行や車の走行が難しくなります。暗くなると水路と道路の境目が見えず、転落や車の立ち往生で逃げ道を失う危険が高まります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水の浸水想定区域（最大 0.5〜3m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-mid-2",
      "scope": "hazard",
      "key": "flood-mid",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "洪水は川の水位が上がって起こるため、自分のいる場所で雨が弱まった後や降っていないときにも浸水が及ぶことがある。",
      "distractors": [
        "自分のいる場所の雨がやめば浸水の心配はなくなる",
        "浸水するかどうかは、その地域での雨の降り方だけで決まる"
      ],
      "why": "上流に降った雨が川を下って到達するまでには時間差があります。雨がやんだことを安全の合図と受け取ると、上の階へ移動する判断が遅れ、1階が水に浸かる状況で身動きが取れなくなるおそれがあります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水の浸水想定区域（最大 0.5〜3m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-shallow-1",
      "scope": "hazard",
      "key": "flood-shallow",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "この場所の浸水想定は足首程度の深さのため、避難情報が出たら屋外へ移動するのではなく、建物の中に留まって情報を確認し続ける。",
      "distractors": [
        "浸水想定の深さが浅くても、避難情報が出たら屋外の避難場所まで歩いて移動する。",
        "浸水が浅いうちに車を安全な場所へ動かしてから、自分の避難行動を始める。"
      ],
      "why": "足首程度の浅い流れでも足をとられて転倒し、水中で見えなくなった側溝やマンホールの開口部に落ちる危険があるため、留まれる建物から出る行動そのものが命の危険を増やします。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水の浸水想定区域（最大 0.5m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-flood-shallow-2",
      "scope": "hazard",
      "key": "flood-shallow",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "0.5m未満という浸水想定の深さは、足首程度の浸水を意味し、建物の中に留まって身を守れる目安となる。",
      "distractors": [
        "0.5m未満という想定は、その場所には川からの浸水が及ばないことを意味する。",
        "0.5m未満の浸水なら、車で問題なく通り抜けて移動できる。"
      ],
      "why": "深さの意味を「浸水しない」と取り違えると水や停電への備えを怠り、逆に危険と取り違えると浸水した屋外へ出てしまいます。浅い浸水でも車は走行できなくなり車内に閉じ込められることがあります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 洪水の浸水想定区域（最大 0.5m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-hightide-mid-1",
      "scope": "hazard",
      "key": "hightide-mid",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "高潮のおそれが伝えられたときは、暴風が吹き始める前に移動を終える。",
      "distractors": [
        "高潮は雨による浸水なので、雨が弱まってから移動すればよい。",
        "浸水が始まってから移動を始めても間に合う。"
      ],
      "why": "高潮をもたらす台風では、水位が上がる前から暴風や飛来物で屋外の移動が危険になり、動けるうちに移動を終えていないと逃げ場を失う。浸水が始まってからの徒歩移動は、わずかな深さでも足を取られて流される。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 高潮の浸水想定区域（最大 0.5〜3m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-hightide-mid-2",
      "scope": "hazard",
      "key": "hightide-mid",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "高潮は台風などの低い気圧と強い風で海面が持ち上げられて起こり、満潮の時刻と重なると水位がより高くなる。",
      "distractors": [
        "高潮は大雨が川から海へ流れ込んで海面が上がる現象である。",
        "高潮は地震で起こる津波と同じ仕組みで発生する。"
      ],
      "why": "雨の強さだけを見て判断すると、雨が弱いまま海側から浸水が及ぶ状況に備えられない。台風の接近時刻と満潮の時刻が重なるかどうかで危険の大きさが変わるため、避難を始める時間の判断に直結する。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 高潮の浸水想定区域（最大 0.5〜3m未満）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-hightide-unknown-1",
      "scope": "hazard",
      "key": "hightide-unknown",
      "category": "shelter",
      "context": "",
      "kind": "action",
      "claim": "台風の接近が伝えられた時点で、この場所の高潮の浸水想定の深さを確認し、上の階に上がるか区域の外へ移動するかを先に決める。",
      "distractors": [
        "高潮のときは、実際に水が上がってきてから深さを見て判断すれば間に合う。",
        "建物に2階以上あれば、想定される深さを確認しなくても上の階に上がれば安全である。"
      ],
      "why": "想定される深さによって「上の階へ」と「区域の外へ」のどちらが正しいかが変わり、選択を誤ると逃げ場のない場所に取り残されます。高潮は台風の暴風とともに水位が上がるため、水が見えてからでは移動も判断もできなくなります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 高潮の浸水想定区域（最大 深さ不明）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
          "fetchedAt": "2026-08-30"
        }
      ],
      "reviewed": false
    },
    {
      "entryId": "haz-hightide-unknown-2",
      "scope": "hazard",
      "key": "hightide-unknown",
      "category": "shelter",
      "context": "",
      "kind": "knowledge",
      "claim": "高潮の海水は河口や運河をさかのぼって流れ込むため、海岸から離れた場所でも浸水が想定されている。",
      "distractors": [
        "高潮の浸水は海に面した場所だけで起こり、海から離れていれば及ばない。",
        "高潮の浸水は堤防のすぐ内側にとどまり、内陸側へは広がらない。"
      ],
      "why": "海が見えない場所でも浸水想定区域に含まれることがあり、「ここは海から遠い」という思い込みが避難の遅れにつながります。低い土地では水路づたいに水が入り、周囲より先に水位が上がることがあります。",
      "sources": [
        {
          "title": "生成（OrcaRouter 経由 anthropic/claude-opus-5）。条件: 高潮の浸水想定区域（最大 深さ不明）。**未レビュー**",
          "url": "",
          "fetchedAt": "2026-08-30"
        },
        {
          "title": "国土交通省 ハザードマップポータルサイト（洪水浸水想定区域・高潮浸水想定区域）",
          "url": "https://disaportal.gsi.go.jp/",
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
