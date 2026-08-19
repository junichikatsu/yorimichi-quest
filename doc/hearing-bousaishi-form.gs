/**
 * YORIMICHI QUEST 防災士ヒアリング用 Google フォーム生成スクリプト
 *
 * 目的: Issue #14「収集する防災データ項目の定義（データ辞書 / FR-12-1）」の入力を集める
 * 設計: doc/hearing-bousaishi.md
 *
 * 使い方
 *   1. https://script.google.com/ で新しいプロジェクトを作る
 *   2. このファイルの内容を貼り付けて保存する
 *   3. 関数 createHearingForm を実行する（初回は Drive / Forms へのアクセス承認を求められる）
 *   4. 実行ログに出る「編集URL」「回答URL」を使う
 *
 * 生成物はマイドライブ直下に作られる。後からフォルダを移動しても動作に影響はない。
 */

var IMPORTANCE = ['有事の判断に必須', 'あると助かる', '不要／既存データで分かる'];

function createHearingForm() {
  var form = FormApp.create('【YORIMICHI QUEST】防災データ項目ヒアリング');

  form.setTitle('【YORIMICHI QUEST】防災データ項目ヒアリング');
  form.setDescription([
    'YORIMICHI QUEST は、市民の散歩や寄り道で防災・バリアフリーのミクロ情報を集め、行政オープンデータに不足している部分を補うサービスです（都知事杯オープンデータ・ハッカソン2026 応募プロジェクト）。',
    '',
    'いま決めたいのは「アプリで市民に何を記録してもらうか」の項目リストです。行政の公開データに載っている情報は集めても価値が薄いため、',
    '「公開データには無いが、避難行動の判断には必要な情報」を知りたいと考えています。',
    'そこで、日頃から現場を見ている防災士・消防団員の方に、担当エリアで実際に気にしている点をお聞きします。',
    '',
    '■ 所要時間: 10〜15分',
    '■ すべて任意回答です。関わりの薄いカテゴリは飛ばしていただいて構いません',
    '■ 無記名です。連絡先の入力欄は、追加ヒアリングにご協力いただける場合のみお使いください',
    '■ 回答はサービス設計の検討にのみ使用し、個人が特定される形での公開は行いません'
  ].join('\n'));

  form.setProgressBar(true);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(true);

  addRespondentSection(form);
  addCurrentPracticeSection(form);
  addShelterSection(form);
  addToiletSection(form);
  addAedSection(form);
  addWaterSection(form);
  addCommonSection(form);
  addGranularitySection(form);
  addPrioritySection(form);
  addFollowUpSection(form);

  Logger.log('編集URL: ' + form.getEditUrl());
  Logger.log('回答URL: ' + form.getPublishedUrl());
  return form;
}

/* ------------------------------------------------------------------ */
/* S1 回答者について                                                   */
/* ------------------------------------------------------------------ */

function addRespondentSection(form) {
  form.addPageBreakItem()
    .setTitle('S1. あなたについて')
    .setHelpText('回答の背景を把握するためにお聞きします。');

  form.addCheckboxItem()
    .setTitle('現在のお立場（当てはまるものすべて）')
    .setChoiceValues([
      '防災士',
      '消防団員',
      '自主防災組織・町会/自治会の防災担当',
      '自治体の防災担当職員',
      '要配慮者支援に関わる団体・事業者',
      '福祉・介護の実務者',
      '特に肩書はないが地域の防災活動に参加している'
    ])
    .showOtherOption(true);

  form.addMultipleChoiceItem()
    .setTitle('防災活動に関わっている年数')
    .setChoiceValues(['1年未満', '1〜3年', '3〜10年', '10年以上']);

  form.addTextItem()
    .setTitle('主な活動エリア（区市町村名まで）')
    .setHelpText('例: 東京都台東区。差し支えなければ、担当している地区名まで書いていただけると助かります。');

  form.addCheckboxItem()
    .setTitle('平常時の主な活動内容（当てはまるものすべて）')
    .setChoiceValues([
      '防災訓練の企画・運営',
      '避難所運営訓練（HUG など）',
      '地域の危険箇所の点検・防災まち歩き',
      '講話・啓発活動',
      '要配慮者の個別避難計画づくり・個別支援',
      'DIG（災害図上訓練）',
      '資機材の点検・管理'
    ])
    .showOtherOption(true);

  form.addMultipleChoiceItem()
    .setTitle('担当エリアの避難所や防災設備を、実際に足を運んで確認する頻度')
    .setChoiceValues([
      '月1回以上',
      '年に数回',
      '年1回程度（訓練のときのみ）',
      'ほとんど行かない',
      '自分では行かないが、行った人から話は聞く'
    ]);
}

