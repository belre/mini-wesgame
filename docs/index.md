# Parle-Stroika 設計ドキュメント

> **注(mini-wesgame)**: このリポジトリは parle-stroika からの移植ミニ版です。
> Vercel単独・CPU戦のみ・人間族vsオーク・地形はWesnoth準拠タイル(ジオラマなし)。
> 以下のドキュメントは本家の設計記録で、AWS/ジオラマ/非同期PvPの記述は
> 本家側の話として読んでください。差分は README.md 参照。

非同期ターン制ウォーゲーム(Wesnoth系ルール)。盤面は「サバゲーフィールドのミニチュア」を
コンセプトにしたジオラマ表現で、スマホのブラウザで遊べる。

このページは**人間が全体像を把握するための入口**です。各論は下部の
[ドキュメントマップ](#docmap)から辿ってください。
(作業ログ・AI向けの手順は各ドキュメントと `.claude/skills/` に分離されています)

## どんなゲームか

- **ルールの骨格は Battle for Wesnoth 系**: ヘックス盤面、地形ごとの回避率と移動コスト、
  昼夜サイクルと秩序/混沌の補正、雇用と維持費、経験値とレベルアップ
- **勝利条件は敵リーダーの撃破のみ**(フラッグ=本陣は雇用拠点であって、奪取しても勝ちではない)
- **非同期PvP が本来の狙い**: 自分のターンだけ操作して送信し、相手は後で確認する
  (双方が同時にオンラインである必要がない)。CPU戦(チュートリアル)はサーバー不要で
  ローカル完結する
- **世界観はフィクションパスで統一**(2026-07-08 完成): 村→補給拠点、ゴールド→物資、
  城→陣地、主城→フラッグ、山→岩場、砂漠→砂丘、深海→深水。
  すべて表示層のみの改名で、エンジンのID・ルール・テストは無傷

## システム全体像

```
モノレポ(npm workspaces + TypeScript strict + ESM)
│
├── packages/core-engine    ゲームルールの全て(純粋関数。AWS/React非依存)
│     ├ 移動・戦闘・雇用・時間帯・XP・AI(CPU)・チュートリアル進行
│     └ data/ 地形・陣営・ユニット・マップ(JSON)
│
├── packages/frontend       Next.js(App Router)
│     ├ BoardScreen  盤面UI(操作・下書き・演出の結線)
│     ├ HexGrid      SVG描画+CSS3D傾き+ビルボード投影
│     ├ CutInStage   戦闘カットイン(盤面と同じ再生データを購読する別レンダラー)
│     └ lib/         エンジン呼び出し・アセット配信・アニメーション解決
│
├── packages/backend        Lambda(非同期PvPのアクションAPI。エンジンを共有)
├── infra                   AWS CDK(DynamoDB・S3/CloudFront・API)
└── assets-pipeline         AI画像生成→後処理→検収のパイプライン(Python/uv)
```

**最重要の構造**: ゲームルールは core-engine にしかない。クライアントとサーバーが
同じ関数を実行するので、チート検証・リプレイ・CPU戦のローカル実行が同じコードで成立する。

## コアの設計原則

| 原則 | 内容 | なぜ |
|---|---|---|
| ルールは純粋関数 | core-engine は React/AWS 非依存。`applyAction(state, action) → events` | クライアント/サーバー共有、テスト容易、オフラインCPU戦が無料で手に入る |
| WebGLを使わない | 盤面はSVG+CSS 3D transform(傾き)+ビルボード投影(lib/tilt.ts) | E2E・ヒットテスト・SSRの安定。同じ絵がDOMで出せるならWebGLは書き換えコストだけ |
| 1つのタイムライン、複数のレンダラー | 戦闘は combatTimeline(再生データ)を盤面内アニメとカットインが購読 | 演出の内容が構造的に食い違わない。レンダラー追加(音・リプレイ)が安い |
| 描画と判定の分離 | クリックは透明なCSS傾け平面が受け、絵(ビルボード)は pointerEvents 無効 | 演出をいくら盛っても操作が壊れない(ユニット浮き・立体物遮蔽が安全に入る) |
| フィクションパスは表示層のみ | 名称・文言・絵だけ差し替え、エンジンIDは不変 | ルールとテストを守ったまま世界観を何度でも作り直せる |
| アセットは3層配信 | ①アプリ組み込み(地形・base絵) ②陣営パック(CDN) ③個別URL(自動劣化) | 1008リクエスト→6。CDN障害でもゲームは止まらない |

## 盤面演出の3原則(design_diorama.md より)

1. **舞台装置は奥・キャラは手前** — テント・旗・小道具は足元をヘックス奥(dy≲-0.3)に
   置き、ユニットが常に手前に描かれる
2. **旗の色=支配、旗の大きさ=重要度** — 本陣は大旗、確保した補給拠点には小旗が立つ
3. **各視点内の一貫性 > 視点間の整合** — 立体物の配置はビュー空間で適用され、
   両プレイヤーの見る盤面は物理的には同一でない(意図的。誰も両方同時には見られない)

## 現在のリリース戦略(検討中)

**CPU戦特化・オフライン+広告モデルが有力候補**(backlog.md D参照)。
チュートリアル=ローカル完結CPU戦が既にログイン・DB不要で動いており、
バックエンド費用ゼロで成立する。非同期PvPは共有エンジン設計のおかげで後から足せる。
サイズ感: アプリ本体約2.1MB、初回対戦のダウンロード約1.3MB(全部不変キャッシュ)。

## ドキュメントマップ {#docmap}

| ドキュメント | 何が書いてあるか | いつ読むか |
|---|---|---|
| [architecture.md](architecture.md) | 実装の設計思想・不変条件・コードマップ・ハマりどころ | **コードを変更する前に必ず** |
| [project_direction.md](project_direction.md) | 計画書(スコープ・フェーズ分け・技術判断の背景) | 方針を確認したいとき |
| [design_philosophy.md](design_philosophy.md) | 設計哲学の系譜(3つの失敗からの制約・難しさの材質・座標) | このゲームが「何であって何でないか」を思い出したいとき |
| [design_diorama.md](design_diorama.md) | 盤面ビジュアルの設計指針(ジオラマ・カットイン・アートディレクション) | 見た目に触るとき |
| [design/diorama_pipeline.md](design/diorama_pipeline.md) | AI画像生成パイプラインの設計 | 素材を作るとき(手順は skill 側) |
| [asset_delivery.md](asset_delivery.md) | 画像配信の3層構造・スプライトパック・CDN配置手順とCORS実録 | 配信・デプロイを触るとき |
| [sprite_guide.md](sprite_guide.md) | Wesnothスプライトの取得・ライセンス(GPL)・監査 | ユニット絵に触るとき |
| [local_dev_guide.md](local_dev_guide.md) | ローカル検証(Docker/DynamoDB)とデプロイ手順 | 環境構築時 |
| [backlog.md](backlog.md) | 残課題の整理(優先度・完了記録・リリース形態メモ) | 次にやることを決めるとき |
| [devlog.md](devlog.md) | itch.io等向けdevlogの下書き置き場(バッチごとに追記) | リリース内容を告知するとき |
| [openapi.yaml](openapi.yaml) | 対戦APIのOpenAPI仕様(エンドポイント・スキーマ・エラーコード) | APIを叩く/変えるとき |

## 開発クイックリファレンス

```bash
npm run test -w @parle-stroika/core-engine   # ルールのユニットテスト(最速ループ)
npm run typecheck                            # 全ワークスペース型チェック
npm run dev                                  # Next.js dev(ポート3010固定)
npm run test -w frontend                     # スプライト・アセット整合性テスト
npm run test:e2e -w frontend                 # スマホ実タッチのE2E(Playwright)

# このドキュメントサイトを見る(Zensical。要uv)
uvx zensical serve                           # http://localhost:8000
uvx zensical build                           # site/ に静的サイトを生成
```

開発用ページ: `/dev/terrain`(地形検収)・`/dev/sprites`(アニメ検証)・`/dev/cutin`(カットイン検証)・`/dev/units`(ゲームデータカタログ: 地形マトリクス+全ユニット表。生きた仕様書)・`/dev/mapeditor`(マップエディタ: クリックで塗り・点対称ペイント・JSON入出力)
