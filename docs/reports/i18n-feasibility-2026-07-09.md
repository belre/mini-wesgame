# i18n(多言語対応)の実現可能性調査(2026-07-09)

## 背景・動機

現状は完全に日本語のみ。ユーザーからの壁打ち依頼: i18n対応にFable 5のような
オーケストレーション級のモデル運用が必要かどうかの判断。

## 結論

**Fable 5級のオーケストレーションは不要。通常セッションで十分。**

理由は`docs/reports/expo-feasibility-2026-07-09.md`の判断軸と同じ:
「型が決まっていない設計判断」ではなく「型が決まった実装をこなす」場面だから。
むしろExpo調査より判断の余地は小さい(ライブラリ選定・ルーティング方式・辞書の形の3点のみ)。

## 調査内容(読んだ場所)

- `packages/core-engine/src/traits.ts`(TRAIT_NAMES/SPECIAL_NAMES/ABILITY_NAMES)
- `packages/core-engine/src/types.ts`(id/nameのコメント規約)
- `packages/core-engine/src/data/factions/*.ts`・`terrain.ts`・`maps/*.json`
- `packages/core-engine/src/data/tutorials/basic_battle.json`
- `packages/core-engine/src/engine.ts`(EngineErrorメッセージ)
- `packages/frontend/src/components/*`(JSX中の日本語文字列)
- `packages/frontend/src/components/CutInStage.tsx`(COMBAT_MOMENT_LABELS)
- `packages/frontend/src/app/layout.tsx`・`next.config.ts`
- `docs/architecture.md`・`docs/sprite_guide.md`・`docs/project_direction.md`・`docs/backlog.md`・`CLAUDE.md`

## 分かったこと

### 追い風: 最初からローカライズを見越した設計になっている

`types.ts`の`UnitDef`/`Faction`/`TerrainDef`/`GameMap`はどれも同じコメント規約を持つ:

```ts
id: string; // 英語の安定したキー(スプライトアニメ選択等に使う)。表示は name を使う
name: string; // 表示名(ローカライズ対象。現状は日本語)
```

`docs/architecture.md`・`docs/sprite_guide.md`も「アニメ選択等のロジックは必ずidを見る、
nameは変わりうるので使わない」と明記済み(偶然ではなく意図的な規約)。

さらに`traits.ts`に**既に実装済みの見本**がある:

```ts
export const TRAIT_NAMES: Record<TraitId, string> = { strong: "強力", ... }; // 13件
export const SPECIAL_NAMES: Record<AttackSpecial, string> = { backstab: "奇襲", ... }; // 11件
export const ABILITY_NAMES: Record<UnitAbility, string> = { ambush: "伏兵", ... }; // 9件
```

i18nは基本的に「この型(英語ID→表示文字列のRecord)を、陣営名・ユニット名・武器名・
地形名・マップ名・チュートリアル文にも横展開し、Record自体をロケール別に用意する」
だけで済む。新しい抽象を発明する必要がない。

`CutInStage.tsx`の`COMBAT_MOMENT_LABELS`(戦況要約タグの日本語ラベル)も同じ型で
既に実装済み(2026-07-09の別作業で追加)。

### 翻訳対象の総量は小さい

- チュートリアルは現状1本(`basic_battle.json`)・ガイド5個・`title`+`text`で
  合計700〜800文字程度
- core-engineのデータファイル内`name`フィールド: 陣営7・ユニット数十・地形17種・
  マップ数枚(いずれも数語の短い名前)
- `EngineError`のメッセージ: `engine.ts`に24箇所、その場に直書き(まとまった辞書はまだ無い)
- フロントのJSX内文字列: 実際に画面に出る文言は14ファイルに64箇所、属性
  (title/placeholder等)込みでも13ファイルに123箇所程度。ただしこの中には
  `/dev/*`の検証専用ページ(SpriteAnimDemo・CutInDemo・MapEditor等)が多く含まれ、
  プレイヤー向け画面はその一部(BoardScreen・LobbyForms・MatchView・UnitCatalog・
  TurnLogPanel等)に絞られる

### 向かい風: 何も無いところからの立ち上げになる

- i18nライブラリ(next-intl等)は未導入、`next.config.ts`にi18n設定なし、
  `middleware.ts`・`[locale]`セグメントも無し、`app/layout.tsx`は`<html lang="ja">`固定
- `docs/`にi18n計画への言及は無し(`architecture.md`・`sprite_guide.md`の
  「idを使えnameは使うな」の注意書き2箇所のみで、実装計画としての記述はゼロ)
- `docs/backlog.md`のリリース形態検討(D章: Expo移植・CPU戦特化広告モデル・
  デモ版・Android)はどれも多言語・海外市場に触れていない → 対象言語(まず英語か)
  はユーザー判断待ちの未決事項

## 必要な設計判断(この3点のみ)

1. **ライブラリ選定**: next-intl(App Router向けに設計された定番)が最有力候補
2. **ロケールルーティング方式**: サブパス方式(`/en/...`)かCookie/ヘッダー判定方式か
3. **core-engine側辞書の形**: `TRAIT_NAMES`と同型のRecordをロケールごとに用意し、
   核となるゲームルール(純関数)はロケールを一切知らないまま、表示層(フロント)が
   `id`からロケール別Recordを引く、という責務分離を維持する
   (「ゲームルールはcore-engineに、AWS/React非依存で」というCLAUDE.mdの原則と矛盾しない)

いずれも一般的なWeb開発で確立されたパターンで、独自に数値根拠を組み立てるような
判断(今回のオーク陣営バランス調整のような場面)ではない。

## 使うモデルについての判断

Expo調査と同じ結論・同じ理由:

- 対象範囲は独立した小部品(ファイルごとの文字列抽出)に分割できるが、
  「型が決まっていない設計判断」がほぼ無く「型の決まった反復作業」が大半
- 反復作業(文字列抽出)を並列化したい場合も、Fable 5である必要はなく、
  通常セッション内の複数サブエージェント(Agent tool)への水平分業で足りる
- 翻訳文そのものの品質(自然な英語になっているか等)は「賢さ」より「言語運用力」の
  問題で、Sonnet級で十分。オーケストレーションで解決する種類の課題ではない

## 残っている未決事項(ユーザー判断待ち)

- 対象言語(まず英語のみか、複数言語か)
- ライブラリ選定の最終確認(next-intl前提でよいか)
- 翻訳の質を誰が担保するか(機械翻訳のレビュー体制。ゲーム用語の一貫性が特に重要
  — 例: 陣営名・特性名・地形名は`TRAIT_NAMES`型の辞書で一元管理されるため、
  ここだけ丁寧に決めれば残りは機械的に揃う)
