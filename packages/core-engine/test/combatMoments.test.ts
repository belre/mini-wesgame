// カットイン演出の要約(combatMoments.ts summarizeCombatMoments)のテスト。
// 「何が起きているか」を表す配列を返す純関数 — 各タグの成立条件を個別に固定する
import { describe, expect, it } from "vitest";
import { summarizeCombatMoments, type CombatMomentContext } from "../src/combatMoments";
import { getUnitDef } from "../src/data/factions";
import { mapById, mapMeta } from "../src/data/maps";
import { TIME_OF_DAY_DEFS } from "../src/timeOfDay";
import type { AttackDef, TraitId, UnitState } from "../src/types";

const dawn = TIME_OF_DAY_DEFS.dawn; // alignmentModifier: {} なので秩序/混沌どちらも補正なし
const map = mapById("valley_crossing");

function makeUnit(
  id: string,
  owner: number,
  unitDefId: string,
  pos: { x: number; y: number },
  opts?: {
    hp?: number;
    poisoned?: boolean;
    slowed?: boolean;
    isLeader?: boolean;
    traits?: TraitId[];
  },
): UnitState {
  const def = getUnitDef(unitDefId);
  return {
    id,
    unitDefId,
    owner,
    pos,
    hp: opts?.hp ?? def.hp,
    maxHp: def.hp,
    movesLeft: def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: opts?.isLeader ?? false,
    traits: opts?.traits ?? [],
    poisoned: opts?.poisoned ?? false,
    slowed: opts?.slowed ?? false,
    xp: 0,
  };
}

const attackOf = (unitDefId: string, attackId: string): AttackDef =>
  getUnitDef(unitDefId).attacks.find((a) => a.id === attackId)!;

function ctx(overrides: Partial<CombatMomentContext>): CombatMomentContext {
  const attacker = overrides.attacker ?? makeUnit("a", 0, "spearman", { x: 8, y: 6 });
  const defender = overrides.defender ?? makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 });
  return {
    attacker,
    attackerDef: getUnitDef(attacker.unitDefId),
    defender,
    defenderDef: getUnitDef(defender.unitDefId),
    attack: overrides.attack ?? attackOf("spearman", "spear"),
    retaliationAttack: overrides.retaliationAttack ?? null,
    timeOfDay: dawn,
    units: overrides.units ?? [attacker, defender],
    map,
    ...overrides,
  };
}

describe("summarizeCombatMoments: 敵を倒しそう(相手=防御側のHPが低い)", () => {
  // 槍(dmg7×3, pierce)vs 戦士(耐性0) = 1発7ダメージ。max(3-1,1)=2発分=14が閾値
  it("防御側HPが閾値以下: 敵を倒しそうが立つ(反撃の脅威が無ければ倒されそうは立たない)", () => {
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 14 });
    const tags = summarizeCombatMoments(ctx({ defender }));
    expect(tags).toContain("closeToDefeatingEnemy");
    // 2026-07-09修正: 以前は同じ条件を共有していて両方同時に立つバグがあった。
    // 攻撃側HPが低いわけではない(反撃も無い)ので、こちらは立たないのが正しい
    expect(tags).not.toContain("closeToBeingDefeated");
  });

  it("防御側HPが閾値+1: 立たない", () => {
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 15 });
    const tags = summarizeCombatMoments(ctx({ defender }));
    expect(tags).not.toContain("closeToDefeatingEnemy");
  });

  it("単発攻撃(count=1)はN-1=0ではなく1発分を閾値に使う", () => {
    const javelin = attackOf("spearman", "javelin"); // dmg6, count1, pierce
    const atThreshold = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 6 });
    const aboveThreshold = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 7 });
    expect(summarizeCombatMoments(ctx({ attack: javelin, defender: atThreshold }))).toContain(
      "closeToDefeatingEnemy",
    );
    expect(
      summarizeCombatMoments(ctx({ attack: javelin, defender: aboveThreshold })),
    ).not.toContain("closeToDefeatingEnemy");
  });
});