/* ------------------------------------------------------------------ */
/* S2 いまの情報の使い方                                               */
/* ------------------------------------------------------------------ */

function addCurrentPracticeSection(form) {
  form.addPageBreakItem()
    .setTitle('S2. いま、防災情報をどう確認しているか')
    .setHelpText('既存の公開データで足りている部分と、足りていない部分を切り分けたいと考えています。');

  form.addCheckboxItem()
    .setTitle('避難所や防災設備の情報を確認するとき、何を見ますか（当てはまるものすべて）')
    .setChoiceValues([
      '自治体の防災マップ（紙）',
      '自治体・東京都のWebサイトや防災アプリ',
      '公開されているオープンデータ（CSVなど）',
      '自分で現地に行って確認する',
      '自分のメモ・写真・スプレッドシート',
      '地域の人や消防・行政職員に直接聞く',
      'Google マップなどの一般的な地図サービス'
    ])
    .showOtherOption(true);

  form.addMultipleChoiceItem()
    .setTitle('公開されている情報（防災マップ・自治体サイト・オープンデータ）が、現地の実態と違っていた経験はありますか')
    .setChoiceValues(['よくある', 'ときどきある', 'ほとんどない', 'わからない・比べたことがない']);

  form.addParagraphTextItem()
    .setTitle('上でご経験がある場合、具体的にどんな違いでしたか')
    .setHelpText('例: 記載どおりの入口が使えなかった／設備が撤去されていた／情報が古かった など。');

  form.addParagraphTextItem()
    .setTitle('【重要】担当エリアについて、公式な記録には残っていないが、あなたが把握している情報を教えてください')
    .setHelpText([
      'この設問がこのアンケートの中心です。思いつくままに、箇条書きで結構です。',
      '例: あの避難所は雨のとき校庭側の入口が使えない／この道は少しの雨で水たまりができる／団の資機材は◯◯に置いてある、など。',
      '「地元の人なら知っているが、どこにも書かれていない」ことを探しています。'
    ].join('\n'));
}

/* ------------------------------------------------------------------ */
/* S3〜S7 カテゴリ別                                                   */
/* ------------------------------------------------------------------ */

function addShelterSection(form) {
  var items = [
    '水害時に使えるかどうか（地震時のみ可か）',
    '車いすで入口までたどり着けるか（段差・スロープ）',
    '建物内のエレベーターの有無・使えるか',
    'ペット同伴が可能か・受入場所',
    '現在開設されているかどうかの分かり方',
    '受付から居住スペースまでの経路の段差',
    'トイレの便器の数（男女別の内訳）',
    'トイレの様式（洋式か）・車いす対応',
    '断水したときにトイレが使えるか（仮設トイレ・マンホールトイレの備え）',
    '要配慮者用のスペースの有無（福祉避難所に指定されているか）',
    '段ボールベッドなど、床に直接寝ないための備えがあるか',
    '備蓄品や給水の置き場所',
    '電源・充電できる場所、Wi-Fiの有無（停電時に冷暖房が使えるかを含む）',
    '夜間の照明・敷地内の見通し',
    '周辺で浸水しやすい道・通れなくなる道',
    '常駐の管理者・鍵の管理者が誰か'
  ];

  form.addPageBreakItem()
    .setTitle('S3. 避難所')
    .setHelpText('「有事に避難先を選ぶ・案内する」場面で、どの情報が判断を左右するかをお聞きします。');

  addImportanceGrid(form, '各項目の重要度', items);

  form.addCheckboxItem()
    .setTitle('このうち、現地で「写真1枚＋タップ数回」で答えられそうな項目')
    .setHelpText('アプリでは、歩きながら数十秒で答えられる形にしたいと考えています。写真を撮れば分かるもの、見ればすぐ選べるものを選んでください。')
    .setChoiceValues(items);

  form.addCheckboxItem()
    .setTitle('このうち、建物の中に入らないと確認できない項目')
    .setHelpText('指定避難所の多くは学校などで、普段は建物内に入れないと考えています。外から見て分かるものと、中に入れる機会でないと分からないものを分けたいので、後者を選んでください。')
    .setChoiceValues(items);

  form.addParagraphTextItem()
    .setTitle('避難所について、上の一覧に無いが必要な項目');
}

