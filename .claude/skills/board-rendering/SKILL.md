---
name: board-rendering
description: 盤面(BoardScreen/HexGrid)の描画の仕組みと、新しい画面へのBoardScreen組み込み方。盤面UIの改修・演出追加・新ゲームモード画面の実装のときに使う
---

# 盤面の描画とBoardScreenの組み込み

最終更新: 2026-07-08(Fable 5 引き継ぎ用)。設計の背景は docs/index.md と
docs/architecture.md、演出の判断基準は docs/design_diorama.md。

## 1. 全体の層構造(これだけは覚える)

```
BoardScreen  … 画面の結線役。下書き状態(移動先・攻撃対象・雇用フロー)、カメラ、
│              TOD演出、トースト、submit(アクション確定)の注入口
└ HexGrid    … 盤面描画の本体。「2つの層」でできている:
    ①地形レイヤー(TiltStage内のSVG) … CSS 3D transformで傾く。クリック判定はここ
    ②ビルボードレイヤー(平面SVG)   … ユニット・立体物・エフェクト。傾かず、
                                       位置だけ projectTilt() で投影先へ動かす
```

置き場(2026-07-08 分割後): 幾何・配色・立体物の純関数は `lib/board/`
(geometry / colors / objects / timeOfDayFx)、共有描画部品(UnitBody・
TerrainObjectBillboard・TerrainTile)は `components/board/`。
**別レンダラー(CutInStage等)はHexGridではなくこれらを直接importする**。
立体物アイテムの組み立ては `buildTerrainObjectItems()`、不透明度は
`objectOpacity()`(単体テストあり)が正 — レンダラーにコピペしないこと。

- **描画と判定の分離が最重要の不変条件**。ビルボード(絵)は全て `pointerEvents="none"`
  または自前のonClickを持つ。地形ポリゴンが透明なヒット平面を兼ねるので、
  演出をいくら盛っても操作は壊れない。**絵にヒット判定を足さないこと**
- 座標系は3つある:
  1. **盤面座標**(hexCenter。S=36、odd-qオフセット。生の±1計算は禁止 → hex.tsの関数を使う)
  2. **ビュー空間**(vp。視点反転=180度回転を適用した後)
  3. **スクリーン投影後**(projectTilt。傾き+奥行きスケール)
  立体物のオフセット(offset/jitter)は**ビュー空間で適用する**(盤面座標で足すと
  視点反転で奥/手前が裏返るバグになる。2026-07-08に実際に踏んだ)

## 2. 深度ソート(前後関係)の規則

ユニットと地形立体物は同じ配列(billboardItems)に混ぜ、**投影後cyの昇順=奥から**描く。

- 立体物の接地はユニットより+0.15S手前バイアス(OBJECT_FOOT_BIAS_RATIO)
  → 同一ヘックスでは立体物が手前=足元を隠す(森の遮蔽)
- **「ユニットを常に手前にしたい」立体物(テント・旗・小道具)は offset.dy ≦ -0.3**
  (傾き投影で縦が約0.57倍に潰れるため、-0.15ではなく余裕を持たせる)
- 立体物の高さ上限則: **後ろのヘックスのユニット(可視高約44px)が完全に見える高さ**
  (岩塊は40pxで確定した)
- フェード制御は3系統あり独立:
  - fadeMode(素材属性): 占有ユニットの可読性(森=always、小塊=tilted、岩・テント=never)
  - revealBehind: 移動先等ハイライトを塞ぐ立体物を選択中だけ0.35に(操作性の救済)
  - MOUNTAIN_UNIT_LIFT: 岩場の上のユニットは+8px浮く(影は地面に残す)

## 3. データ側の受け皿(TerrainSpriteDef)

地形の見た目は `lib/content/index.ts` の TERRAIN_SPRITES で完結する(コード変更不要):

```ts
terrainId: {
  ground: [["url", ...]],           // バリアント配列=座標ハッシュで決定的に選択
  objects: [{ srcs, occludes, fadeMode, mirror, offset, jitter, ownerVariant }],
  edgeTransition: { src },          // 異地形に面した辺だけ草くさび等を回す
}
```

