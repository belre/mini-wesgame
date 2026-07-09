# スプライト設定手順書(経緯と追加手順)

最終更新: 2026-07-05

このドキュメントは (1) CPU戦〜スプライト導入までの開発経緯のまとめ、(2) **新しいユニットにスプライトを設定する具体的な手順書**。設計思想の全体像は docs/architecture.md を参照。

## 1. 経緯(何をどの順で作ったか)

| コミット | 内容 |
|---|---|
| `4ac877e` | **CPU練習モード**: 対戦相手の参加待ちの間、APIを介さずブラウザ内で完結するCPU戦。CPU思考は `core-engine/src/ai.ts`(純粋関数 `chooseCpuAction`) |
| `6bd86f1` | **チュートリアルモード**(`/tutorial/[id]`): 相手はCPU。ガイドはJSONデータ定義(ターン数トリガー / hexトリガー)。`data/tutorials/*.json` |
| `4688c86` | **スプライト検証ページ**(`/dev/sprites`): Wesnoth AnimationWMLのフレーム定義をSVG盤面で再生できることを実証(spearman実データ使用) |
| `7c04c7c` | バグ修正: rAFのタイムスタンプは直前の `performance.now()` より過去がありうる → クランプ必須 |
| `f5f4c94` | バグ修正: ヘックス頂点計算の `Math.cos/sin` は実装依存の丸めでSSRとhydration不一致 → 定数(±1, ±0.5, ±√3/2)で計算 |
| `ca86415` | **盤面にスプライト導入**(spearmanのみ): `lib/sprites.ts` 解決層 + HexGridの `UnitBody`。未登録・アセット未取得は円+頭文字に自動フォールバック |
| `0faa7ba` | **移動アニメーション**: 1ヘックス200ms。演出層のみ(確定盤面は即時反映・操作は非ブロック)。自分/CPUの手は `moved` イベントの実経路、相手の手は位置差分の直線スライド |
| `65343cb` | バグ修正: 経路登録が盤面差分エフェクトより遅れると古い経路が次の盤面変化で再生される → submitをマイクロタスク開始+経路と観測移動の一致検証 |

## 2. 仕組み(どこに何があるか)

```
packages/frontend/
  src/lib/anim/                     # アニメーションモデル層(型+時間解決+戦闘タイムライン。純粋関数)
  src/lib/content/                  # ★UNIT_SPRITES(spriteKey→フレーム定義)。陣営別ファイル+shared.ts
  src/lib/sprites.ts                # ランタイム層: 再生フック useUnitSprite(プリロード+失敗時フォールバック)
  src/components/HexGrid.tsx        # UnitBody: 定義があればスプライト、なければ円+頭文字
  src/hooks/useMoveAnimations.ts    # 移動アニメ(単一rAFループで表示位置を経路補間)
  src/components/BoardScreen.tsx    # 盤面差分エフェクト(どの移動をどの経路で animate するか)
  src/components/SpriteAnimDemo.tsx # 検証ページ本体(/dev/sprites)
  scripts/fetch-demo-sprites.mjs    # ★フレームPNGのダウンロードスクリプト
  public/sprites/                   # 画像置き場(GPLアセットのため gitignore。コミットしない)
```

描画のモデルは **Wesnoth AnimationWML のサブセット**:

- アニメ = 個別PNGフレームの列。各フレームがミリ秒単位の `duration` を持つ(可変)
- `standing` = 常時ループ、`idle` = 3〜8秒のランダム間隔で1回だけ挟まる仕草
- 移動 = フレームアニメとは独立に、表示位置を1ヘックス200msでスライド(Wesnothエンジン既定値)

フォールバックは2段構え。**手順を間違えてもゲームは壊れない**:
1. `UNIT_SPRITES` に未登録の spriteKey → 従来の円+頭文字
2. 登録済みでもPNGのプリロードに失敗(未取得の環境等)→ 同じく円に自動フォールバック

## 3. 手順書: ユニットを1体スプライト化する

spearman(実装済み)を実例に、bowman(弓兵)を追加する場合の流れ。

### Step 1: Wesnoth本家でフレーム画像とアニメ定義を探す

- 画像: `https://github.com/wesnoth/wesnoth/tree/master/data/core/images/units/<種族ディレクトリ>/`
  (例: `human-loyalists/` に `bowman.png`, `bowman-idle-1.png`, ...)
