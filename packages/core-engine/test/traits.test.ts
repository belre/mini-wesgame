import { describe, expect, it } from "vitest";
import { getUnitDef } from "../src/data/factions";
import { GOBLIN_TRAITS } from "../src/data/factions/traitPresets";
import type { UnitDef } from "../src/types";
import {
  assignTraits,
  effectiveTraits,
  traitDamageBonus,
  traitMaxHp,
  traitMoves,
} from "../src/traits";

describe("effectiveTraits(小物 no_zoc の暗黙付与)", () => {
  it("レベル0(ゾンビ・コウモリ)には小物が付く。元のtraits配列は変更しない", () => {
    const stored = ["undead"] as const;
    const result = effectiveTraits(getUnitDef("walking_corpse"), stored);
    expect(result).toContain("no_zoc");
    expect(stored).toEqual(["undead"]); // shallow copyで付加(保存値は不変)
    expect(effectiveTraits(getUnitDef("vampire_bat"), [])).toContain("no_zoc");
  });

  it("レベル1以上(昇級後のソウルレス・bloodbat)には付かない", () => {
    expect(effectiveTraits(getUnitDef("soulness"), ["undead"])).not.toContain("no_zoc");
    expect(effectiveTraits(getUnitDef("bloodbat"), [])).not.toContain("no_zoc");
  });
});

describe("assignTraits", () => {
  it("アンデッドは強制特性のみ", () => {
    expect(assignTraits(getUnitDef("skeleton"), () => 0)).toEqual(["undead"]);
  });

  it("人間はpoolから2つ(重複なし)", () => {
    // rng=0 で先頭から順に引く
    expect(assignTraits(getUnitDef("spearman"), () => 0)).toEqual([
      "strong",
      "intelligent",
    ]);
  });

  it("ゴブリンは凡愚・鈍重・非力から1つ", () => {
    // 現ロースターにGOBLIN_TRAITSを使うユニットがいないため、合成defで
    // プリセット自体の挙動を検証する(assignTraitsはdefを直接受け取る)
    const goblinDef: UnitDef = {
      id: "test_goblin",
      name: "テストゴブリン",
      level: 0,
      hp: 18,
      movement: { type: "walk", points: 5 },
      attacks: [{ id: "spear", name: "槍", damage: 4, count: 3, type: "pierce", range: "melee" }],
      resistances: {},
      alignment: "chaotic",
      cost: 9,
      spriteKey: "units/test/goblin",
      traitConfig: GOBLIN_TRAITS,
    };
    const traits = assignTraits(goblinDef, () => 0.99);
    expect(traits).toHaveLength(1);
    expect(["dim", "slow", "weak"]).toContain(traits[0]);
  });

  it("グールはアンデッド固定のみ(2026-07-08 ユーザー指定で勇敢はトロル専用に)", () => {
    expect(assignTraits(getUnitDef("ghoul"), () => 0)).toEqual(["undead"]);
  });

  it("トレント(traitConfig未指定)は特性なし", () => {
    expect(assignTraits(getUnitDef("treant"), () => 0)).toEqual([]);
  });
});

describe("traitMaxHp / traitMoves", () => {
  const spearman = getUnitDef("spearman"); // HP36 / 移動5 / Lv1

  it("強力: HP+1", () => {
    expect(traitMaxHp(spearman, ["strong"])).toBe(37);
  });

  it("頑強: HP+4+レベル", () => {
    expect(traitMaxHp(spearman, ["resilient"])).toBe(41);
  });

  it("敏捷: 移動+1 / HP-5%", () => {
    expect(traitMoves(spearman, ["quick"])).toBe(6);
    expect(traitMaxHp(spearman, ["quick"])).toBe(34); // 36×0.95=34.2→34
  });

  it("鈍重: 移動-1 / HP+5%", () => {
    expect(traitMoves(spearman, ["slow"])).toBe(4);
    expect(traitMaxHp(spearman, ["slow"])).toBe(38); // 36×1.05=37.8→38
  });

  it("非力: HP-1", () => {
    expect(traitMaxHp(spearman, ["weak"])).toBe(35);
  });

  it("壮健: HP+2", () => {
    expect(traitMaxHp(spearman, ["healthy"])).toBe(38);
  });
});

describe("traitDamageBonus", () => {
  it("強力は近接+1(遠隔は対象外)", () => {
    expect(traitDamageBonus("melee", ["strong"])).toBe(1);
    expect(traitDamageBonus("ranged", ["strong"])).toBe(0);
  });

  it("非力は近接-1", () => {
    expect(traitDamageBonus("melee", ["weak"])).toBe(-1);
  });

  it("器用は遠隔+1(近接は対象外)", () => {
    expect(traitDamageBonus("ranged", ["dextrous"])).toBe(1);
    expect(traitDamageBonus("melee", ["dextrous"])).toBe(0);
  });
});
