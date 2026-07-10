---
name: cdn-deployment
description: アセット配信とデプロイの運用手順。スプライトパック/terrainパックのビルドとwesnoth-contents-deliveryへの配置、およびVercel・itch.ioへのデプロイのときに使う
---

# CDN展開とデプロイ

最終更新: 2026-07-10。設計の背景は docs/asset_delivery.md。
mini-wesgameは **CPU戦+チュートリアルのみでバックエンド無し**(`infra/`・`packages/backend`は
このリポジトリに存在しない。旧parle-stroikaのAWS/DynamoDB構成は移植されていない)。
`output: "export"`(next.config.ts)で完全な静的HTMLへ書き出せるため、
**Vercelとitch.ioで同じビルド成果物(`packages/frontend/out/`)を使い回せる**。

## 1. 配信の2層(前提知識。docs/asset_delivery.md参照)

| 層 | 対象 | 配信方法 |
|---|---|---|
| スプライトパック | ユニットのアニメフレーム(陣営単位)+terrain一式 | .psp を1fetch → blob URL展開。`NEXT_PUBLIC_SPRITE_PACK_BASE` |
| 個別URL | パック無効時・取得失敗時・unit-baseフォールバック絵 | `/sprites/...` を1枚ずつ(自動劣化)。`NEXT_PUBLIC_ASSET_BASE` |

どちらも既定値は `next.config.ts` で jsDelivr 経由の
`https://cdn.jsdelivr.net/gh/belre/wesnoth-contents-delivery@main/mini-wesgame` を指している。
**mini-wesgame自身のビルドにはWesnothのGPL/CC-BY-SA画像を一切含めない**
(公開デプロイのGPLv3第6条(d)対応。同梱していた時代の名残の記述に注意: 古いコミット・
docsに「アプリ組み込み」「dioramaImages.ts」等とあれば2026-07-10以前の話)。

## 2. パックの再生成・delivery repoへの反映(素材を追加/変更したときだけ)

```bash
cd packages/frontend
node scripts/fetch-demo-sprites.mjs        # 上流(wesnoth/wesnoth)から個別PNGを public/sprites/ に取得
npx tsx scripts/build-sprite-packs.mts     # public/packs/{units-<faction>,terrain}.psp を生成
```

生成物・`public/sprites/`一式を `~/github/wesnoth-contents-delivery/mini-wesgame/` へコピーし、
そのリポジトリでcommit・push(GitHub: `belre/wesnoth-contents-delivery`)。jsDelivrは
push後すぐ配信されるが、branch参照(`@main`)は最大12時間ほどキャッシュされることがあるため、
急ぐ場合は purge APIを叩く:

```bash
curl "https://purge.jsdelivr.net/gh/belre/wesnoth-contents-delivery@main/mini-wesgame/<path>"
```

検証は実ブラウザで(DevTools Network): `units-loyalists.psp`・`units-northerners.psp`・
`terrain.psp` の3リクエストがCDN宛てに200で返り、`/sprites/...`個別リクエストが
(unit-baseフォールバック絵を除いて)出ていないこと。

**ハマりどころ(2026-07-10実測、2件)**: パックを追加しても地形の描画側が
`resolveAssetUrl()`を通していないと個別リクエストのまま(`TerrainTile.tsx`/
`TerrainObjectBillboard.tsx`で修正済み)。また地形のプリロードが`packsSettled()`を
待たずに`loadImage`するとパック登録を追い越して個別リクエストに漏れる
(`preloadTerrainSprite`/`useImagesReady`で修正済み)。新しい描画経路を足すときは
この2点(resolveAssetUrl経由か・packsSettled待ちか)を必ず確認すること。

## 3. Vercelへのデプロイ

1. VercelでGitHubリポジトリ(`belre/mini-wesgame`)をimportし、**Root Directory を
   `packages/frontend`** に設定(Framework Preset: Next.js。`output:"export"`により
   Vercelは静的サイトとして扱う)
2. Root Directory設定内の**「Include files outside of the Root Directory」を必ずON**
   (npm workspacesで`core-engine`を参照しているため。OFFだと依存解決に失敗する)
3. **Build Command・Install Commandは既定のままでよい**(`next build`のみで完結。
   `public/sprites/`が無くてもtypecheck/buildは通る。スプライトパックは
   `NEXT_PUBLIC_SPRITE_PACK_BASE`/`NEXT_PUBLIC_ASSET_BASE`の既定値=jsDelivrから配信される)
4. 環境変数は通常追加不要(自前のCDNに差し替えたい場合だけ上記2変数をVercel側で上書き)
5. Deploy。バックエンド設定はゼロで動く(チュートリアル・CPU戦ともローカル完結)

## 4. itch.io(静的ファイル)へのデプロイ

```bash
cd packages/frontend
npm run build   # packages/frontend/out/ が生成される(sprites取得は不要)
cd out && zip -r ../itch-build.zip .
```

itch.ioでプロジェクト作成 → Kind of project: **HTML** → zipをアップロード →
`index.html`に「This file will be played in the browser」をチェック → 公開設定を選んで保存。

## 5. Sonnet引き継ぎの残り(docs/asset_delivery.md 末尾と同期)

共通パック分離(飛び道具・halo等の陣営間重複) / webp化 / パック名への内容ハッシュ /
PWAキャッシュ統合 / リクエスト数検証のE2E自動化
