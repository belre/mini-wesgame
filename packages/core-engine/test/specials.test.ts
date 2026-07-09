import { describe, expect, it } from "vitest";
import {
  isBackstab,
  predictCombat,
  resolveCombat,
  type CombatContext,
} from "../src/combat";
import { getUnitDef } from "../src/data/factions";
import { terrainById } from "../src/data/terrain";
import { TIME_OF_DAY_DEFS } from "../src/timeOfDay";
import type { TraitId, UnitState } from "../src/types";
import { patchUnitDef } from "./defPatch";

function makeUnit(
  id: string,
  owner: number,
  unitDefId: string,
  opts?: {
    pos?: { x: number; y: number };
    traits?: TraitId[];
    hp?: number;
    slowed?: boolean;
  },
): UnitState {
  const def = getUnitDef(unitDefId);
  return {
    id,
    unitDefId,
    owner,
    pos: opts?.pos ?? { x: 0, y: 0 },
    hp: opts?.hp ?? def.hp,
    maxHp: def.hp,
    movesLeft: def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: false,
    traits: opts?.traits ?? [],
    poisoned: false,
    slowed: opts?.slowed,
    xp: 0,
  };
}

function ctx(
  attacker: UnitState,
  attackIndex: number,
  defender: UnitState,
  extra?: Partial<CombatContext>,
): CombatContext {
  return {
    attacker,
    attackerDef: getUnitDef(attacker.unitDefId),
    defender,
    defenderDef: getUnitDef(defender.unitDefId),
    attack: getUnitDef(attacker.unitDefId).attacks[attackIndex],
    attackerTerrain: terrainById("grassland"),
    defenderTerrain: terrainById("grassland"),
    timeOfDay: TIME_OF_DAY_DEFS.dawn,
    ...extra,
  };
}

describe("魔法(magical)", () => {
  it("地形に関わらず命中率70%", () => {
    const mage = makeUnit("a", 0, "mage");
    const target = makeUnit("d", 1, "spearman");
    const p = predictCombat(
      ctx(mage, 1, target, { defenderTerrain: terrainById("forest") }), // 森=防御50
    );
    expect(p.hitChance).toBe(0.7);
  });
});

describe("毒針(poison_sting = 精密+毒の複合)", () => {
  it("攻撃時の命中率は最低60%(精密の効果)", () => {
    const assassin = makeUnit("a", 0, "orcish_assassin");
    const target = makeUnit("d", 1, "spearman");
    const p = predictCombat(
      ctx(assassin, 1, target, { defenderTerrain: terrainById("forest") }), // 通常なら50%
    );
    expect(p.hitChance).toBe(0.6);
  });

  it("地形の命中率が60%を超えるならそのまま", () => {
    const assassin = makeUnit("a", 0, "orcish_assassin");
    const target = makeUnit("d", 1, "spearman");
    const p = predictCombat(
      ctx(assassin, 1, target, { defenderTerrain: terrainById("shallow_water") }), // 防御20 → 80%
    );
    expect(p.hitChance).toBeCloseTo(0.8);
  });

  it("命中で毒状態になる(毒の効果)", () => {
    const assassin = makeUnit("a", 0, "orcish_assassin");
    const target = makeUnit("d", 1, "spearman");
    const result = resolveCombat(ctx(assassin, 1, target), () => 0);
    expect(result.defenderPoisoned).toBe(true);
  });

  it("毒の部分はアンデッド特性には無効", () => {
    const assassin = makeUnit("a", 0, "orcish_assassin");
    const skeleton = makeUnit("d", 1, "orcish_grunt", { traits: ["undead"] });
    const result = resolveCombat(ctx(assassin, 1, skeleton), () => 0);
    expect(result.defenderPoisoned).toBe(false);
  });
});

describe("精密(marksman)単体", () => {
  it("エンジンのルールとして残っている(現ロースターでは毒針経由でのみ使用)", () => {
    const restore = patchUnitDef("bowman", (def) => {
      def.attacks = [
        { id: "bow", name: "弓", damage: 6, count: 3, type: "pierce", range: "ranged", specials: ["marksman"] },
      ];
    });
    try {
      const bowman = makeUnit("a", 0, "bowman");
      const target = makeUnit("d", 1, "spearman");
      const p = predictCombat(
        ctx(bowman, 0, target, { defenderTerrain: terrainById("forest") }), // 通常なら50%
      );
      expect(p.hitChance).toBe(0.6);
    } finally {
      restore();
    }
  });
});

