# mini-wesgame

[parle-stroika](https://github.com/belre/parle-stroika) からの移植ミニ版(2026-07-08)。
**開いた瞬間にCPU戦が始まる**、Vercel単独で動くターン制ウォーゲーム(Wesnoth系ルール)。

## 本家(parle-stroika)との差分

| 項目 | parle-stroika | mini-wesgame |
|---|---|---|
| インフラ | AWS(Lambda/DynamoDB/CloudFront)+ Vercel | **Vercelのみ**(バックエンドなし) |
| 入口 | ロビー(ログイン・マッチング) | **トップ=即CPU戦**(ログインなし) |
| 対戦 | 非同期PvP + CPU戦 | CPU戦のみ(ブラウザ内で完結) |
| 陣営 | 6陣営 | **人間族とオークのみ**(PLAYABLE_FACTION_IDS。他陣営のデータ定義はルールテストの資産として温存) |
| 地形の絵 | 自作ジオラマ(AI生成パイプライン) | **Wesnoth準拠タイル**(fetch-demo-sprites.mjsで取得。アートのない新地形は色ポリゴン) |
| assets-pipeline | あり(発注→生成→検収) | なし |

エンジン(core-engine)・盤面描画(BoardScreen/HexGrid)・カットイン・開発ページ
(/dev/units, /dev/mapeditor 等)・docs一式は本家と同一系統。

## セットアップ

```bash
npm install
cd packages/frontend && node scripts/fetch-demo-sprites.mjs   # Wesnothスプライト取得(GPL・gitignore)
npm run dev        # http://localhost:3010
npm run test       # エンジン+フロントの全テスト
npm run typecheck
```

## Vercelデプロイ

- Root Directory: `packages/frontend`
- Build Command: `node scripts/fetch-demo-sprites.mjs && next build`
  (gitignoreされたスプライト・生成モジュールをビルド時に用意する — これが無いとビルドが落ちる)
- 環境変数: 不要(バックエンドなし)

## ライセンスとアセットの出所

- **コード**: No License(all rights reserved)。閲覧は可能ですが、利用・改変・再配布の
  権利は付与しません(方針: wesnoth-contents-delivery/wesnoth_license_notes.md)
- **画像・音声アセット**(Battle for Wesnoth由来。GPL v2+/CC BY-SA 4.0):
  リポジトリには含まれません(gitignore)。ビルド時に上流から取得し、
  静的ファイルとして分離配信します(コードに埋め込まない=GPLv3アグリゲート条項)。
  配信アセットの**改変可能形式(PSPパック)は
  [wesnoth-contents-delivery](https://github.com/belre/wesnoth-contents-delivery) の
  `mini-wesgame/` で公開**しています(GPLv3 §6(d)のソース提供)
- 「Battle for Wesnoth」はWesnoth, Inc.の商標です。本プロジェクトは
  Wesnothプロジェクトとは無関係の非公式利用です
