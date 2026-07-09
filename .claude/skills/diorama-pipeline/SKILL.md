---
name: diorama-pipeline
description: ジオラマ素材(地形タイル・立体物・skybox・カットイン背景)の発注→生成→後処理→検収→採用を回す手順。素材づくり・検収・TERRAIN_SPRITESへの組み込み、GPU機でのComfyUI生成作業のときに使う
---

# ジオラマ素材パイプライン

設計の背景は docs/design/diorama_pipeline.md、スキーマとコマンドの正は
assets-pipeline/README.md。このskillは「実際に手を動かす順序」だけを書く。

## 大原則

1. **形は機械が保証する** — 生成には絵柄と光源だけを求める。六角形・寸法・透過は
   postprocess.py が作る。生成AIにヘックス形へ整形させない
2. **光源は全素材 top-left 固定** — inspect_assets.py が輝度統計で照合する
3. **判断は必ず盤面上で** — /dev/terrain で傾き盤面に立てて見る。平面での見栄えは信用しない
4. 候補・ボツは repo に入れない(assets-pipeline/raw・out は gitignore 済み)
5. **プロンプトは抽象語でなく物理的な具象で書く**(2026-07-06〜07の実戦教訓):
   - `bird's eye view` → 地平線つきの風景写真になる(空が映る)。
     地面テクスチャは「fills the entire frame, no sky, no horizon」
   - `game asset` 単体 → isometricタイル素材に化ける
   - `geometric` → 角の取れた押し出しブロックの整列(板チョコ)に化ける
   - 平たい立体物+`high angle` → 上空写真の土地模様(ゴルフ場・ナスカ)に化ける。
     置物は「miniature model / tabletop diorama piece / product shot / three-quarter view」
   - 単体を頼んでもシートが出る → 諦めて「several separate ... spaced apart」を
     発注し、収穫(連結成分)で個別に採るほうが歩留まりが良い
6. **生成は歩留まり、選別は機械** — 川・道・不良は中央クロップ/smartCrop/収穫が
   避けるので、原画の欠陥だけでボツにしない。ボツ判定は必ずベルトを通した後

## 生成経路は2つある(2026-07-08 明文化)

