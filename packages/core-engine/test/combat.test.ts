import { describe, expect, it } from "vitest";
import {
  chooseRetaliation,
  displayDamage,
  hasRemainingAction,
  hitChanceAgainst,
  predictCombat,
  resolveCombat,
  strikeDamage,
  type CombatContext,
} from "../src/combat";
import { getUnitDef } from "../src/data/factions";
import { terrainById } from "../src/data/terrain";
import { TIME_OF_DAY_DEFS } from "../src/timeOfDay";
import type { UnitState } from "../src/types";
import { patchUnitDef } from "./defPatch";

function makeUnit(id: string, owner: number, unitDefId: string): UnitState {
  const def = getUnitDef(unitDefId);
  return {
    id,
    unitDefId,
    owner,
    pos: { x: 0, y: 0 },
    hp: def.hp,
    maxHp: def.hp,
    movesLeft: def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: false,
    traits: [],
    poisoned: false,
    xp: 0,
  };
}

describe("hitChanceAgainst", () => {
  it("命中率 = 100 - 防御側地形の防御率(DefenseType別)", () => {
    // walk: 草原40% → 命中率60%、森50% → 命中率50%
    expect(hitChanceAgainst(terrainById("grassland"), "walk")).toBeCloseTo(0.6);
    expect(hitChanceAgainst(terrainById("forest"), "walk")).toBeCloseTo(0.5);
    // fly: 本家準拠で地形をほぼ無視(全地形フラット50% → 命中率50%)
    expect(hitChanceAgainst(terrainById("grassland"), "fly")).toBeCloseTo(0.5);
    expect(hitChanceAgainst(terrainById("forest"), "fly")).toBeCloseTo(0.5);
    // swim: 浅瀬60% → 命中率40%、草原(陸に這い上がる本家仕様)30% → 命中率70%
    expect(hitChanceAgainst(terrainById("shallow_water"), "swim")).toBeCloseTo(0.4);
    expect(hitChanceAgainst(terrainById("grassland"), "swim")).toBeCloseTo(0.7);
    // cavalry: 森30%(本家mounted準拠のユーザー実測) → 命中率70%、村40% → 命中率60%
    expect(hitChanceAgainst(terrainById("forest"), "cavalry")).toBeCloseTo(0.7);
    expect(hitChanceAgainst(terrainById("village"), "cavalry")).toBeCloseTo(0.6);
  });

  it("cavalrymanはdefenseType=cavalryで防御率が参照される", () => {
    const cavalryman = getUnitDef("cavalryman");
    const attacker = getUnitDef("spearman");
    // 村: walk=60% → 命中率40%、cavalry=40% → 命中率60%
    expect(cavalryman.defenseType).toBe("cavalry");
    expect(hitChanceAgainst(terrainById("village"), cavalryman.defenseType!)).toBeCloseTo(0.6);
    expect(hitChanceAgainst(terrainById("village"), "walk")).toBeCloseTo(0.4);
    void attacker;
  });

  it("defenseOverride指定時は地形表より優先される", () => {
    // 森は本来walk=50% → 命中率50%だが、個別上書き80%なら命中率20%になる
    expect(hitChanceAgainst(terrainById("forest"), "walk", undefined, 80)).toBeCloseTo(0.2);
  });

  it("野生(feral)の村50%キャップはdefenseOverride指定時にも適用される", () => {
    // 村は上書きで90%を指定しても、野生特性のキャップで50%に制限される → 命中率50%
    expect(hitChanceAgainst(terrainById("village"), "walk", ["feral"], 90)).toBeCloseTo(0.5);
  });
});

