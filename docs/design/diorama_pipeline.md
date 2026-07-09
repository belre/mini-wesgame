# ジオラマ画像生成パイプライン設計(A-3。2026-07-06 検討開始)

design_diorama.md の発注規約を「実際に回る工場」にするための設計。
[backlog](../backlog.md) A-2/A-3/A-7、および A-4(配信)との接続を扱う。

## 前提: 2台構成

| マシン | 役割 | 理由 |
|---|---|---|
| ASUS TUF A16(RTX 5060 Laptop 8GB) | **生成スタジオ**: ComfyUI で生成+後処理+自動検収まで。**Claude Code(Sonnet 5)を入れ、skills でパイプラインをオーケストレーション**する | 生成〜検収は Python 生態系で完結させる |
| このPC(GPUなし) | **統合側**: 採用素材の組み込み・盤面上の目視検収・vitest整合性テスト・E2E | ゲーム本体(TS)の責務だけを持つ |

GPU機は **Windows**。ComfyUI は Windows portable 版(cu128 対応の新しめ)を素直に使い、
WSL は挟まない(GPUドライバ周りが単純になる)。Claude Code も Windows ネイティブで動かす。
パイプラインの実装言語は **Python(uv 管理。Windows でもそのまま動く)**。
スクリプトのパス処理は pathlib で書き、両OSで動く状態を保つ。ComfyUI が Python ネイティブで、
後処理・検収の道具(Pillow/OpenCV の画素統計、rembg、numpy のパレット距離)も
Python 側が本場。ゲーム本体の TS と混ぜない(パイプラインは出荷物ではない)。
GPU機の Claude 用 skills(発注→生成→後処理→検収の回し方)も repo にコミットし、
`assets-pipeline/` を clone すれば別マシンでも同じ作業ができる状態を保つ。

パイプラインの再現性の正体は「GPU機に入っている環境」ではなく
**repo にコミットされた発注書・ワークフローJSON・後処理スクリプト・検収スクリプト**。
GPU機は使い捨て可能な計算資源として扱う(A-1 skills化と同じ思想)。

## アーキテクチャ: 5段ベルトコンベア

```
[1 発注] order.json (repo)
   → [2 生成] ComfyUI @ GPU機(ワークフローJSONもrepoに保存)
   → [3 後処理] このPC: ヘックスマスク/背景除去/リサイズ/圧縮 (Node+sharp)
   → [4 検収] このPC: 自動チェック + /dev/terrain コンタクトシートで目視
   → [5 組み込み] TERRAIN_SPRITES 差し替え(スキーマ拡張後)
```

### 1. 発注書(order sheet)

`assets-pipeline/orders/*.json`。地形1種=1件。design_diorama.md の発注規約を機械可読化:

```jsonc
{
  "id": "forest_pines",
  "kind": "object",            // ground | object | skybox | cutin_bg
  "variants": 3,               // 立体物は2〜3バリアント必須(単調さ回避)
  "light": "top-left",         // 全素材で固定(ライティング一貫性が生命線)
  "styleAnchor": "grassland_v1", // スタイルアンカー参照(下記)
  "prompt": "...",             // テンプレ + 地形固有部分
  "postprocess": { "hexMask": false, "removeBg": true, "targetHeight": 96 }
}
```

### 2. 生成(GPU機)

- **ComfyUI** を使い、ワークフローは JSON エクスポートして repo にコミット
  (`assets-pipeline/workflows/`)。「あの日うまくいった設定」を属人化させない
- モデルは **SDXL 系から開始**(8GB VRAMで安定圏)。Flux は GGUF 量子化で可能だが、
  スタイルが決まるまで変数を増やさない
- **RTX 50系(Blackwell)の注意**: CUDA 12.8+ / PyTorch 2.7+(cu128)が必要。
  ComfyUI は新しめの portable 版を使うこと
- **生成段階ではヘックス形に整形しない**。余白付き正方形・無地背景で「絵柄」だけ作る
  (理由は下記「形は機械が保証する」)
- オーケストレーション: GPU機上の Claude Code が skills に従い、ComfyUI のローカル
  HTTP API を叩いて「発注書→生成→後処理→検収→採用候補の書き出し」まで一気通貫で回す。
  マシン間のやり取りは「発注書(repo)を渡す」と「採用素材を受け取る」の2点だけになる

### 3. 後処理(GPU機・Python)

`assets-pipeline/scripts/postprocess.py`(Pillow/OpenCV):

- **ground**: 72px フラットトップのヘックスマスクを機械適用(隣接ブレンド用に
  数px のブリード付き)。現行 Wesnoth タイルと同じ寸法規約に合わせる
