# 画像配信(A-4): スプライトパック方式

最終更新: 2026-07-08(初回実装。以降の最適化はSonnet引き継ぎ — 末尾参照)

## 目的と結果

ユニットスプライト(Wesnoth素材)は数百の個別PNGで、対戦開始時に1000件超の
HTTPリクエストが発生していた。**陣営単位の連結ファイル(パック)**に固めることで:

```
1008リクエスト → 6リクエスト(全陣営合計 1.62MB)
チュートリアル実測: パック2件(両陣営)+ 個別リクエスト0件
```

CDNのAPIコール課金・モバイル回線のオーバーヘッドがこの比率で下がる。
画像バイトは既にPNG圧縮済みなので再圧縮はしない(転送圧縮はCDN/HTTP層)。

## 配信の3層構造

| 層 | 対象 | 配信方法 |
|---|---|---|
| アプリ組み込み | 採用済みジオラマ地形(32点)+ユニットbase立ち絵(フォールバック) | 静的import=Next.jsバンドル(ハッシュURL・不変キャッシュ)。dioramaImages.ts / unitBaseImages.ts |
| **スプライトパック** | ユニットのアニメフレーム一式(GPL素材・数百点) | 陣営単位の .psp を1fetch → blob URL展開 |
| 個別URL | パック無効時・取得失敗時 | 従来どおり `/sprites/...` を1枚ずつ(自動劣化) |

## ビルドと配置の手順

```bash
cd packages/frontend
node scripts/fetch-demo-sprites.mjs        # 個別PNGを public/sprites/ に取得(既存手順)
npx tsx scripts/build-sprite-packs.mts     # public/packs/units-<faction>.psp を生成
```

配置(ユーザー担当): `public/packs/*.psp` をCDNにアップロードし、環境変数
`NEXT_PUBLIC_SPRITE_PACK_BASE` を配置先に向ける(例: `https://cdn.example.com/packs`)。

- 未設定(既定)= パック無効。ローカルで試すなら `.env.local` に
  `NEXT_PUBLIC_SPRITE_PACK_BASE=/packs`(public/packs/ から配信される)
- 別オリジンのCDNは **CORS許可が必要**(fetchで取得するため)。取得後はblob URLなので
  canvas(チームカラー置換)のtainted問題は起きない
- パック取得に失敗した対戦は個別URL取得へ自動劣化する(Loading画面・進捗・リトライは
  既存のまま。パックは「下敷きのプリウォーム層」であり、失敗しても壊れない)

## 形式(PSP1)

`src/lib/assets/packFormat.ts`(encode/parse共有。test/packFormat.test.tsで往復検証):

```
magic "PSP1" | index長(uint32 LE) | index JSON { files: [{path, offset, size}] } | 連結バイト列
```

path は定義が参照するURL(ASSET_BASEなし。例 `/sprites/spearman/idle-1.png`)。

## ランタイム設計(読み込み側)

- **粒度 = spriteKeyの第2セグメント**(`units/<dir>/...`)。プレイヤーの陣営IDではなく
  `planSpritePacks()`(lib/assets/matchAssets.ts)が「ロスターが実際に参照するdir集合」を
  返す — 陣営間で共有されるユニット(反乱軍のマーマン=units/loyalists/等)の取り漏らし防止。
  昇格先ユニットは同一dirに置かれる運用なのでロスター起点で足りる
- `loadSpritePacks()`(lib/assets/spritePacks.ts)がfetch→`parsePack`→blob URL→
  `registerPackedAsset()`。以後 `resolveAssetUrl()`(lib/anim/assets.ts)が
  「定義URL→blob URL」を解決する。**キャッシュ・定義のキーは常に元URL**で、
  blob URLはロード/描画の直前だけに現れる
- 描画側の解決点: loadImage / recolorImage(チームカラー) / useUnitSprite /
  useStandingOverlays / エフェクトの`<image href>`(HexGrid・CutInStage) /
  UnitBodyのtcフォールバック