describe("UnitDef.defenseOverrides(地形ごとの防御率個別上書き)", () => {
  it("movement.terrainOverridesの防御版として、predictCombat経由でも反映される", () => {
    const restore = patchUnitDef("spearman", (def) => {
      // 竜種を想定した架空の上書き: 森でも姿勢を保ち防御90%(本来のwalk=50%より大幅に固い)
      def.defenseOverrides = { forest: 90 };
    });
    try {
      const spearman = getUnitDef("spearman");
      const orc = getUnitDef("orcish_grunt");
      const p = predictCombat({
        attacker: makeUnit("a", 1, "orcish_grunt"),
        attackerDef: orc,
        defender: makeUnit("d", 0, "spearman"),
        defenderDef: spearman,
        attack: orc.attacks[0],
        attackerTerrain: terrainById("grassland"),
        defenderTerrain: terrainById("forest"),
        timeOfDay: TIME_OF_DAY_DEFS.dawn,
      });
      expect(p.hitChance).toBeCloseTo(0.1); // 100-90=10%
    } finally {
      restore();
    }
  });

  it("軽装(lightfoot。本家elusivefoot準拠)は森で通常walkより堅い(70% vs 50%)", () => {
    const nightblade = getUnitDef("orcish_nightblade");
    expect(nightblade.defenseType).toBe("lightfoot");
    expect(hitChanceAgainst(terrainById("forest"), nightblade.defenseType!)).toBeCloseTo(0.3); // 100-70
    expect(hitChanceAgainst(terrainById("forest"), "walk")).toBeCloseTo(0.5); // 通常walkの50%
  });
});

describe("strikeDamage", () => {
  const spearman = getUnitDef("spearman"); // lawful, 槍 7x3 pierce
  const skeleton = getUnitDef("skeleton"); // chaotic, pierce耐性60
  const spear = spearman.attacks[0];

  it("耐性でダメージが減る(切り捨てではなく四捨五入)", () => {
    // 7 × (100-60)/100 = 2.8 → 3
    expect(strikeDamage(spear, spearman, skeleton, TIME_OF_DAY_DEFS.dawn)).toBe(3);
  });

  it("lawfulは朝に+25%", () => {
    const target = getUnitDef("walking_corpse"); // pierce耐性なし
    // 7 × 1.25 = 8.75 → 9
    expect(strikeDamage(spear, spearman, target, TIME_OF_DAY_DEFS.morning)).toBe(9);
  });

  it("chaoticは朝に-25%", () => {
    const axe = skeleton.attacks[0]; // 7x3 blade
    const target = getUnitDef("spearman");
    // 7 × 0.75 = 5.25 → 5
    expect(strikeDamage(axe, skeleton, target, TIME_OF_DAY_DEFS.morning)).toBe(5);
  });

  it("最低ダメージは1", () => {
    const ghost = getUnitDef("ghost"); // blade耐性50
    const bat = getUnitDef("vampire_bat");
    const fangs = bat.attacks[0]; // 4x2 blade, chaotic
    // 朝: 4 × 0.75 × 0.5 = 1.5 → 2、では1にならないので cold 70%耐性で検証
    const wail = ghost.attacks[1]; // 3x3 cold
    const enemyGhost = getUnitDef("ghost"); // cold耐性70
    // 朝(chaotic -25%): 3 × 0.75 × 0.3 = 0.675 → round 1 → 1
    expect(strikeDamage(wail, ghost, enemyGhost, TIME_OF_DAY_DEFS.morning)).toBe(1);
    void fangs;
  });
});

