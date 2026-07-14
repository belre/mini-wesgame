# 作業指示書: ダメージ丸め規則の修正(Reddit報告のバグ)+bowman是正

2026-07-14。wesnoth-react-engine側で原因特定・修正済みの内容をminiへ移植する指示書。
根拠の実測データは wesnoth-react-engine の `docs/damage_wesnoth.md`(本家1.18のゲーム画面から取得)。

## 背景

Redditのフィードバック「計算値がおかしい」の原因を特定した。**ダメージの丸め規則**が本家と違う:

- 本家1.18の `round_damage` は非対称丸め: **.5ちょうどのとき基礎値側へ寄せる**
  = ボーナス(総合倍率>1)の .5 は切り捨て、ペナルティ(<1)の .5 は切り上げ
- miniの現実装は `Math.round`(常に切り上げ)なので、**ボーナス側の .5 だけ全部1点大きい**

実例(miniの実データで「×1.25でちょうど .5」になるケース。期待値は本家実測で確認済みの規則から):

| ケース(miniの基礎値) | 正 | miniの現状 |
|---|---|---|
| spearman・javelin(6) 日中 | 7 | 8 |
| bowman・bow(6) 日中 | 7 | 8 |
| cavalryman・sword(6) 日中 | 7 | 8 |
| orcish_grunt・sword(9)+strong 夜 | 12 | 13 |

ペナルティ側の .5(例: grunt+strong 日中 7.5→8)は両者一致するので変更後も値は変わらない。
注: miniの mage staff(6×2)と orcish_archer bow(8×3)は本家と違う独自値のため、
本家実測にあった同ユニットのケースはminiには当てはまらない(確認済み)。

## 修正1(必須): roundDamage の導入

対象: `packages/core-engine/src/combat.ts`。wesnoth-react-engineのコミット `7399b86` と同内容。

(1) `attackerOnlyDamage` の戻り値を積から部品に変える(丸めが総合倍率の向きを必要とするため):

```ts
): { base: number; alignMult: number } {
  const base = Math.max(1, attack.damage + traitDamageBonus(attack.range, attackerTraits));
  let alignMult = alignmentMultiplier(attackerDef.alignment, timeOfDay);
  if (hasTrait(attackerTraits, "fearless") && alignMult < 1) alignMult = 1;
  return { base, alignMult };
}
```

(2) 直後に `roundDamage` を追加:

```ts
// ダメージの丸め(本家1.18のround_damage準拠。2026-07-14 Reddit報告の調査で判明):
// .5ちょうどのときは「基礎値側へ寄せる」= ボーナス(総合倍率>1)は切り捨て・
// ペナルティ(<1)は切り上げ。それ以外は通常の四捨五入。
// 本家は整数演算だが、こちらは倍率を浮動小数で合成しているため.5ちょうどを
// epsilonで判定する(倍率は1.25/0.75/2/0.5/(100-耐性)/100の積なので十分内側に入る)
function roundDamage(raw: number, totalMult: number): number {
  const frac = raw - Math.floor(raw);
  const isHalf = Math.abs(frac - 0.5) < 1e-9;
  const rounded = isHalf
    ? totalMult > 1
      ? Math.floor(raw)
      : Math.ceil(raw)
    : Math.round(raw);
  return Math.max(1, rounded);
}
```

(3) `strikeDamage` の末尾を置換:

```ts
  const { base, alignMult } = attackerOnlyDamage(
    attack, attackerDef, timeOfDay, opts?.attackerTraits ?? []);
  const totalMult =
    alignMult *
    (opts?.leadership ? 1.25 : 1) *
    ((100 - resistance) / 100) *
    (opts?.multiplier ?? 1);
  return roundDamage(base * totalMult, totalMult);
```

(4) `displayDamage` の末尾を置換:

```ts
  const { base, alignMult } = attackerOnlyDamage(
    attack, attackerDef, timeOfDay, opts?.attackerTraits ?? []);
  const totalMult = alignMult * (opts?.leadership ? 1.25 : 1) * (opts?.slowed ? 0.5 : 1);
  return roundDamage(base * totalMult, totalMult);
```

## 修正2(必須): 実測をテストに固定

`packages/core-engine/test/damageRounding.test.ts` を新規作成。miniのロスターに全ユニットが
存在することは確認済み。時間帯のidが `afternoon` / `second_watch` であることだけ最初に確認する
(違う場合は日中=秩序+25%側・夜=混沌+25%側のidへ読み替え):