function addToiletSection(form) {
  var items = [
    '車いすが旋回できるスペースがあるか',
    'オストメイト（人工肛門・人工膀胱）対応設備の有無',
    '手すりの有無と位置（左右どちら側か）',
    '扉の形状（引き戸／開き戸／自動ドア）',
    '水栓・鍵の形状（レバー／ボタン／ひねる）',
    '入口の段差の高さ',
    '大人用ベッド・ベビーベッドの有無',
    '点字ブロック・音声案内の有無',
    '利用できる時間帯（施錠されるか）',
    '着替えスペースがあるか',
    '通路の幅（車いす・ベビーカーで通れるか）'
  ];

  form.addPageBreakItem()
    .setTitle('S4. バリアフリートイレ')
    .setHelpText('要配慮者やそのご家族が「そこを使えるか」を判断するための情報についてお聞きします。');

  addImportanceGrid(form, '各項目の重要度', items);

  form.addCheckboxItem()
    .setTitle('このうち、現地で「写真1枚＋タップ数回」で答えられそうな項目')
    .setChoiceValues(items);

  form.addParagraphTextItem()
    .setTitle('バリアフリートイレについて、上の一覧に無いが必要な項目');
}

function addAedSection(form) {
  var items = [
    '屋内か屋外か',
    '設置されている階',
    '24時間アクセスできるか',
    '施錠されているか・鍵の管理者',
    '見つけるための目印（◯◯の受付横 など）',
    '小児用パッド・小児モードの有無',
    '屋外ボックスの開け方（警報が鳴るか）',
    '建物が閉まっている時間帯に取り出せるか'
  ];

  form.addPageBreakItem()
    .setTitle('S5. AED')
    .setHelpText('「いま走って取りに行ける AED かどうか」を判断するための情報についてお聞きします。');

  addImportanceGrid(form, '各項目の重要度', items);

  form.addCheckboxItem()
    .setTitle('このうち、現地で「写真1枚＋タップ数回」で答えられそうな項目')
    .setChoiceValues(items);

  form.addParagraphTextItem()
    .setTitle('AEDについて、上の一覧に無いが必要な項目');
}

function addWaterSection(form) {
  var items = [
    'いま稼働しているか（停止・撤去されていないか）',
    '給水口の高さ（子ども・車いすで使えるか）',
    'マイボトルに給水できる形状か',
    '冷水か常温か',
    '冬期や夜間に止まるか',
    '屋根・日陰があるか（暑い時期に並べるか）',
    '周辺に座れる場所・トイレがあるか'
  ];

  form.addPageBreakItem()
    .setTitle('S6. 給水スポット（水飲み場・給水拠点）')
    .setHelpText('暑さ対策と、断水時の水の確保の両面でお聞きします。');

  addImportanceGrid(form, '各項目の重要度', items);

  form.addParagraphTextItem()
    .setTitle('給水スポットについて、上の一覧に無いが必要な項目');
}

function addCommonSection(form) {
  var items = [
    '防犯灯・街灯の有無（夜間の明るさ）',
    '夜間の見通し・人通り',
    '少しの雨で水がたまる場所',
    '倒れそうなブロック塀・自動販売機・電柱',
    '狭い道・行き止まり（緊急車両が入れない）',
    '消火栓・防火水槽の位置',
    '消防団の資機材・可搬ポンプの置き場所',
    '非常用電源・屋外コンセントの位置',
    '公衆電話・特設公衆電話の位置',
    '車いすやベビーカーで通れない歩道・踏切'
  ];

  form.addPageBreakItem()
    .setTitle('S7. 施設以外の、まちなかの情報')
    .setHelpText('特定の施設ではなく、道や街区について記録しておきたい情報をお聞きします。');

  addImportanceGrid(form, '各項目の重要度', items);

  form.addParagraphTextItem()
    .setTitle('まちなかの情報について、上の一覧に無いが必要な項目');
}

/* ------------------------------------------------------------------ */
/* S8 粒度・答えられる形                                               */
/* ------------------------------------------------------------------ */