describe("displayDamage", () => {
  const spearman = getUnitDef("spearman"); // lawful, 槍 7x3 pierce
  const skeleton = getUnitDef("skeleton"); // chaotic, 斧 7x3 blade
  const spear = spearman.attacks[0];
  const axe = skeleton.attacks[0];

  it("時間帯補正なし(夜明け)は基礎値のまま", () => {
    expect(displayDamage(spear, spearman, TIME_OF_DAY_DEFS.dawn)).toBe(7);
  });

  it("lawfulは朝に+25%(strikeDamageの耐性抜きと同じ値)", () => {
    // 7 × 1.25 = 8.75 → 9
    expect(displayDamage(spear, spearman, TIME_OF_DAY_DEFS.morning)).toBe(9);
  });

  it("chaoticは朝に-25%", () => {
    // 7 × 0.75 = 5.25 → 5
    expect(displayDamage(axe, skeleton, TIME_OF_DAY_DEFS.morning)).toBe(5);
  });

  it("勇敢は不利な時間帯補正を無効化する", () => {
    expect(
      displayDamage(axe, skeleton, TIME_OF_DAY_DEFS.morning, { attackerTraits: ["fearless"] }),
    ).toBe(7);
  });

  it("統率(隣接の統率持ち味方)で+25%", () => {
    expect(displayDamage(spear, spearman, TIME_OF_DAY_DEFS.dawn, { leadership: true })).toBe(9); // 7×1.25=8.75→9
  });

  it("遅化で半減", () => {
    expect(displayDamage(spear, spearman, TIME_OF_DAY_DEFS.dawn, { slowed: true })).toBe(4); // 7×0.5=3.5→4
  });

  it("統率と遅化は重ねて適用される", () => {
    // 7 × 1.25 × 0.5 = 4.375 → 4
    expect(
      displayDamage(spear, spearman, TIME_OF_DAY_DEFS.dawn, { leadership: true, slowed: true }),
    ).toBe(4);
  });

  it("特性の攻撃力補正(強力等)も反映する", () => {
    // (7+1) × 1.25 = 10
    expect(
      displayDamage(spear, spearman, TIME_OF_DAY_DEFS.morning, { attackerTraits: ["strong"] }),
    ).toBe(10);
  });

  it("最低ダメージは1", () => {
    const ghost = getUnitDef("ghost"); // chaotic
    const wail = ghost.attacks[1]; // 3x3 cold
    // 朝(chaotic -25%)かつ遅化: 3 × 0.75 × 0.5 = 1.125 → round 1 → 1
    expect(displayDamage(wail, ghost, TIME_OF_DAY_DEFS.morning, { slowed: true })).toBe(1);
  });
});

describe("hasRemainingAction", () => {
  it("移動力が残っていれば行動可能", () => {
    const a = makeUnit("a", 0, "spearman");
    expect(hasRemainingAction(a, [a])).toBe(true);
  });

  it("移動力・攻撃回数とも0なら行動不能", () => {
    const a = makeUnit("a", 0, "spearman");
    a.movesLeft = 0;
    a.attacksLeft = 0;
    expect(hasRemainingAction(a, [a])).toBe(false);
  });

  it("村占領直後(movesLeft=0)でも隣に敵がいれば攻撃回数ぶん行動可能", () => {
    const a = makeUnit("a", 0, "spearman");
    a.movesLeft = 0;
    a.pos = { x: 5, y: 5 };
    const enemy = makeUnit("e", 1, "skeleton");
    enemy.pos = { x: 6, y: 5 }; // 隣接
    expect(hasRemainingAction(a, [a, enemy])).toBe(true);
  });

  it("村占領直後(movesLeft=0)で隣に敵がいなければ攻撃回数が残っていても行動不能", () => {
    const a = makeUnit("a", 0, "spearman");
    a.movesLeft = 0;
    a.pos = { x: 5, y: 5 };
    const enemy = makeUnit("e", 1, "skeleton");
    enemy.pos = { x: 9, y: 9 }; // 隣接していない
    expect(hasRemainingAction(a, [a, enemy])).toBe(false);
  });

  it("隣にいても倒れている(hp<=0)敵はカウントしない", () => {
    const a = makeUnit("a", 0, "spearman");
    a.movesLeft = 0;
    a.pos = { x: 5, y: 5 };
    const deadEnemy = makeUnit("e", 1, "skeleton");
    deadEnemy.pos = { x: 6, y: 5 };
    deadEnemy.hp = 0;
    expect(hasRemainingAction(a, [a, deadEnemy])).toBe(false);
  });

  it("味方が隣にいても行動不能判定には影響しない", () => {
    const a = makeUnit("a", 0, "spearman");
    a.movesLeft = 0;
    a.pos = { x: 5, y: 5 };
    const ally = makeUnit("f", 0, "bowman");
    ally.pos = { x: 6, y: 5 };
    expect(hasRemainingAction(a, [a, ally])).toBe(false);
  });
});

