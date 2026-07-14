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