function addGranularitySection(form) {
  form.addPageBreakItem()
    .setTitle('S8. どこまで細かく聞くべきか')
    .setHelpText('アプリは歩きながら数十秒で答えてもらう前提なので、質問の細かさを決めたいと考えています。');

  form.addMultipleChoiceItem()
    .setTitle('段差の高さは、どの形で記録すれば実用になりますか')
    .setChoiceValues([
      '「段差なし／2cm以下／2〜5cm／5cm超」のような選択肢で足りる',
      'おおよその数値（cm）まで欲しい',
      '正確な実測値が必要',
      '高さより「車いすで越えられるか」の判定だけあればよい'
    ])
    .showOtherOption(true);

  form.addMultipleChoiceItem()
    .setTitle('通路の幅や広さについては、どの形が実用になりますか')
    .setChoiceValues([
      '「車いすが回れる／通れるが回れない／通れない」の3択で足りる',
      'おおよその数値（cm）まで欲しい',
      '写真だけあれば見る側で判断できる'
    ])
    .showOtherOption(true);

  form.addParagraphTextItem()
    .setTitle('写真では判断できず、人が測る・誰かに聞かないと分からない項目はどれですか')
    .setHelpText('AIに写真から読み取らせる項目と、人に入力してもらう項目を分けたいと考えています。');

  form.addParagraphTextItem()
    .setTitle('この情報を残すなら、どう撮った写真が役に立ちますか')
    .setHelpText('例: 入口は正面から段差が見える高さで／AEDは周囲の目印が入るように引きで撮る、など。');

  form.addMultipleChoiceItem()
    .setTitle('現地で1スポットあたり答えてもらう質問数は、いくつまでが現実的だと思いますか')
    .setChoiceValues(['1〜2問', '3〜5問', '6〜10問', 'それ以上でも答える人はいる']);

  form.addMultipleChoiceItem()
    .setTitle('ご自身が、担当エリアの避難所の「建物の中」を見られる機会はどのくらいありますか')
    .setHelpText('避難所の内部情報を誰が記録できるのかを見極めたいと考えています。')
    .setChoiceValues([
      '避難所運営訓練などで定期的に入る',
      '年に1回程度は入る機会がある',
      '過去に入ったことはあるが、いまは機会がない',
      'ほとんど入る機会がない',
      'わからない'
    ]);

  form.addParagraphTextItem()
    .setTitle('避難所の中の情報（トイレの数、要配慮者スペースなど）は、どうやって集めるのが現実的だと思いますか')
    .setHelpText('例: 運営訓練のときにまとめて記録する／施設の管理者に聞く／行政が持っている資料にある、など。「そもそも公開すべきでない」というご意見も歓迎します。');
}

/* ------------------------------------------------------------------ */
/* S9 優先順位                                                         */
/* ------------------------------------------------------------------ */

function addPrioritySection(form) {
  form.addPageBreakItem()
    .setTitle('S9. 優先順位')
    .setHelpText('最初のバージョンで集める項目を絞り込みたいと考えています。');

  form.addParagraphTextItem()
    .setTitle('「まずこれだけ集まれば役に立つ」と思う項目を、多くて3つ挙げてください')
    .setHelpText('カテゴリをまたいで構いません。順位をつけていただけると助かります。');

  form.addParagraphTextItem()
    .setTitle('逆に、一般の市民に記録してもらうのは不安だと思う項目はありますか')
    .setHelpText('誤った情報が伝わると避難行動を誤らせる項目、判断が難しく人によってばらつく項目などを想定しています。理由も添えていただけると助かります。');

  form.addMultipleChoiceItem()
    .setTitle('市民が投稿した情報を、他の市民の確認（同じ場所に来た人が「合っている」と答える）で検証する仕組みは、実用に足ると思いますか')
    .setChoiceValues([
      '足りると思う',
      '項目によっては足りる',
      '専門知識のある人の確認が必要',
      '行政の確認が必要',
      'わからない'
    ]);

  form.addParagraphTextItem()
    .setTitle('こうしたアプリが担当エリアにあったら、活動のどんな場面で使えそうですか')
    .setHelpText('使えないと思う場合、その理由もぜひ教えてください。');
}

/* ------------------------------------------------------------------ */
/* S10 今後のご協力                                                    */
/* ------------------------------------------------------------------ */

function addFollowUpSection(form) {
  form.addPageBreakItem()
    .setTitle('S10. 今後のご協力について（任意）')
    .setHelpText('ここから先はすべて任意です。空欄のまま送信していただけます。');

  form.addMultipleChoiceItem()
    .setTitle('30分程度の個別ヒアリング（オンライン可）にご協力いただけますか')
    .setChoiceValues(['協力できる', '内容によっては協力できる', '今回は難しい']);

  form.addTextItem()
    .setTitle('お名前またはニックネーム')
    .setHelpText('個別ヒアリングをご希望の場合のみ。');

  form.addTextItem()
    .setTitle('ご連絡先（メールアドレス）')
    .setHelpText('個別ヒアリングのご連絡にのみ使用し、他の目的には使用しません。');

  form.addParagraphTextItem()
    .setTitle('その他、伝えておきたいこと');
}

/* ------------------------------------------------------------------ */
/* 共通ヘルパー                                                        */
/* ------------------------------------------------------------------ */

function addImportanceGrid(form, title, rows) {
  form.addGridItem()
    .setTitle(title)
    .setHelpText('すでに公開データや現地の掲示で分かる項目は「不要／既存データで分かる」を選んでください。判断がつかない行は空欄で構いません。')
    .setRows(rows)
    .setColumns(IMPORTANCE);
}