- アニメ定義(WML): `https://github.com/wesnoth/wesnoth/tree/master/data/core/units/<種族>/<ユニット>.cfg`
  (例: `humans/Loyalist_Bowman.cfg`)

cfg内で見るのは `[standing_anim]` と `[idle_anim]` の `[frame]` タグだけ。例(spearman):

```ini
[standing_anim]
    [frame]
        image="units/human-loyalists/spearman-stand-s-[1~7,6,7~2].png:200"
    [/frame]
[/standing_anim]
[idle_anim]
    [frame]
        image="units/human-loyalists/spearman-idle[1~4,3,2].png:[100*3,400,100*2]"
    [/frame]
[/idle_anim]
```

方向分岐(`direction=s,se,sw` / `n,ne,nw`)がある場合は **南向き(s系)だけ**使う(現状は方向非対応)。

### Step 1.5: raw.githubusercontent.com での画像パスの調べ方

Wesnothのアセットは GitHub に公開されており、**ダウンロードなしに**ブラウザやcurlで確認できる。
`fetch-demo-sprites.mjs` にパスを書くときはここで事前確認すること。

#### 使う2つのURL

| 用途 | URL形式 |
|---|---|
| ファイルの一覧を確認したい | `https://api.github.com/repos/wesnoth/wesnoth/contents/<パス>` |
| ファイルの中身を取得したい | `https://raw.githubusercontent.com/wesnoth/wesnoth/master/<パス>` |

どちらもブランチは `master` を使う。

---

#### ディレクトリ一覧の確認(GitHub API)

```bash
# human-loyalists/ の直下ファイルを一覧
curl -s "https://api.github.com/repos/wesnoth/wesnoth/contents/data/core/images/units/human-loyalists" \
  | python3 -c "import json,sys; [print(i['name']) for i in json.load(sys.stdin)]"
```

返り値の各オブジェクトに `"type": "dir"` と `"type": "file"` がある。
`"type": "dir"` のものはさらに掘る必要がある(後述のサブディレクトリ問題)。

---

#### よく使う画像ディレクトリ

| ユニット種別 | パス |
|---|---|
| 忠誠軍の歩兵系 | `data/core/images/units/human-loyalists/` |
| 忠誠軍の**騎馬系**(cavalryman/horseman/dragoon/lancer) | `data/core/images/units/human-loyalists/<ユニット名>/` ← **サブディレクトリ** |
| 魔術師系(mage/white-mage など) | `data/core/images/units/human-magi/` |
| マーフォーク | `data/core/images/units/merfolk/` |
| 飛び道具 | `data/core/images/projectiles/` |
| 草原タイル | `data/core/images/terrain/grass/` |

#### 落とし穴: サブディレクトリに入っているユニット

`human-loyalists/cavalryman.png` は存在しない。
一覧を取ると `cavalryman` が `"type": "dir"` で出るので、
`human-loyalists/cavalryman/cavalryman.png` が正しいパスと分かる。

同様に **horseman**, **dragoon**, **lancer**, **knight**, **grand-knight** などもサブディレクトリに入っている。
よってパスを推測で書かず、**必ずAPIで一覧を取ってから**書くこと。

```bash
# cavalryman サブディレクトリの中身を確認
curl -s "https://api.github.com/repos/wesnoth/wesnoth/contents/data/core/images/units/human-loyalists/cavalryman" \
  | python3 -c "import json,sys; [print(i['name']) for i in json.load(sys.stdin)]"
# → cavalryman.png, cavalryman-attack1.png, cavalryman-breeze1.png, ...
```

`fetch-demo-sprites.mjs` では `{ remote: "cavalryman/cavalryman.png", local: "cavalryman.png" }` の形式で書く。

---

#### WMLからフレームタイミングを取得する

画像パスが分かったら、次はアニメのタイミングデータを WML(.cfg)から読む。
cfgは `data/core/units/<種族>/` にある。

```bash
# Loyalist_Bowman.cfg をrawで取得し、アニメ関係の行だけ絞り込む
curl -s "https://raw.githubusercontent.com/wesnoth/wesnoth/master/data/core/units/humans/Loyalist_Bowman.cfg" \
  | grep -E '(image=|duration=|start_time=|offset=|missile_start_time|missile_duration|\[attack_anim\]|\[standing_anim\]|\[idle_anim\]|filter_attack)'
```