- **競争条件が2つあり、両方対策済み**(2026-07-08 実測で発見):
  1. ロスター外ユニット(CPUリーダー等)はマウント時プリロードがパック登録を追い越す
     → `preloadSprite` は `packsSettled()` を待ってから取得する
  2. Reactは子のeffectを親より先に実行するため、useMatchAssetsのeffectで
     パック取得を始めると間に合わない → **レンダー時(useMemo)に開始**する
     (loadSpritePacksは名前単位キャッシュで冪等)
- terrainは現状アプリ組み込みでパック不要。素材が増えて外部配信に戻す場合も
  同形式の別パック(例: terrain.psp)を足すだけでよい(2026-07-08 ユーザー合意:
  APIコールは1回である必要はなく、単位ごとの分割は許容)

## CloudFront配置の実録とハマりどころ(2026-07-08 実運用検証済み)

CloudFront + S3 で packs を配信し、実ブラウザで「パック2リクエスト・個別0件」を確認した。
到達までに踏んだ罠(全部実話):

1. **301が返る** → `http://` で叩いていただけ(Redirect HTTP to HTTPS)。`https://` を明示
2. **CORSは「レスポンスヘッダポリシー SimpleCORS」一択で設定する**。
   ビヘイビア編集画面には Cache policy / Origin request policy / Response headers policy の
   3つの似たドロップダウンが並び、**入れる欄を間違えても保存は通る**(実際に
   CachingOptimized(ID: 658327ea-…)だけが入っていて SimpleCORS が未設定だった)。
   SimpleCORS のマネージドID: `60669652-455b-4ae9-85a4-c4c02393f86c`
3. **S3側CORSに頼る方式はキャッシュ汚染する**: キャッシュキーに Origin が含まれないため、
   「Originなしリクエストが先にキャッシュを作る」と以後の CORS fetch が全部死ぬ。
   SimpleCORS は配信時にヘッダを付けるのでキャッシュ内容に依存しない(=事故らない)
3b. **真犯人はS3 CORSのAllowedOrigins漏れだった(実録の結末)**: S3のCORS設定に
   `http://localhost:*`(開発オリジン)が入っておらず、本番ドメイン由来のリクエストには
   ACAO付き・localhost由来にはACAOなしのレスポンスが返り、それが**オリジンごとに違う
   変種としてキャッシュされて**「動いたり動かなかったり」に見えていた。
   S3 CORS方式を使うなら **AllowedOrigins に開発・本番の全オリジンを列挙**すること。
   (SimpleCORS方式ならオリジン不問の`*`が配信時に付くため、この問題ごと消える)
4. **検証は curl だけで安心しない**: curl と実ブラウザでキャッシュ変種・エッジPOPが
   異なり、「curlは通るのにブラウザで死ぬ」が実際に起きた。最終確認は必ず実ブラウザ
   (DevToolsのNetworkで /packs/ 200×2・/sprites/ 0件)。CDPの
   `Network.responseReceivedExtraInfo` を見ると CORS で弾かれたレスポンスの生ヘッダが読める
5. **設定変更は全エッジ反映まで数分**かかる(Status: Deploying中は新旧が混在)。
   焦って再設定せず Deployed を待ってから測る

## Sonnet引き継ぎ(残タスク)

- 陣営間で重複する共有画像(飛び道具・halo等)の共通パック分離(現状は各パックに
  重複格納。数十KB規模なので急がない)
- webp/avif への再エンコード(ビルド時。デコード互換とサイズの実測比較から)
- パックファイル名への内容ハッシュ付与(`units-loyalists-<hash>.psp`)+参照マニフェスト
  — CDNの不変キャッシュを効かせる(現状はCDN側のキャッシュ制御頼み)
- PWA/Service Worker キャッシュとの統合(CPU戦特化リリース案 — backlog D)
- E2E: パック有効時のリクエスト数検証の自動化(手動検証手順: .env.localに
  PACK_BASE設定 → チュートリアルを開き devtools Network で /sprites/ が0件なこと)
