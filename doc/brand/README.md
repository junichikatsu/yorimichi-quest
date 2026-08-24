# アイコン

イマノウチ・ヨリミチのアイコン。**図案はファビコンと同じもの**で、置き方だけ用途に合わせて変えてある。

| ファイル | 用途 | 寸法 |
| :--- | :--- | :--- |
| `icon-line-miniapp.svg` | **元データ。** ここを直して PNG を書き出す | 130 グリッド |
| `icon-line-miniapp-1024.png` | **LINE Developers コンソールへ上げるのはこれ** | 1024×1024 |
| `icon-line-miniapp-390.png` | 指定寸法の3倍。1024 が重いと言われた場合の控え | 390×390 |
| `icon-line-miniapp-130.png` | 指定寸法そのまま。表示に近い見え方の確認用 | 130×130 |

**上げ先**：LINE Developers コンソール → ミニアプリのチャネル → 「チャネル基本設定」→ チャネルアイコン。

## 図案と色

**「寄り道の道すじ＋現在地」。** まっすぐではなく曲がってたどり着く道と、その先の到達点の丸。サービス名（ヨリミチ）と形を一致させている。

**色は提出資料（pptx）から採っている。** アプリ画面の `--accent`（`#6b4e8f`・紫）は使わない。

| | 地 | 図案 |
| :--- | :--- | :--- |
| LINE アイコン・アプリのファビコン | `#1B3B2B` | `#7CB342` |
| ダッシュボードのファビコン | `#7CB342` | `#1B3B2B` |

**なぜ紫を使わないか。** 資料の図形色を数えると**23色すべてが緑系と無彩色で、紫は一度も出てこない**（最多が `#1B3B2B` の86回、次が `#7CB342` の59回）。表紙のロゴタイプも緑である（輪郭 `#0B1618`／面 `#B5D494`・`#D6E7C4`）。**外から見える顔は資料の側**なので、そちらへ合わせた。紫はアプリ画面の中だけの色である。

対比は 4.9:1 で、図形に必要な 3:1 を満たす。

**ダッシュボードは地と線を入れ替えただけ**である。暗い地と明るい地になるので 16px のタブでも見分けられ、しかも**色を1つも足していない**ので資料の配色から外れない。

**ファビコンと同じ図案である**（`apps/web/public/index.html` / `dashboard.html`）。**片方だけ直さないこと。** 図案が分かれた時点で、タブとLINEで別のサービスに見える。テストで一致を固定している（`apps/web/src/favicon.test.ts`）。

## LINE の指定に合わせたところ

[LINE MINI App icon specifications](https://developers.line.biz/en/docs/line-mini-app/design/line-mini-app-icon/) に従っている。

| 指定 | 従い方 |
| :--- | :--- |
| 地は 130×130、図案は 54〜90（推奨 54〜76） | 図案は 70×62 に収めてある |
| PNG または JPEG | PNG（SVG は受け付けられない） |
| 角は丸めない | **LINE 側が表示のときに角丸や円で切り抜く。** こちらで丸めると二重になって縁が汚れる |
| 地が白でも黒でもない色なら 8% の黒で輪郭 | 地の縁に入れてある。幅は地の 1/130 なので、**どの寸法で書き出しても表示時には髪の毛一本**になる |
| LINE MINI App のロゴを入れない | 入れていない |

★ **1024 の PNG を等倍で見ると輪郭が太い枠に見えるが、それで正しい。** 表示されるのは 88px 前後なので、そこでは1px 未満になる。

## 書き出し方

SVG から PNG を作る。専用のライブラリを入れず、手元にあるブラウザで描かせている。

```sh
# 1. 元データを作業用の場所へ置く（相対パスだと Edge が書き出し先を見つけられない）
cp doc/brand/icon-line-miniapp.svg /tmp/icon/icon-src.svg

# 2. 寸法ぶんの HTML を作る（N は 1024 / 390 / 130）
cat > /tmp/icon/render-N.html <<'EOF'
<!doctype html><html><head><style>html,body{margin:0;padding:0;overflow:hidden}img{display:block}</style></head>
<body><img src="icon-src.svg" width="N" height="N"></body></html>
EOF

# 3. 書き出す。--screenshot と file:// は**絶対パス**で渡すこと
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=N,N --screenshot="<絶対パス>/doc/brand/icon-line-miniapp-N.png" \
  "file:///tmp/icon/render-N.html"
```

★ **`--force-device-scale-factor=1` を外さないこと。** 端末の拡大率が乗って、指定した寸法と違う PNG が出る。

## これは何ではないか

- **ファビコンではない。** ファビコンは HTML の中に data URI で持っている（ファイルにすると配信の経路とキャッシュ対策が増えるため）
- **アプリの中で使う画像でもない。** 画面の中にこのアイコンは出てこない
- **ダッシュボード色（ライム地）の PNG は作っていない。** LINE に上げるのはミニアプリのアイコンだけである