describe("summarizeCombatMoments: 危険、倒されるかも(自分=攻撃側のHPが低い)", () => {
  const retaliation = attackOf("orcish_grunt", "sword"); // dmg9×2, blade, 攻撃側(spearman)耐性0

  it("攻撃側HPが反撃の致死圏以下: 立つ(防御側のHPは無関係)", () => {
    // 反撃1発9ダメージ、max(2-1,1)=1発=9が閾値
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 }, { hp: 9 });
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 38 }); // 満タン
    const tags = summarizeCombatMoments(
      ctx({ attacker, defender, retaliationAttack: retaliation, units: [attacker, defender] }),
    );
    expect(tags).toContain("closeToBeingDefeated");
    // 防御側は満タンなので敵を倒しそうは立たない
    expect(tags).not.toContain("closeToDefeatingEnemy");
  });

  it("攻撃側HPが致死圏+1: 立たない", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 }, { hp: 10 });
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 38 });
    const tags = summarizeCombatMoments(
      ctx({ attacker, defender, retaliationAttack: retaliation, units: [attacker, defender] }),
    );
    expect(tags).not.toContain("closeToBeingDefeated");
  });

  it("反撃不能(retaliationAttackなし)なら攻撃側HPが低くても立たない", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 }, { hp: 9 });
    const tags = summarizeCombatMoments(
      ctx({ attacker, retaliationAttack: null, units: [attacker] }),
    );
    expect(tags).not.toContain("closeToBeingDefeated");
  });
});

describe("summarizeCombatMoments: 死闘", () => {
  const retaliation = attackOf("orcish_grunt", "sword"); // dmg9×2, blade, 攻撃側(spearman)耐性0

  it("双方が致死圏かつ反撃可能なら死闘(敵を倒しそう/倒されそうも両方立つ)", () => {
    // 反撃1発9ダメージ、max(2-1,1)=1発=9が閾値
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 }, { hp: 9 });
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 14 });
    const tags = summarizeCombatMoments(
      ctx({ attacker, defender, retaliationAttack: retaliation, units: [attacker, defender] }),
    );
    expect(tags).toContain("desperateClash");
    expect(tags).toContain("closeToDefeatingEnemy");
    expect(tags).toContain("closeToBeingDefeated");
  });

  it("反撃側だけ致死圏(攻撃側は余裕)なら死闘にならない", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 }, { hp: 30 });
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 14 });
    const tags = summarizeCombatMoments(
      ctx({ attacker, defender, retaliationAttack: retaliation, units: [attacker, defender] }),
    );
    expect(tags).not.toContain("desperateClash");
  });

  it("反撃不能(retaliationAttackなし)なら双方致死圏でも死闘にならない", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 }, { hp: 9 });
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 14 });
    const tags = summarizeCombatMoments(
      ctx({ attacker, defender, retaliationAttack: null, units: [attacker, defender] }),
    );
    expect(tags).not.toContain("desperateClash");
  });
});

describe("summarizeCombatMoments: 攻撃側自身の状態", () => {
  it("毒状態で攻撃: poisonedAttacker", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 }, { poisoned: true });
    const tags = summarizeCombatMoments(ctx({ attacker, units: [attacker] }));
    expect(tags).toContain("poisonedAttacker");
  });

  it("遅化状態で攻撃: slowedAttacker", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 }, { slowed: true });
    const tags = summarizeCombatMoments(ctx({ attacker, units: [attacker] }));
    expect(tags).toContain("slowedAttacker");
  });

  it("通常状態ではどちらも立たない", () => {
    const tags = summarizeCombatMoments(ctx({}));
    expect(tags).not.toContain("poisonedAttacker");
    expect(tags).not.toContain("slowedAttacker");
  });
});