- **object**(木・岩・家屋): 背景除去(無地背景生成+色抜き、足りなければ rembg)、
  トリミング、アンカー(足元)座標の記録
- **共通**: リサイズ → pngquant/oxipng 圧縮。**この出口が A-4(配信改善)の入口**。
  将来のスプライトシート化もこの段に足す

### 形は機械が保証する(重要原則)

生成モデルに正確な六角形エッジ・正確なサイズは出せない。
**生成には「絵柄と光源」だけを求め、形状・寸法・透過は後処理が100%保証する。**
これで検収の大半が自動化でき、リテイクの理由が「絵柄が気に入らない」だけに絞られる。

### 4. 検収(自動+目視)

自動(`assets-pipeline/scripts/inspect.py`。GPU機で生成直後に実行):
- 寸法・透過チャンネルの有無・ヘックス被覆率
- **明度勾配の方向**(光源が top-left に来ているかをピクセル統計で判定)
- スタイルアンカーとのパレット距離(色調の逸脱検知)

目視: `/dev/terrain` ページ(**2026-07-06 実装済み**)に候補URLを貼ると
**傾き盤面の上に立てた状態**で確認できる(バリアント割り当て・占有ヘックスの
可読性フェード込み)。平面で良く見えても傾けると破綻する(その逆も)ため、
判断は必ず盤面上で行う。

**フェード量の決定も検収の一部**(2026-07-06 合意): 現在の opacity 0.35 は仮置きの
一律値で、隠れるニュアンスは実際には一律ではない前提で扱う——森(伏兵)は
しっかり隠れるのが正、村の家屋は視認性優先、山の岩塊は隠しすぎ注意。ユニットの
体格差や「敵を見落とす実害」も絡む。素材ごとに /dev/terrain 上で値を決め、
必要になったら `TerrainObjectDef.fadeOpacity`(地形・オブジェクト別の上書き)を
追加する(小さい変更なので素材が揃うまで先回りしない)。

### 5. 組み込み: TERRAIN_SPRITES のスキーマ拡張(**2026-07-06 実装済み**)

`Record<terrainId, TerrainSpriteDef>` に移行済み(lib/anim/model.ts):

```ts
type TerrainSpriteDef = {
  ground: readonly string[];           // ヘックス上面(下から重ねる)
  objects?: readonly TerrainObjectDef[]; // 立体物(ビルボード・深度ソート参加)
};
type TerrainObjectDef = {
  srcs: readonly string[];             // バリアント(hex座標のハッシュで決定的に選択)
  occludes?: boolean;                  // 占有ヘックスで可読性フェードするか(森=true)
};
```

HexGrid 側の受け皿も実装済み: 立体物はユニットと同じ深度ソートに参加し、
同一ヘックスではユニットよりわずかに手前に接地(OBJECT_FOOT_BIAS_RATIO)して
足元・下半身を隠す。占有ヘックスの occludes 立体物は opacity 0.35 に落ちる。
プリロード(preloadTerrainSprite)・Loading画面・整合性テストも objects を含めて走査する。
**残りは素材だけ**: パイプラインの候補を data(objects)に書けば動く。

## スタイル一貫性の作り方(最難関)

1. **ステップ0: スタイルアンカーを1枚決める**。草原タイルを納得いくまで回し、
   「この世界の色・筆致・光」の見本として1枚選ぶ(ここだけは人間の審美眼の仕事)
2. 以降の全発注はアンカーを参照して生成(IPAdapter または低デノイズ img2img)+
   プロンプトテンプレ固定+光源文言固定
3. アンカーを差し替えたら全素材再生成(=アンカーがバージョン番号を持つ理由)。
   パイプラインが機械化されていればこの全再生成が怖くなくなる — これが A-3 の本当の価値

## 段取り

1. **Phase A(このPCで今すぐ・画像不要)**: 台座の縁+足元影。ジオラマ感の当たりを見る
2. **垂直貫通(最小)**: GPU機セットアップ → 草原1枚でアンカー確定 → 後処理・検収・
   組み込みを草原だけで一巡させ、ベルトが回ることを確認
3. **森で2層実証**: ground+木オブジェクト、深度ソート遮蔽+可読性フェード
   (design_diorama.md「森の中」の解)
4. **水平展開**: 残り地形 → skybox(A-7、同じアンカー・光源で生成)→
   カットイン背景(nano banana 併用可。ただし検収は同じベルトに乗せる)

## 生成物の置き場

- 採用素材(最終版)は Wesnoth の GPL 素材と違い**自作なので repo にコミットできる**。
  当面は `packages/frontend/public/terrain-diorama/` にコミットし、CDN移行(A-4/D)の際に
  fetch 方式へ切り替えるかを判断
- 候補・ボツ素材は repo に入れない(GPU機に残すか消す)