grepで拾う行の意味:

| 行 | 意味 |
|---|---|
| `start_time=` | アニメ開始時刻(ms)。打撃瞬間=0基準。負値=その ms 前から始まる |
| `image="file-[1~3].png:100"` | 1〜3 のフレームを各100ms。WML記法(Step 2参照) |
| `offset=0.0~0.5:300,0.5~0:200` | 踏み込み量の区間補間(区間ごとに from~to:duration) |
| `missile_start_time=` | 飛び道具の発射タイミング(ms) |
| `[filter_attack]` | この attack_anim が何の攻撃に適用されるか(中に `name=` がある) |

ファイルが見つからない・パスが分からない場合は先に対象ユニットのcfgディレクトリ一覧を確認する:

```bash
curl -s "https://api.github.com/repos/wesnoth/wesnoth/contents/data/core/units/humans" \
  | python3 -c "import json,sys; [print(i['name']) for i in json.load(sys.stdin)]"
# → Loyalist_Bowman.cfg, Loyalist_Cavalryman.cfg, Mage.cfg, Horseman.cfg, ...
```

魔術師系(Mage.cfg, Mage_White.cfg)はユニット種族が `human-magi` だが、cfgは `humans/` に入っている。

---

#### 404が出たときのデバッグ手順

1. **まず GitHub API でディレクトリ一覧を取る** — ファイル名の typo か、サブディレクトリ入りかが判明する
2. 一覧に `"type": "dir"` で出たら、そのディレクトリの中を掘る
3. **ファイル名を正規化**: `heavyinfantry.png`(アンダースコアなし)、`white-mage.png`(ハイフン)など
   ユニットID(`heavy_infantryman`)とファイル名が一致しない例が多いので一覧で実名を確認する
4. 確認したURLを `fetch-demo-sprites.mjs` の `{ remote: "...", local: "..." }` に書く

### Step 2: WML記法を展開する(読み方)

| 記法 | 意味 | 展開結果 |
|---|---|---|
| `name-[1~7].png:200` | 連番1〜7、各200ms | 1,2,3,4,5,6,7 |
| `name-[1~7,6,7~2].png:200` | 連番+個別+逆順の混在 | 1,2,3,4,5,6,7,6,7,6,5,4,3,2 |
| `:[100*3,400,100*2]` | duration列(`*n`は繰り返し) | 100,100,100,400,100,100 |

フレーム数とduration数は一致する(しない場合はcfgの読み違い)。

### Step 3: ダウンロードスクリプトにファイル名を追加して実行

`packages/frontend/scripts/fetch-demo-sprites.mjs` の `names` 配列にファイル名を追加し:

```powershell
node packages/frontend/scripts/fetch-demo-sprites.mjs
```

→ `packages/frontend/public/sprites/<ユニット>/` にPNGが入る。
(※画像はGPLのためgitignore済み。**別の環境で動かすときも毎回このスクリプトで取得する**)

### Step 4: `lib/content/<陣営>.ts` の `SPRITES` にエントリを追加

キーは **core-engineの `UnitDef.spriteKey`**(`packages/core-engine/src/data/factions/*.ts` で確認。例: `"units/loyalists/bowman"`)。

```ts
"units/loyalists/bowman": {
  base: bowman("bowman.png"),
  // image="bowman-stand-[1~5].png:150" ← cfgからの転記元をコメントで残す
  standing: [1, 2, 3, 4, 5].map((i) => ({
    image: bowman(`bowman-stand-${i}.png`),
    duration: 150,
  })),
  idle: [ /* 同様。idle_animが無いユニットは省略可 */ ],
},
```

転記元のWML1行をコメントで残すこと(後から本家と突き合わせられるように)。

**攻撃アニメは`attacks`(攻撃idごとのマップ)に登録する**。core-engineの`AttackDef`は
`id`(英語の安定キー。識別用)と`name`(表示名。ローカライズ対象、このプロジェクトでは日本語)を
分けて持つ ── **必ず`id`の方をキーにする**(`name`は将来ロケールが変わりうるため識別子に
使わない)。1ユニットが複数の攻撃(近接+遠隔等)を持つ場合、両方登録できる。spearmanの実装例:
`spear`=近接・`offset`で踏み込み、`javelin`=遠隔・`offset`省略(踏み込まない)+`missile`で
飛び道具を攻撃側→防御側へ直線移動させ、`missile.startTime+duration`が命中の瞬間(t=0)に
一致するようにする。遠隔攻撃の飛び道具画像はユニット本体とは別ディレクトリ
(`data/core/images/projectiles/`)にあることが多いので取得先に注意。

