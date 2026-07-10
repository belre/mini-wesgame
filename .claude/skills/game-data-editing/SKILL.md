---
name: game-data-editing
description: ゲームデータ(ユニット・地形・陣営・マップ・チュートリアル)の追加・変更手順。ステータス調整・新ユニット・新地形・表示名変更・マップ追加のときに使う
---

# ゲームデータの更新手段

最終更新: 2026-07-08。ルールの実装知識は docs/architecture.md、
方針は「能力は単純に保つ」(説明が増える能力はエンジン実装があってもデータから外す。
バグと即断せず意図を確認)。

## 0. 鉄則

1. **ゲームルールは packages/core-engine のみ**。フロントやLambdaにif文を書かない
2. **ルール・データ変更には packages/core-engine/test/ にテストを足す**
   (`npm run test -w @parle-stroika/core-engine` が最速ループ。現在193件)
3. **エンジンのIDは変えない**。世界観の改名はフィクションパス=表示層のみ
   (name/文言/絵。例: id "keep" の name が「フラッグ」)

## 1. データの場所マップ

| 変えたいもの | ファイル |
|---|---|
| 地形(移動コスト・防御率・表示名) | core-engine/src/data/terrain.ts(+テスト terrain.test.ts) |
| ユニット(HP・攻撃・移動型・特性・XP) | core-engine/src/data/factions/<陣営>.ts |
| 陣営構成(雇用ロスター・リーダー候補) | core-engine/src/data/factions/index.ts |
| マップ | core-engine/src/data/maps/*.json(+maps.tsでimport登録。ロード時に整合性検証あり) |
| チュートリアル(ガイド文・トリガー) | core-engine/src/data/tutorials/*.json |
| ユニットの絵(スプライト定義) | frontend/src/lib/content/<陣営>.ts(WMLアニメの移植) |
| 地形の絵 | frontend/src/lib/content/index.ts の TERRAIN_SPRITES(skill: board-rendering §3) |

## 2. 型の要点(間違えやすい)

- **移動タイプは3種のみ**: walk / fly / swim。**cavalry は防御率参照専用**
  (騎馬は移動walk+防御cavalry)。IMPASSABLE=99
- 通行不可の壁は moveCost で表現する(岩場=walk:IMPASSABLE,fly:1 / 深水=walk:IMPASSABLE,swim:1)。
  ユニット別の通行例外はまだ無い(最小案=移動タイプ追加。backlog B参照)
- マップのタイル文字: g草原 f森 s砂地 d砂丘 h丘 m岩場 w浅瀬 W深水 v補給拠点 c陣地 k(フラッグ)。
  **keepは走査順(上→下、左→右)でP0、P1に割当**(旗の陣営色もこの規則を共有)
- XP: `advancesTo`(昇級先ID列)+ `maxXpFor()`(特性補正込み)。昇級先ユニットの
  データ敷設が未完(backlog B)

## 3. 新ユニットを追加する手順(フルコース)

1. core-engine: factions/<陣営>.ts に UnitDef を追加(spriteKeyは `units/<陣営dir>/<名前>`)
2. テスト: ステータスの意図(相性・コスト帯)をterrain/combatテストの流儀で
3. 絵: frontend/src/lib/content/<陣営>.ts にスプライト定義
   (既存ユニットのWML移植パターンを踏襲。共通ビルダーは content/shared.ts)
4. 画像取得: frontend/scripts/fetch-demo-sprites.mjs の ASSET_GROUPS に取得元を追加
   → `node scripts/fetch-demo-sprites.mjs`
5. **整合性テストが守ってくれる**: `npm run test -w frontend`
   (定義が参照する全画像がfetch対象に含まれるか検証。乖離=見えないユニットの予防)
6. パック再ビルド(配信済み環境がある場合): `npx tsx scripts/build-sprite-packs.mts`
   → CDNへ再アップロード(skill: cdn-deployment)。
   **パックはUNIT_SPRITES全定義から生成される**ので追加漏れの心配は不要
   (雇用ロスター起点ではない — 昇級先が漏れた実績から全定義方式にした)

## 4. 表示名・文言を変える(フィクションパス)手順

1. terrain.ts / UnitDef の name だけ変える(IDは不変)
2. **チュートリアル本文(tutorials/*.json)とUI文言の同語を掃く**
   (例: 山→岩場のとき「山」への言及を grep。⌂のような記号参照は実体の説明に置換)
3. 通貨・資源の語彙は「物資・補給・維持費」系で統一
   (「収入」はお金の語なので使わない — 2026-07-08 用語決定)
4. 勝利条件の明示を壊さない: **勝利=リーダー撃破。フラッグ奪取では勝てない**を
   チュートリアルから消さないこと

## 5. スクリプトからデータを読むときの注意

`lib/content/index.ts` はジオラマ画像の静的import(png)を含むため、
**tsx実行のNodeスクリプトからはimportできない**。ユニット定義だけ必要なスクリプトは
`lib/content/units.ts`(png importなし)を参照する(build-sprite-packs がこの方式)。
