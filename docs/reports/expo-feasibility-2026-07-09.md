# Expo(React Native)移植の実現可能性調査(2026-07-09)

## 背景・動機

非同期PvPの「あなたの番です」通知は、現状10秒ポーリング止まり(Web Push未実装。
docs/project_direction.md・docs/backlog.md B参照)。iOS Safariのweb push対応が
不安定なため、web単体でこの弱点を解消するのは難しい。Expo(React Native)は
プッシュ通知がほぼ組み込みで、ここを正面から解決できる可能性がある。

前提: **現行のWeb版(CPU戦・本番環境)は「SIM環境」として残す**。Expoは置き換えでは
なく追加のクライアントという位置づけ。

## 結論

**盤面描画は「作り直し」ではなく「描画バックエンドの追加」で済む見込み。**
座標計算・アニメーションタイミング・戦闘演出の状態遷移といった「難しい部分」は
既にDOM非依存の純関数/フックとして分離されており、Expo/React Native
(react-native-svgまたは@shopify/react-native-skia)向けの新しい描画バックエンドを
既存のデータ・ロジック層の上に追加する形で対応できそうである。

以前の判断(docs/backlog.md「技術方針: three.js・WebGLは使わない」)とは別軸の話 —
あちらは「同じWeb内でレンダラーを重くする」ことの損得判断、今回は「別プラット
フォーム(ネイティブアプリ)向けにレンダラーを追加する」話。

## 調査内容(読んだ場所)

- skill: board-rendering(層構造・座標系・深度ソートの設計原則)
- `packages/frontend/src/lib/board/geometry.ts`
- `packages/frontend/src/lib/tilt.ts`(`projectTilt`)
- `packages/frontend/src/components/TiltStage.tsx`
- `packages/frontend/src/components/board/UnitBody.tsx`
- `packages/frontend/src/lib/sprites.ts`
- `packages/frontend/src/lib/assets/spritePacks.ts`
- `packages/frontend/src/lib/anim/teamColor.ts`

## 分類

### そのまま流用できる(DOM非依存の純関数・フック)

- `hex.ts`(core-engine)・`lib/board/geometry.ts`・`lib/board/objects.ts`/
  `colors.ts`/`timeOfDayFx.ts` — 座標・配色・立体物選択の純関数
- **`lib/tilt.ts`の`projectTilt`** — 傾き演出の要。CSSのrotateX+perspectiveを
  「画像を歪ませずに位置だけ動かす」ためにJSで再現した関数で、**元々CSS非依存**
  (コメント: 「地形と同じCSS変換をJS側で再現し、位置だけ投影先へ動かす」)。
  ユニット・立体物・エフェクト(ビルボード層)の位置決めはこれだけで完結している
- `lib/sprites.ts`のアニメーションフック(`useUnitSprite`等) — `useState`/
  `useEffect`のみに依存。React Nativeでもそのまま動く
- `TerrainSpriteDef`等のデータ層(フレーム・オフセット・duration) — 描画方式に
  依存しない記述

### 小さく孤立していて置き換えやすい

- `TiltStage.tsx` — CSS transformを当てるだけの3重divラッパー(52行、
  ゲームロジックなし)。`projectTilt`で地形ポリゴンの頂点も事前変換してしまえば、
  CSS 3DそのものをなくしてSVG/Skia側で1つの座標モデルに統一できる可能性がある
  (要検証。この設計判断自体はFable 5に振らずここで決めるべき論点)
- `UnitBody.tsx`/`TerrainObjectBillboard.tsx`/`TerrainTile.tsx`などの
  「共有描画部品」 — 既に計算済みの数値(cx/cy/scale)を受け取って描くだけの
  末端コンポーネント。同じprops契約を持つSkia版を並行実装すればよい
- 一部のCSSキーフレーム演出(行動状態リングの回転/振動) — Reanimated等への
  個別移植が必要

### ブラウザAPI依存で個別の再実装が要る(3箇所)

1. **チームカラー着色**(`lib/anim/teamColor.ts`) — Canvas 2Dのピクセル置換。
   Skiaの`ColorFilter`/シェーダーで書き直し
2. **スプライトパックのblob URL登録**(`lib/assets/spritePacks.ts`) —
   `URL.createObjectURL`はReact Native非対応。`expo-file-system`でローカル
   ファイルに書き出す方式に置き換え
3. **ヒットテスト/ジェスチャー** — 現状は「絵とヒット判定の分離」が既存の設計
   原則(ビルボードは`pointerEvents=none`、判定は地形ポリゴン側)なので、
   この考え方自体はRNのジェスチャーハンドラへそのまま移行できる見込み
   (SVG onClick→RNジェスチャーの配線だけが実質差分)

## 使うモデルについての判断

この規模(型の決まったアダプタ3つ+描画部品の並行実装)は、新しい抽象化の
発明ではなく既存の分離モデルへの追従作業のため、**Fable 5のようなオーケスト
レーション/上位モデルは過剰**という結論になった。理由:

- 対象範囲が独立した小部品に分割できるが、盤面は実機/シミュレータで**目視
  確認しながら**進める性質の作業で、自律的な並列実行より対話的なセッションで
  進めた方が手戻りが少ない
- 将来のUI/UX本格磨き(docs/backlog.md B「ui-ux-pro-max-skill」)も
  skillベースでモデル非依存の前提が既にある
- 格上のモデルが効くのは「型が確立していない設計判断」(今回のオーク陣営の
  バランス調整のような、独自に数値根拠を組み立てる作業)であって、
  「型が決まった実装をこなす」場面ではない、という切り分けが妥当

## Fable 5の使い方(この回だけ)

Fable 5には**設計をさせない**。このdocsを読ませて「設計判断として難しそうな
部分を抽出する」タスクだけを与える(候補: TiltStage廃止の是非、Skia版
描画部品のprops契約設計、spritePacksのファイルキャッシュ寿命管理など)。
抽出された論点をユーザー・Sonnet側で判断してから、実装は通常セッションで
進める。