```ts
attacks: {
  spear: { startTime: -325, offset: [...], frames: [...] }, // 近接: 踏み込みあり
  javelin: {
    startTime: -250,
    // offsetを省略 = 踏み込まない(遠隔攻撃は据え置きで投げる)
    frames: [...],
    missile: { startTime: -150, duration: 150, image: projectile("spear-n.png") },
  },
},
```

新しいユニットの`id`を決める際は、対象ユニットの`data/factions/*.ts`定義を開いて
`attacks[].id`を確認すること(`name`ではない)。1文字でも違う(typo・nameを使ってしまう等)と
黙って汎用ランジにフォールバックし、専用フレーム/飛び道具が一切再生されない
(この不一致は`core-engine/test/factions.test.ts`のid書式チェックでは検出できない
— idの「値」が正しいかはfactions.test.tsではなく実際の盤面で確認する必要がある。
トラブルシューティングにも追記)。

### Step 5: 確認

1. devサーバー(ポート3010)でそのユニットを雇用して盤面で確認
   (チュートリアル `/tutorial/basic_battle` かCPU戦が手軽)
2. 立ちアニメがループし、数秒おきに待機アニメが挟まり、移動時に経路に沿って滑ればOK
3. `/dev/sprites` の「戦闘アニメーション」セクションは `lib/sprites.ts` の `UNIT_SPRITES`を
   直接参照している(デモ専用のハードコードは持たない)。近接/遠隔をプルダウンで切り替えて
   単独確認できるので、複数の攻撃を登録したユニットはまずここで踏み込み・飛び道具の
   タイミングを詰めてから、本番の盤面(手順1-2)で確認するとよい

## 3.5 地形タイルのスプライト化(試験導入: grasslandのみ)

ユニットと同じ「解決層+フォールバック」の構造を地形にも適用できる。地形は静止画1枚のみ
(アニメなし)なので手順はユニットより単純:

1. `TERRAIN_SPRITES`(`lib/sprites.ts`)に `terrain id → 画像パス` を1行追加
2. `fetch-demo-sprites.mjs` の `ASSET_GROUPS` に取得対象を追加
3. `HexGrid.tsx` の `TerrainTile` コンポーネントは terrainId をキーに自動でスプライト/色polygonを
   出し分けるので、地形側の変更は不要

現状 grassland(Wesnoth `terrain/grass/green.png`。ブレンドなしの単一タイル)のみ導入済み。
他の地形(森・丘など)はWesnothの自動タイリング(隣接地形とのブレンド)が絡むため、
1枚のPNGでは足りないケースが多い(要: 追加設計)。未登録の地形は従来どおり色polygon。

## 4. トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| 円のまま表示される | (a) `UNIT_SPRITES` に未登録 → spriteKeyのtypoを確認(core-engine側の値と完全一致が必要)。(b) PNG未取得 → fetchスクリプトを実行。(c) ファイル名typo → DevToolsのNetworkタブで404を確認 |
| 最初の数秒だけ円→スプライトに切り替わる | 仕様。プリロード完了までは円で描画する(ちらつき防止) |
| hydrationエラー | ヘックス座標計算に `Math.cos/sin` を使っていないか確認(実装依存の丸めでSSRと不一致になる。定数±1, ±0.5, ±√3/2で計算する) |
| 移動アニメがおかしい・古い位置から動く | 盤面差分エフェクトの経路検証(BoardScreen)を確認。経路は「旧位置→現位置」と始点・終点が一致するときだけ採用される設計 |
| rAF系アニメで初回に落ちる | rAFのタイムスタンプは直前の `performance.now()` より過去がありうる。経過時間は必ず0〜totalにクランプ |
| 本番の盤面(CPU戦・リモート対戦)で攻撃アニメ(踏み込み・専用フレーム・飛び道具)が一切出ない、汎用ランジしか動かない | `UNIT_SPRITES[spriteKey].attacks` のキーが対象ユニットの `AttackDef.id` と一致していない(typo、あるいは表示名`name`をキーにしてしまっている等)。`id`は`data/factions/*.ts`側の値を直接確認すること(`name`は表示専用でローカライズ対象になりうるため識別子として使わない)。`/dev/sprites` はUNIT_SPRITESを直接参照するデモのため**このキー不一致は再現しない**(見た目上は動いて見えても本番では動かない、という罠になる)。`factions.test.ts`はidの書式(非空・英数字)は検証するが、値が実際のアニメ定義と一致しているかまでは検証しないので、新しい攻撃アニメを足したら必ず該当ユニットのdata/factions定義と突き合わせて盤面で確認すること |

