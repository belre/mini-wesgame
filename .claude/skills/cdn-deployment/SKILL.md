---
name: cdn-deployment
description: アセット配信とデプロイの運用手順。スプライトパックのビルド→CloudFrontへの配置→CORS設定→検証、およびVercelへのフロントエンドデプロイのときに使う
---

# CDN展開とデプロイ

最終更新: 2026-07-08。設計と実録は docs/asset_delivery.md(必読。CORSの罠5点+真因)。

## 1. 配信の3層(前提知識)

| 層 | 対象 | 备考 |
|---|---|---|
| アプリ組み込み | 地形32点+ユニットbase絵 | Next.jsバンドル。デプロイに自動で付いてくる |
| 陣営パック(.psp) | ユニットアニメ全フレーム | CDNから1fetch/陣営。1008→6リクエスト |
| 個別URL | フォールバック | パック失敗時に自動劣化+盤面トースト通知 |

## 2. パックのビルドとCloudFront配置

```bash
cd packages/frontend
node scripts/fetch-demo-sprites.mjs        # 前提: public/sprites/ を用意
npx tsx scripts/build-sprite-packs.mts     # public/packs/units-<faction>.psp を生成

aws s3 sync public/packs/ s3://<バケット>/packs/ --content-type application/octet-stream
```

CloudFront設定(1回だけ):

1. **CORSは「レスポンスヘッダポリシー SimpleCORS」一択**(マネージドID:
   `60669652-455b-4ae9-85a4-c4c02393f86c`)。コンソールで反映されない事象があったため、
   確実なのはスクリプト: `bash infra/scripts/attach-simplecors.sh <ディストリビューションID>`
2. S3側CORSに頼る場合は AllowedOrigins に**開発(localhost)・本番の全オリジンを列挙**
   (漏れたオリジンだけ壊れ、キャッシュ変種で「動いたり動かなかったり」に見える — 実録参照)
3. 有効化: `NEXT_PUBLIC_SPRITE_PACK_BASE=https://<ドメイン>/packs`(ビルド時env。
   未設定=パック無効=従来動作)

検証(必ず実ブラウザで。curlだけで安心しない):

```bash
curl -sI -H "Origin: http://localhost:3010" https://<ドメイン>/packs/units-loyalists.psp \
  | grep -iE "HTTP/|access-control"    # 200 + access-control-allow-origin
# → チュートリアルを開き DevTools Network で /packs/ 200×2・/sprites/ 0件
# 失敗時は盤面トースト「高速配信(CDN)への接続に失敗しました」が出る(ゲームは続行)
```

## 3. Vercelへのフロントエンドデプロイ(※2026-07-08時点で未実施・未検証の手順)

モノレポなのでVercel側の設定が肝。想定手順(実施時に検証して本節を更新すること):

1. VercelでGitHubリポジトリをimportし、**Root Directory を `packages/frontend`** に設定
   (Framework Preset: Next.js)。モノレポ依存(core-engine等)はnpm workspacesで
   リポジトリルートからinstallされる — Vercelは自動でルートのpackage-lock.jsonを検出するが、
   効かない場合は Install Command を `npm install --prefix ../..` 等に調整
2. **Build Commandに生成物の準備を足す**:
   ```
   node scripts/fetch-demo-sprites.mjs && next build
   ```
   - fetch-demo-sprites: `public/sprites/`(ローカルdev用フォールバック。
     2026-07-10以降は`NEXT_PUBLIC_ASSET_BASE`が既定でCDN(wesnoth-contents-delivery、
     jsDelivr経由)を指すため無くてもtypecheck/buildは落ちない)
   - build-sprite-packs(.psp生成)は不要になった。アニメフレームパックは
     `wesnoth-contents-delivery`にビルド済みのものを置いてあり、
     `NEXT_PUBLIC_SPRITE_PACK_BASE`の既定値がそれを指す
3. 環境変数: `NEXT_PUBLIC_SPRITE_PACK_BASE`/`NEXT_PUBLIC_ASSET_BASE`は
   `next.config.ts`にjsDelivr既定値を設定済みなので、通常は追加設定不要
   (自前のCDNに差し替えたい場合だけVercelのプロジェクト環境変数で上書きする)。
   バックエンド(対戦API)を繋ぐ場合はAPI URL系も(CPU戦特化なら不要)
4. **CPU戦特化リリースならバックエンド設定ゼロで動く**はず(チュートリアルは
   ローカル完結)。ロビー(/)はDynamoDB接続がないと500になるため、リリース形態に
   応じてトップページの差し替えを検討
5. サイズ感の目安: アプリ本体約2.1MB+スプライト同梱時+6.5MB(Vercel制限には遠い)

## 4. インフラ(AWS CDK)側

- `npm run cdk:synth` でCFnテンプレート確認。S3+CloudFront+DynamoDB+Lambdaは
  infra/lib/parle-stroika-stack.ts(出力: AssetBaseUrl等)
- DynamoDBテーブル定義を変えるときは **infra/lib/parle-stroika-stack.ts と
  packages/backend/scripts/create-local-tables.ts の2箇所を必ず同期**(CLAUDE.md絶対則)

## 5. Sonnet引き継ぎの残り(docs/asset_delivery.md 末尾と同期)

共通パック分離 / webp化 / パック名への内容ハッシュ / PWAキャッシュ統合 /
リクエスト数検証のE2E自動化 / 本節3(Vercel)の実施検証と更新
