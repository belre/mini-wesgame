# mini-wesgame

parle-stroika からの移植ミニ版: **Vercel単独・CPU戦のみ・人間族vsオーク・Wesnoth準拠地形**。
差分の全体像は README.md。npm workspaces + TypeScript strict + ESM。

## 必読ドキュメント(この順で)

1. **docs/architecture.md** — 実装の設計思想・不変条件・コードマップ・ハマりどころ。**コードを変更する前に必ず読む**
2. docs/project_direction.md — 計画書(スコープ・フェーズ分け・技術判断の背景)
3. docs/local_dev_guide.md — ローカル検証(WSL Docker)とデプロイの手順

## 絶対に守ること

- ゲームルールは `packages/core-engine`(純粋関数・React非依存)にのみ実装する
- ルール変更には `packages/core-engine/test/` にテストを追加する
- ヘックス計算は `hex.ts` の関数を使う(odd-qオフセットのため生の±1計算は不正)
- pull後は `node packages/frontend/scripts/fetch-demo-sprites.mjs` を一度実行する
  (gitignoreされた `public/sprites/` が無いとローカルで地形・スプライトが表示されない。
  2026-07-10以降は`NEXT_PUBLIC_ASSET_BASE`が既定でCDN(wesnoth-contents-delivery)を
  指すため、typecheck/buildの成否には影響しない)

## よく使うコマンド

```
npm run test -w @parle-stroika/core-engine   # ルールのユニットテスト(最速ループ)
npm run typecheck                            # 全ワークスペース型チェック
npm run dev                                  # Next.js dev(ポート3010固定)
npm run test -w frontend                     # スプライト定義とfetchの整合性テスト
npm run test:e2e -w frontend                 # スマホ実タッチのE2E(傾き盤面。Playwright)
```

環境メモ: devサーバーは**ポート3010に固定**(3000/3001は他プロジェクトと競合)。
停止時に子プロセス(next-server)がポートを塞ぐことがある — killはポート番号まで
含めたパターンで絞ること。