describe("chooseRetaliation", () => {
  it("同レンジの攻撃がなければ反撃なし", () => {
    const skeleton = getUnitDef("skeleton"); // meleeのみ
    const bowman = getUnitDef("bowman");
    expect(chooseRetaliation(skeleton, bowman, "ranged", TIME_OF_DAY_DEFS.dawn)).toBeNull();
  });

  it("同レンジで期待ダメージ最大の攻撃を選ぶ", () => {
    const lieutenant = getUnitDef("lieutenant"); // 剣8x3 / クロスボウ6x3
    const grunt = getUnitDef("orcish_grunt");
    const melee = chooseRetaliation(lieutenant, grunt, "melee", TIME_OF_DAY_DEFS.dawn);
    expect(melee?.attack.name).toBe("剣");
  });
});

function makeCombatCtx(overrides?: Partial<CombatContext>): CombatContext {
  const attacker = makeUnit("a", 0, "spearman");
  const defender = makeUnit("d", 1, "walking_corpse");
  return {
    attacker,
    attackerDef: getUnitDef("spearman"),
    defender,
    defenderDef: getUnitDef("walking_corpse"),
    attack: getUnitDef("spearman").attacks[0], // 槍 7x3
    attackerTerrain: terrainById("grassland"),
    defenderTerrain: terrainById("grassland"),
    timeOfDay: TIME_OF_DAY_DEFS.dawn,
    ...overrides,
  };
}

describe("predictCombat", () => {
  it("期待値 = 命中率 × 1打ダメージ × 回数", () => {
    const p = predictCombat(makeCombatCtx());
    expect(p.hitChance).toBeCloseTo(0.6);
    expect(p.damagePerStrike).toBe(7);
    expect(p.expectedDamageDealt).toBeCloseTo(0.6 * 7 * 3);
    // 歩く死体は接触4x3 impactで反撃
    expect(p.retaliation).not.toBeNull();
    expect(p.expectedDamageTaken).toBeCloseTo(0.6 * 4 * 3);
  });

  it("遠隔攻撃に遠隔手段のない相手からは反撃を受けない", () => {
    const bowman = getUnitDef("bowman");
    const p = predictCombat(
      makeCombatCtx({
        attackerDef: bowman,
        attack: bowman.attacks[1], // 弓 6x3 ranged
      }),
    );
    expect(p.retaliation).toBeNull();
    expect(p.expectedDamageTaken).toBe(0);
  });
});

describe("resolveCombat", () => {
  it("rng=0(全弾命中)で交互に打ち合い、死亡時点で打ち切る", () => {
    const result = resolveCombat(makeCombatCtx(), () => 0);
    // 歩く死体 HP18: 7×3打で3打目に0。反撃(4x3)は3打目の前までに2回入る
    expect(result.defenderHpAfter).toBe(0);
    expect(result.defenderDied).toBe(true);
    expect(result.attackerHpAfter).toBe(36 - 8);
    const attackerStrikes = result.strikes.filter((s) => s.actor === "attacker");
    expect(attackerStrikes).toHaveLength(3);
  });

  it("rng=0.99(全弾回避)でダメージなし", () => {
    const result = resolveCombat(makeCombatCtx(), () => 0.99);
    expect(result.attackerHpAfter).toBe(36);
    expect(result.defenderHpAfter).toBe(18);
    expect(result.strikes.every((s) => !s.hit)).toBe(true);
  });
});