describe("突撃(charge)", () => {
  it("与ダメージも被ダメージも2倍", () => {
    const horseman = makeUnit("a", 0, "horseman");
    const target = makeUnit("d", 1, "orcish_grunt"); // 剣9x2で反撃
    const p = predictCombat(ctx(horseman, 0, target));
    // ランス9(pierce) × 突撃2倍 = 18(orcish_gruntはpierce耐性なし)
    expect(p.damagePerStrike).toBe(18);
    // 反撃の剣9(blade) × 突撃2倍 = 18、horsemanのblade耐性20%適用 → floor(18 × 0.8) = 14
    expect(p.retaliation?.damagePerStrike).toBe(14);
  });
});

describe("奇襲(backstab)", () => {
  const attacker = makeUnit("a", 0, "thief", { pos: { x: 4, y: 5 } });
  const defender = makeUnit("d", 1, "spearman", { pos: { x: 5, y: 5 } });

  it("反対側に防御側の敵がいるとダメージ2倍", () => {
    const ally = makeUnit("x", 0, "spearman", { pos: { x: 6, y: 6 } }); // (5,5)を挟んで反対側
    expect(isBackstab(attacker, defender, [attacker, defender, ally])).toBe(true);
    const p = predictCombat(
      ctx(attacker, 0, defender, { units: [attacker, defender, ally] }),
    );
    expect(p.backstab).toBe(true);
    expect(p.damagePerStrike).toBe(8); // 短剣4 × 2
  });

  it("反対側が空きなら通常ダメージ", () => {
    expect(isBackstab(attacker, defender, [attacker, defender])).toBe(false);
    const p = predictCombat(
      ctx(attacker, 0, defender, { units: [attacker, defender] }),
    );
    expect(p.backstab).toBe(false);
    expect(p.damagePerStrike).toBe(4);
  });

  it("反対側が防御側の味方なら成立しない", () => {
    const defAlly = makeUnit("y", 1, "spearman", { pos: { x: 6, y: 6 } });
    expect(isBackstab(attacker, defender, [attacker, defender, defAlly])).toBe(false);
  });
});

describe("先制(firststrike)", () => {
  it("防御側の槍兵が先に打つ", () => {
    const grunt = makeUnit("a", 0, "orcish_grunt");
    const spearman = makeUnit("d", 1, "spearman"); // 槍=先制
    const result = resolveCombat(ctx(grunt, 0, spearman), () => 0);
    expect(result.strikes[0].actor).toBe("defender");
  });

  it("攻撃側も先制持ちなら通常順", () => {
    const a = makeUnit("a", 0, "spearman");
    const d = makeUnit("d", 1, "spearman");
    const result = resolveCombat(ctx(a, 0, d), () => 0);
    expect(result.strikes[0].actor).toBe("attacker");
  });
});

describe("生命吸収(drain)", () => {
  // mini: 担い手(コウモリ系)が陣営削減で消えたため、狼の牙にdrainをpatchして
  // ルール自体を検証する(defPatchの前例に従う)
  const drainFangs = () =>
    patchUnitDef("wolf_rider", (def) => {
      def.attacks = [
        { id: "fangs", name: "牙", damage: 4, count: 3, type: "blade", range: "melee", specials: ["drain"] },
      ];
    });

  it("与ダメージの半分回復する", () => {
    const restore = drainFangs();
    try {
      const bat = makeUnit("a", 0, "wolf_rider", { hp: 10 });
      const target = makeUnit("d", 1, "orcish_grunt"); // 剣9x2で反撃してくる
      const result = resolveCombat(ctx(bat, 0, target), () => 0);
      const firstStrike = result.strikes.find((s) => s.actor === "attacker");
      // 牙4(dawn補正なし) → 吸収2
      expect(firstStrike?.drained).toBe(2);
    } finally {
      restore();
    }
  });

  it("アンデッド特性には無効", () => {
    const restore = drainFangs();
    try {
      const bat = makeUnit("a", 0, "wolf_rider", { hp: 10 });
      const skeleton = makeUnit("d", 1, "orcish_grunt", { traits: ["undead"] });
      const result = resolveCombat(ctx(bat, 0, skeleton), () => 0);
      expect(result.strikes.every((s) => s.drained === undefined)).toBe(true);
    } finally {
      restore();
    }
  });
});

describe("毒(poison)", () => {
  it("命中で毒状態になる", () => {
    const ghoul = makeUnit("a", 0, "orcish_assassin", { traits: ["undead"] });
    const target = makeUnit("d", 1, "spearman");
    const result = resolveCombat(ctx(ghoul, 1, target), () => 0); // 投げナイフ(poison_sting)
    expect(result.defenderPoisoned).toBe(true);
  });

  it("アンデッド特性には無効", () => {
    const ghoul = makeUnit("a", 0, "orcish_assassin", { traits: ["undead"] });
    const skeleton = makeUnit("d", 1, "orcish_grunt", { traits: ["undead"] });
    const result = resolveCombat(ctx(ghoul, 1, skeleton), () => 0);
    expect(result.defenderPoisoned).toBe(false);
  });

  it("全弾回避なら毒にならない", () => {
    const ghoul = makeUnit("a", 0, "orcish_assassin", { traits: ["undead"] });
    const target = makeUnit("d", 1, "spearman");
    const result = resolveCombat(ctx(ghoul, 1, target), () => 0.99);
    expect(result.defenderPoisoned).toBe(false);
  });
});