パイプラインの核心は**「生成器非依存」**であること。発注書(orders/*.json)の
prompt/negative と postprocess.py 〜検収〜採用の後段は、**画像がどこから来ても同一**。
raw/<発注名>/ にPNGが入りさえすれば同じベルトが回る。

- **経路A: GPU機のComfyUI(ユーザー自身の作業用ランブック)** — 下記「手順0」と
  SETUP-GPU.md。品質・枚数・コストの自由度が最大。素材の量産はこちら。
  raw の受け渡しは debug ブランチ(`git add -f assets-pipeline/raw/<名前>` → push)が定石
- **経路B: 任意の画像生成(他の環境・他のモデルでも成立する方法)** —
  nano banana(Gemini)・DALL-E・Web UIなど何でもよい。発注書の prompt/negative を
  そのまま(またはサービスの流儀に合わせ微調整して)入力し、出力PNGを raw/ に置く。
  以降は経路Aと完全に同じ(postprocess → inspect → /dev/terrain検収 → 採用)。
  GPUが無い環境での小規模な追加・差し替えはこちらで十分
- どちらの経路でも守ること: スタイルアンカー(anchors/grassland_v1.png)との
  色調整合、光源top-left、白背景(立体物)。判断基準は経路によらず大原則1〜6

## 手順

### 0. セットアップ(初回のみ)

- `cd assets-pipeline && uv sync`
- GPU機(Windows)のゼロからの立ち上げは **assets-pipeline/SETUP-GPU.md** に従う
  (ComfyUI portable の入手・RTX 50系の注意・SDXLモデル配置・スタイルアンカー確定まで)。
  ワークフローは assets-pipeline/workflows/ のJSONを使い、変更したら必ず
  JSONを再エクスポートしてコミットする

### 1. 発注書を書く

`assets-pipeline/orders/<id>.json`(スキーマは README 参照)。
スタイルアンカー(草原1枚)が未確定のうちは新地形を量産しない — アンカー確定が先。

### 2. 生成(GPU機)

ComfyUI で発注書の prompt から生成し、`assets-pipeline/raw/<id>/` に PNG を置く。
余白付き・無地背景・ヘックス整形なし。バリアント数は発注書の variants に合わせる。

### 3. 後処理・機械検収(どちらのマシンでも可)

```
uv run scripts/postprocess.py --order orders/<id>.json --src raw/<id> --out out/<id>
uv run scripts/inspect_assets.py --order orders/<id>.json --dir out/<id> [--anchor <アンカーpng>]
```

NG(exit 1)= 採用禁止(後処理か生成をやり直す)。WARN = 目視判断に回す。

### 3.5 後処理の道具箱(発注書の postprocess キー一覧)

| キー | 何をするか | 使いどころの実績 |
|---|---|---|
| `smartCrop` {window,count,stride,mode} | 均質窓の自動採取(1枚から複数タイル)。mode: uniform=中央値基準 / green=緑面だけ / sand=砂だけ | 草原・丘・水 / 高地プレート / 砂 |
| 収穫(objectの既定) {maxHarvest,minAreaRatio,defringePx,maxWidth,allowUpscale,splitErosion} | シートから連結成分を個別スプライト化。透過入力なら再分解(端接触OK)。splitErosionは橋切りwatershed | 木・小塊・テント・箱 |
| `fillHoles` / fill_holes(close=N) | 内部の透明穴を周辺色で埋める。close>0で縁に開いた欠けも塞ぐ | 納品物の穴・テントの屋根 |
| `tint` {dark,light,strength,normalize} | 輝度テクスチャに色ランプを着せる。normalize=暗い素材の模様が潰れる時に必須 | 砂・山(褐色化)・水の橋渡しタイル |
| `toneDownBright` {luminance,keep,maxSpread} | 明るい低彩度画素の減光 | 砂の筋・白帯 |
| `toneUpDark` {luminance,keep} | 暗部の床上げ | 黒フチ残り・暗斑 |
| `removeDarkFringe` {darkLuminance,greenDilate,strength,sigma} | 緑領域の縁の焼き込み影を修復。緑判定は**G-B差**(オリーブはG>Rでは拾えない) | 丘aの黒フチ |
| `edgeBlend` {width,strength,tile,brightOnly} | 縁の焼き込みブレンド。tile指定=クロスフェード、brightOnly=白画素の方向だけ | ※現在は遷移くさびが主流。焼き込みが要る時だけ |
| `rotations` [deg,…] | 回転バリアント。60度刻み以外も可(中央値で下敷き)。**影の向き矯正は暗部重心を実測して角度選定** | 丘g・山・砂bのSE寄せ |
| `sharpen` {radius,percent} | アンシャープマスク。**質感で地形を分ける**(丘=ぼやけ/山=エッジ) | 山 |
| kind: `transition` {depth} | 遷移くさび生成(上辺正準)。描画側が隣接の異地形辺だけに60度回転で重ねる | 草・浅瀬・砂浜くさび |

### 3.6 精整の作法(2026-07-07の実戦則)

- **しきい値は推測せず実測**: 輝度分位・色距離・暗部重心方位を測ってから数値を決める。
  「実測→数値→再実行→盤面判断」のループを短く回す
- **tintを挟むなら前後両方で測る**: 広いランプは入力で抑えた差を再増幅する。
  順番は「入力側の抑制→tint→post-tint実測の再圧縮」
- **検収基準は地形ごとに違う**: 道は草原でNG・丘で採用したい特徴。縞は丘でNG・山で主役。
  色距離だけでも選べない(距離2位が線路入りだった実例)— 機械=寸法・光源・色、人間=画角・意味
- **素材ストックを再解釈する**: 山は新規生成ゼロ(丘rawの掘り直し+褐色tint)。
  ボツシートも別地形の鉱脈。派生は必ず発注書化して再現可能に保つ
- **見分けは色相より質感**: mutedパレットでは彩度が近いので、ぼやけ/エッジ(sharpen)や
  明暗の向きが識別信号になる

### 4. 目視検収(/dev/terrain)

out/ の採用候補を `packages/frontend/public/sprites/terrain-practice/`(gitignore済み)へ
コピーし、dev サーバーの `/dev/terrain` でURLを貼って傾き盤面上で確認する。
ページの装備: 立体物欄(端/内側の2セット・配置プリセット6種)/ 地面欄(草原・丘、
1行1バリアント)/ 昼・夕・夜ボタン / 盤面クリックでユニット自由配置。
見るもの: バリアントの散り方 / ユニットとの遮蔽 / フェード(fadeMode: 大きな塊=always、
小塊=tilted が実地検証の結論)/ 敷き詰め時の継ぎ目・リピート感。

### 4.5 描画側の受け皿(データだけで組める表現)

- `TerrainSpriteDef.ground`: レイヤー列。各レイヤーは単一URLか**バリアント配列**
  (座標ハッシュでヘックスごとに選択。丘10種等の繰り返し回避)
- `TerrainSpriteDef.edgeTransition`: 遷移くさび。**隣が異地形の辺だけ**に重なるので、
  同地形同士は絵が直接つながる(丘の高地連続・深海⇔浅瀬・水際の砂浜)
- `TerrainObjectDef`: srcs(バリアント)/ offset・jitter(ヘックス内配置)/
  mirror(ハッシュ左右反転)/ occludes+fadeMode / 複数エントリ=多体置き
  (それぞれ独立に深度ソート参加)

### 5. 採用(2026-07-08 バンドル方式に変更)

候補・温存 = `public/terrain-diorama/`(生URL。/dev/terrainに貼って検収する場所)、
採用済み = `src/assets/terrain-diorama/`(静的import=バンドル。ハッシュ付きURL配信)
という二段構え。採用の手順:

1. 検収OKのファイルを `packages/frontend/src/assets/terrain-diorama/` へ移す
   (候補から昇格なら `git mv public/terrain-diorama/x.png src/assets/terrain-diorama/`。
   自作素材なので GPL の Wesnoth 素材と違いコミットできる)
2. `src/lib/content/dioramaImages.ts` に import 1行+ `DIORAMA` マップに1行足す
   (キー=拡張子なしファイル名)
3. `src/lib/content/index.ts` の TERRAIN_SPRITES に記述:
   `forest: { ground: [...], objects: [{ srcs: [DIORAMA["forest-groves-a"]], occludes: true }] }`
4. test/spriteAssets.test.ts が両方の置き場のファイル実在を検証する
   (バンドル側は参照切れがビルドでも落ちるが、テストの方がエラーが読みやすい)
5. `npm run test -w frontend` と `/dev/terrain`・実対戦画面で最終確認

## GPUなしでの練習(実績: 2026-07-06)

`uv run scripts/make_practice_raw.py` が疑似「生成物」を合成して raw/ に置く
(外部素材・npm 不要)。そのまま orders/practice-grass.json / practice-trees.json で
postprocess → inspect_assets を流せば、生成以外の全段を通しで練習・動作確認できる。
本家 Wesnoth タイルを raw に入れて試す場合、光源WARNが出るのは正常
(本家素材は光源が統一されていない — 検収が正しく検出している)。