- ownerVariant: srcs=[P0用,P1用] をヘックス帰属(keepの走査順)で選ぶ(旗の陣営色)
- interiorObjects: 縁ロジック — 境界ヘックスは objects、内側・孤立は interiorObjects
  (選択規則は pickTerrainObjects。森=境界は片寄せ小塊/内側・孤立は密な樹冠)
- clusterPull: 同地形の隣の重心方向へ自動で寄せる距離(S単位)。片寄せの方向は
  マップから計算されるので手で指定しない
- 地面タイルの文脈選択: lib/content/groundRules.ts contextualGround(丘=チェーンの
  向きでh/a-i・j-g/cを切替)。HexGrid/CutInStageのgroundOverride経由で適用される。
  新しい地形ルールはここに関数を足す(判定は論理盤面空間・視点反転非依存)
- 画像URLは `DIORAMA["name"]`(バンドル済み)を使う。生URLは検収用のみ

## 4. BoardScreenを新しい画面に組み込む(CPU戦特化の新画面など)

BoardScreenは「確定済み盤面(props.board)+submit注入」の純UIで、通信を知らない。
実例: CpuMatchView.tsx(ローカルCPU戦)、MatchView.tsx(API対戦)、TutorialMatchView.tsx。

```tsx
<BoardScreen
  board={board}              // 閲覧者視点でフィルタ済みのMatchState
  myIndex={0}                // 自分のプレイヤーindex
  submit={submit}            // (action) => Promise<GameEvent[]>。ローカルなら
                             //   applyAction() を直接呼ぶ / リモートならAPI POST
  banner={...}               // topbar直下の通知(任意)
  extraEvents={cpuEvents}    // 自分以外の手(CPU等)のイベント列 → 移動・戦闘アニメの種
  onCombatPlayback={cutIn.onCombatPlayback}  // カットインへ演出を流す(useCutIn)
  onBack={...}
>
  {cutIn.stage}              // 盤面の上に重ねるレンダラー(CutInStage)
</BoardScreen>
```

- **submitの契約**: 成功=イベント列を返す、失敗=throw(BoardScreenがトースト表示)。
  盤面stateの更新は呼び出し側の責務(useState or APIキャッシュ)
- 戦闘演出は combatTimeline(再生データ)を producer(BoardScreen)が組み、
  consumer(盤面内アニメ or CutInStage)が再生する。**新しい演出先(音・リプレイ等)は
  consumerを足すだけ**でよい(「1つのタイムライン、複数のレンダラー」)
- ローカルCPU戦の作り方: createInitialState → プレイヤーの手はapplyAction →
  CPUの手はcore-engineのAI関数で生成してapplyAction → extraEventsに流す。
  サーバー・ログイン一切不要(CpuMatchView.tsx が完全な実例)

## 5. ハマりどころ(実績あり)

- **SSR hydrationエラー**: Math.cos/sinの最終桁がNodeとブラウザでズレる。
  座標は定数(HEX_CORNERS)か projectTilt 内の丸め(0.01px)を通す。生のcos/sinで
  transform文字列を作らない
- **画像の「成長」フラッシュ**: imageNaturalSize が確定するまで描かない
  (フォールバック寸法で描くと後で原寸に跳ねる)
- **視点反転(viewFlipped)**: 論理座標は不変、描画だけ点対称。新しい描画物を足すときは
  必ず viewCenter/vp を通す。「反転視点でだけ壊れる」は大抵ここ
- **検収は必ず盤面上で**: /dev/terrain(地形)・/dev/sprites(アニメ)・/dev/cutin(カットイン)。
  平面で良く見えても傾けると破綻する(逆も)。スクリーンショットはPlaywrightで
  `chromium.launch()` → goto → screenshot(clip指定)が定石
- devサーバー停止時は子プロセス(next-server)がポートを塞ぐことがある。
  pkillのパターンは**ポート番号まで含めて**絞る(広いパターンで別サーバーを巻き込んだ実績あり)