describe("summarizeCombatMoments: 攻撃の特殊効果", () => {
  const base = (specials: AttackDef["specials"]): AttackDef => ({
    id: "test-attack",
    name: "テスト攻撃",
    damage: 5,
    count: 2,
    type: "blade",
    range: "melee",
    specials,
  });

  it("疫病(plague): 攻撃側が使っても反撃側が使っても立つ", () => {
    expect(summarizeCombatMoments(ctx({ attack: base(["plague"]) }))).toContain("plagueAttack");
    expect(
      summarizeCombatMoments(
        ctx({ retaliationAttack: base(["plague"]), attack: attackOf("spearman", "spear") }),
      ),
    ).toContain("plagueAttack");
  });

  it("毒針(poison_sting): 攻撃側が使うときだけ立つ(反撃側が使っても立たない)", () => {
    expect(summarizeCombatMoments(ctx({ attack: base(["poison_sting"]) }))).toContain(
      "poisonStingAttack",
    );
    expect(
      summarizeCombatMoments(
        ctx({ retaliationAttack: base(["poison_sting"]), attack: attackOf("spearman", "spear") }),
      ),
    ).not.toContain("poisonStingAttack");
  });

  it("素の毒(poison。グールの爪など): 攻撃側/反撃側どちらでも立つ", () => {
    expect(summarizeCombatMoments(ctx({ attack: base(["poison"]) }))).toContain("poisonAttack");
    expect(
      summarizeCombatMoments(
        ctx({ retaliationAttack: base(["poison"]), attack: attackOf("spearman", "spear") }),
      ),
    ).toContain("poisonAttack");
  });

  it("毒(poison)と毒針(poison_sting)は別枠: 互いのタグを誤って立てない", () => {
    const plainPoison = summarizeCombatMoments(ctx({ attack: base(["poison"]) }));
    expect(plainPoison).toContain("poisonAttack");
    expect(plainPoison).not.toContain("poisonStingAttack");

    const sting = summarizeCombatMoments(ctx({ attack: base(["poison_sting"]) }));
    expect(sting).toContain("poisonStingAttack");
    expect(sting).not.toContain("poisonAttack");
  });

  it("遅化攻撃(slow): 攻撃側/反撃側どちらでも立つ", () => {
    expect(summarizeCombatMoments(ctx({ attack: base(["slow"]) }))).toContain("slowAttack");
    expect(
      summarizeCombatMoments(
        ctx({ retaliationAttack: base(["slow"]), attack: attackOf("spearman", "spear") }),
      ),
    ).toContain("slowAttack");
  });

  it("生命吸収(drain): 攻撃側/反撃側どちらでも立つ", () => {
    expect(summarizeCombatMoments(ctx({ attack: base(["drain"]) }))).toContain("drainAttack");
    expect(
      summarizeCombatMoments(
        ctx({ retaliationAttack: base(["drain"]), attack: attackOf("spearman", "spear") }),
      ),
    ).toContain("drainAttack");
  });
});

describe("summarizeCombatMoments: 統率", () => {
  it("攻撃側/防御側どちらかが統率の加護を受けていれば立つ", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 });
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 });
    const lieutenant = makeUnit("l", 0, "lieutenant", { x: 7, y: 6 }); // 攻撃側に隣接
    const tags = summarizeCombatMoments(
      ctx({ attacker, defender, units: [attacker, defender, lieutenant] }),
    );
    expect(tags).toContain("leadershipBlessing");
  });

  it("隣接する統率持ちがいなければ立たない", () => {
    const tags = summarizeCombatMoments(ctx({}));
    expect(tags).not.toContain("leadershipBlessing");
  });
});

describe("summarizeCombatMoments: リーダー", () => {
  const keep0 = mapMeta(map).keeps[0];

  it("防御側がリーダー: leaderUnderAttack", () => {
    const defender = makeUnit("d", 1, "lieutenant", { x: 8, y: 7 }, { isLeader: true });
    expect(summarizeCombatMoments(ctx({ defender }))).toContain("leaderUnderAttack");
  });

  it("攻撃側がリーダー: leaderAttacking", () => {
    const attacker = makeUnit("a", 0, "lieutenant", { x: 8, y: 6 }, { isLeader: true });
    expect(summarizeCombatMoments(ctx({ attacker }))).toContain("leaderAttacking");
  });

  it("参加リーダーが自軍の主城の近くにいれば leaderNearHome", () => {
    const attacker = makeUnit("a", 0, "lieutenant", keep0, { isLeader: true });
    const tags = summarizeCombatMoments(ctx({ attacker, units: [attacker] }));
    expect(tags).toContain("leaderNearHome");
  });

  it("主城から離れていれば leaderNearHome は立たない", () => {
    const attacker = makeUnit("a", 0, "lieutenant", { x: map.width - 1, y: map.height - 1 }, {
      isLeader: true,
    });
    const tags = summarizeCombatMoments(ctx({ attacker, units: [attacker] }));
    expect(tags).not.toContain("leaderNearHome");
  });

  it("リーダーが参加していない戦闘ではリーダー系タグは何も立たない", () => {
    const tags = summarizeCombatMoments(ctx({}));
    expect(tags).not.toContain("leaderUnderAttack");
    expect(tags).not.toContain("leaderAttacking");
    expect(tags).not.toContain("leaderNearHome");
  });
});