## 5. 既知の制約と今後の拡張

- **チームカラー対応済み**(lib/anim/teamColor.ts): Wesnoth原画のマゼンタ19色パレットを、
  本家のrecolor_palette()移植アルゴリズムで先攻=青/後攻=赤のレンジにCanvas置換する。
  プリロード時に生成しblob URLでキャッシュ、失敗時(CORS等)は原色フォールバック。
  本番のCloudFront配信ではcrossOrigin=anonymousで読むためバケットのCORS許可が前提
- **方向なし**: 常に南向きフレームを使用。左右ミラーや北向きは未対応
- **攻撃/防御アニメ**: **本番組み込み済み**(`hooks/useCombatAnimations.ts`。エンジンの
  `CombatResult.strikes` を550ms/打撃のタイムラインに変換して攻守交互に再生。狂戦対策で
  12打撃まで再生・超過分は結果のみ反映)。検証ケースは `/dev/sprites`。
  ユニットにWMLの攻撃アニメを付けるには `UNIT_SPRITES` の `attack`(startTime/offset/frames)と
  `defend`(被弾リアクション画像)を定義する。未定義ユニットは汎用ランジ(踏み込みのみ)。
  `[attack_anim]` のモデルは **時刻0=打撃の瞬間** 基準で、`start_time`(負値=何ms前から再生)、
  `offset`(0=自ヘックス→1=相手ヘックスの踏み込み量を区間補間)、`~BLIT(...)`(画像合成。
  SVGでは同位置への重ね描きで等価)からなる。防御側は `DEFENSE_ANIM`(構え→被弾の瞬間だけ
  リアクションフレーム)の近似で十分。打撃の瞬間にHPバー減少・ダメージ数字を同期させる。
  本番組み込みは、エンジンの `CombatResult.strikes`(打撃ごとのhit/damage列)をタイムラインに
  変換して攻守交互に再生する設計(狂戦の最大30ラウンドは倍速・省略が必要)。死亡アニメは未検証
- **多層アニメ(halo・独立周期レイヤー)は対応済み**: 攻撃は`AttackAnimDef.extraTracks`
  (AnimTrack[]。anchor "unit"=ユニット追従 / "path"=攻撃側→防御側の座標系)、
  standingは`standingOverlays`(独立周期のループレイヤー。例: pillagerの松明の炎)。
  WMLの`[halo_frame]`等はこのトラックに転記する
- **定義とfetchスクリプトの整合性はテストで保証**: `npm run test -w frontend`
  (test/spriteAssets.test.ts)。定義が参照する画像の取得エントリー漏れを検出する
- **ユニット数が増えたら**: cfg→`UNIT_SPRITES`の手転記は数体が限度。全ユニット展開時は
  「cfgの`[standing_anim]`/`[idle_anim]`をパースしてJSONを吐くスクリプト」を作る
- **本番配布**: **実装済み**。CDKの`GameDataBucket`に`sprites/`プレフィックスで配布し
  (マップJSONと同じ流儀)、前段にCloudFront(`GameDataCdn`)を用意。フロントは
  `NEXT_PUBLIC_ASSET_BASE`(未設定時はNextの`public/`から相対パスで配信=dev既定)で
  切り替える。デプロイ前にローカルで`fetch-demo-sprites.mjs`を実行しておくこと
  (未取得でも`cdk deploy`自体は失敗しないが、その場合スプライトはアップロードされない)。
  詳細は docs/architecture.md「画像アセット(スプライト)の配布」参照
- **ライセンス**: Wesnothアセットは **GPLv2+**。このためリポジトリに画像をコミットしない運用にしている。
  ゲームを公開する場合は「GPL準拠で本家アセットを使う」か「自作/別ライセンス素材に差し替える」かの決定が必要。
  地形タイルはAI生成の独自タイルセットへ移行する方向(docs/design_diorama.md 参照)