describe("遅化(slow)", () => {
  it("命中で鈍化状態になる(オークの狼乗りの網)", () => {
    const pillager = makeUnit("a", 0, "orcish_pillager");
    const target = makeUnit("d", 1, "spearman");
    const result = resolveCombat(ctx(pillager, 2, target), () => 0); // 網(index2, slow)
    expect(result.defenderSlowed).toBe(true);
  });

  it("全弾回避なら鈍化しない", () => {
    const pillager = makeUnit("a", 0, "orcish_pillager");
    const target = makeUnit("d", 1, "spearman");
    const result = resolveCombat(ctx(pillager, 2, target), () => 0.99);
    expect(result.defenderSlowed).toBe(false);
  });

  it("遅化状態の攻撃側は自分の攻撃ダメージが半減する(端数は四捨五入)", () => {
    const attacker = makeUnit("a", 0, "spearman", { slowed: true });
    const target = makeUnit("d", 1, "orcish_grunt");
    const p = predictCombat(ctx(attacker, 0, target));
    // 槍7 × 0.5 = 3.5 → round → 4(遅化してない場合は7)
    expect(p.damagePerStrike).toBe(4);
  });

  it("遅化状態の防御側は反撃ダメージが半減する", () => {
    const attacker = makeUnit("a", 0, "orcish_grunt");
    const target = makeUnit("d", 1, "spearman", { slowed: true });
    const p = predictCombat(ctx(attacker, 0, target));
    // 反撃(槍7) × 0.5 = 3.5 → round → 4(遅化してない場合は7)
    expect(p.retaliation?.damagePerStrike).toBe(4);
  });
});

describe("狂戦(berserk)", () => {
  it("どちらかが倒れるまでラウンドを繰り返す", () => {
    // 現ロースターにberserk持ちがいない(knalganのドワーフ狂戦士が無効化中)ため、
    // thiefの攻撃を狂乱4x4に一時パッチしてルール自体を検証する
    const restore = patchUnitDef("thief", (def) => {
      def.attacks = [
        { id: "frenzy", name: "狂乱", damage: 4, count: 4, type: "blade", range: "melee", specials: ["berserk"] },
      ];
    });
    // 的も反撃なし・HP18にpatch(旧walking_corpse相当の条件を再現)
    const restoreTarget = patchUnitDef("orcish_grunt", (def) => {
      def.attacks = [];
    });
    try {
      const berserker = makeUnit("a", 0, "thief");
      const corpse = makeUnit("d", 1, "orcish_grunt", { hp: 18, traits: ["undead"] });
      const result = resolveCombat(ctx(berserker, 0, corpse), () => 0);
      // 狂乱4x4 vs HP18 → 1ラウンド(16)では倒れず、2ラウンド目で決着
      expect(result.rounds).toBe(2);
      expect(result.defenderDied).toBe(true);
    } finally {
      restore();
      restoreTarget();
    }
  });

  it("通常攻撃は1ラウンドのみ", () => {
    const grunt = makeUnit("a", 0, "orcish_grunt");
    const corpse = makeUnit("d", 1, "orcish_grunt", { traits: ["undead"] });
    const result = resolveCombat(ctx(grunt, 0, corpse), () => 0.99);
    expect(result.rounds).toBe(1);
  });
});

describe("勇敢(fearless)と野生(feral)", () => {
  it("勇敢: 不利な時間帯補正を受けない", () => {
    const ghoul = makeUnit("a", 0, "orcish_assassin", { traits: ["undead", "fearless"] });
    const target = makeUnit("d", 1, "spearman");
    // 朝はchaotic-25%だが勇敢なら短刀9のまま
    const p = predictCombat(
      ctx(ghoul, 0, target, { timeOfDay: TIME_OF_DAY_DEFS.morning }),
    );
    expect(p.damagePerStrike).toBe(9);
  });

  it("野生: 村の防御率が50%に制限される", () => {
    // vampire_bat は fly ユニット(村fly防御率40%<50%のためferalが効かない)。
    // walk ユニットで検証: 村のwalk防御率60% → feral制限で50% → 命中率50%
    const attacker = makeUnit("a", 0, "orcish_grunt");
    const defender = makeUnit("d", 1, "orcish_grunt", { traits: ["feral"] });
    const p = predictCombat(
      ctx(attacker, 0, defender, { defenderTerrain: terrainById("village") }),
    );
    expect(p.hitChance).toBeCloseTo(0.5); // walk:60% → feral制限50% → 命中率50%
  });
});