```ts
// ダメージ丸め規則(本家1.18 round_damage準拠)の実測固定(2026-07-14)。
// 期待値の出典: 本家Wesnoth 1.18のゲーム画面実測(wesnoth-react-engine/docs/damage_wesnoth.md)。
// Redditフィードバック「計算値のバグ」の修正
import { describe, expect, it } from "vitest";
import { displayDamage, getUnitDef, TIME_OF_DAY_DEFS } from "../src";
import type { TimeOfDayDef, TraitId } from "../src/types";

const day = TIME_OF_DAY_DEFS.afternoon;
const night = TIME_OF_DAY_DEFS.second_watch;

function dmg(unitId: string, attackId: string, tod: TimeOfDayDef, traits: TraitId[] = []): number {
  const def = getUnitDef(unitId);
  const attack = def.attacks.find((a) => a.id === attackId)!;
  return displayDamage(attack, def, tod, { attackerTraits: traits });
}

describe("ダメージ丸め(本家round_damage準拠)", () => {
  it("強力は倍率の前に基礎値へ+1する(騎兵の実測 7(9)x3 で確定)", () => {
    expect(dmg("cavalryman", "sword", day, ["strong"])).toBe(9); // 「倍率後に+1」なら8になる
  });
  it("ボーナス×1.25の.5ちょうどは切り捨て(基礎値側へ)", () => {
    expect(dmg("spearman", "javelin", day)).toBe(7); // 6: 7.5→7
    expect(dmg("bowman", "bow", day)).toBe(7); // 6: 7.5→7
    expect(dmg("cavalryman", "sword", day)).toBe(7); // 6: 7.5→7
    expect(dmg("orcish_grunt", "sword", night, ["strong"])).toBe(12); // 9+1=10: 12.5→12
  });
  it("ペナルティ×0.75の.5ちょうどは切り上げ(基礎値側へ)", () => {
    expect(dmg("spearman", "javelin", night)).toBe(5); // 6: 4.5→5
    expect(dmg("orcish_grunt", "sword", day, ["strong"])).toBe(8); // 10: 7.5→8
  });
  it(".5でない端数は通常の四捨五入", () => {
    expect(dmg("spearman", "spear", day)).toBe(9); // 7: 8.75→9
    expect(dmg("troll_whelp", "fist", night)).toBe(9); // 7: 8.75→9
  });
});
```

注意: 上のattack idと基礎値は**miniの実データで確認済み**(javelin=6, bowman bow=6,
cavalryman sword=6, grunt sword=9, troll fist=7)。時間帯idだけ最初に確認すること。

検算式: `期待値 = round_half_toward_base(基礎値(+strongなら+1) × 1.25 or 0.75)`。
.5ちょうどのときだけ「×1.25なら切り捨て/×0.75なら切り上げ」、他は四捨五入。

## 修正3(推奨): bowman を本家1.18値に是正

miniの `bowman` は melee 4×2 / maxXp 39 になっているはず(旧DB=1.16以前の値)。
本家は **1.17開発期のリバランス(wesnoth/wesnoth PR#7788「Balance for Loyalists 1.18」、
Hejnewar、2023-07-15マージ)** で melee 4→5・xp 39→35 に変更済み。1.16→1.18のcfg差分は
この2点のみ。miniが1.18準拠を維持するなら合わせる(maxXp=39を固定しているテストがあれば
35に追従させる)。独立リポジトリとしてあえて旧値を残す判断も可 — その場合はデータに
「1.16値を意図的に維持」とコメントを残すこと。

## やらないこと

- **強力(strong)の適用順は変更しない**。「基礎値に+1してから倍率」が本家準拠で正しいことを
  決定実験(強力持ち騎兵が日中 9 を表示。「倍率後+1」なら8になるはず)で確定済み。
  現実装のままでよい — 上のテストがこの順序も固定する
- 本家のC++コードをコピーしない(No License方針。上のroundDamageは自作実装で、
  挙動の一致だけを実測で確認している)

## 手順とバランス影響

1. テストを先に追加して**現状で落ちること**を確認(ボーナス側.5の4ケースが8/8/8/13になって落ちる。他のケースは修正前後で不変=回帰ガード)
2. 修正1を適用 → 全テスト(`npm run test -w @parle-stroika/core-engine`)+typecheck
3. 既存テストにボーナス側.5の期待値を固定しているものがあれば、本家実測に合わせて更新
4. 影響範囲は「×1.25等でちょうど.5になる組み合わせ」限定(1点減る方向)。
   CPU戦の体感バランスへの影響は軽微だが、変更ログには「本家準拠への是正」と明記する

## Reddit返答の材料(英語での要点)

> You were right — thanks for the report. Our damage rounding used plain round-half-up,
> but mainline Wesnoth's `round_damage` rounds exact halves *toward the base damage*
> (bonuses round down, penalties round up). So attacks like a 6-damage bow at day showed
> 8 instead of 7. Fixed and locked with tests against values measured in Wesnoth 1.18.

## 出典

- 実測: wesnoth-react-engine `docs/damage_wesnoth.md`(本家1.18画面から取得。騎兵の決定実験含む)
- 本家実装: wesnoth/wesnoth `1.18` の round_damage(整数演算 — ボーナス時 `+divisor/2-1`・
  ペナルティ時 `+divisor/2` してfloor)
- bowman変更の経緯: PR https://github.com/wesnoth/wesnoth/pull/7788 /
  フォーラム https://forums.wesnoth.org/viewtopic.php?t=56867 (2023-04 提案時はxp変更のみ、
  最終PRでxp緩和+melee+1)
- 参照実装: wesnoth-react-engine コミット `7399b86`(roundDamage)・`d367c36`(bowman)
