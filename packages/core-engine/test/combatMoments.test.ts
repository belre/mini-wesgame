// カットイン演出の要約(combatMoments.ts summarizeCombatMoments)のテスト。
// 「何が起きているか」を表す配列を返す純関数 — 各タグの成立条件を個別に固定する。
// 2026-07-10: 統率・リーダー関連の3タグ以外(致死圏・状態異常・攻撃特殊系)は撤去した。
import { describe, expect, it } from "vitest";
import { summarizeCombatMoments, type CombatMomentContext } from "../src/combatMoments";
import { getUnitDef } from "../src/data/factions";
import { mapById, mapMeta } from "../src/data/maps";
import type { TraitId, UnitState } from "../src/types";

const map = mapById("valley_crossing");

function makeUnit(
  id: string,
  owner: number,
  unitDefId: string,
  pos: { x: number; y: number },
  opts?: {
    hp?: number;
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
    poisoned: false,
    slowed: false,
    xp: 0,
  };
}

function ctx(overrides: Partial<CombatMomentContext>): CombatMomentContext {
  const attacker = overrides.attacker ?? makeUnit("a", 0, "spearman", { x: 8, y: 6 });
  const defender = overrides.defender ?? makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 });
  return {
    attacker,
    defender,
    units: overrides.units ?? [attacker, defender],
    map,
    ...overrides,
  };
}

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

  it("攻撃側がリーダー: leaderAttacking", () => {
    const attacker = makeUnit("a", 0, "lieutenant", { x: 8, y: 6 }, { isLeader: true });
    expect(summarizeCombatMoments(ctx({ attacker }))).toContain("leaderAttacking");
  });

  it("防御側がリーダーでも leaderAttacking は立たない(攻撃側基準)", () => {
    const defender = makeUnit("d", 1, "lieutenant", { x: 8, y: 7 }, { isLeader: true });
    expect(summarizeCombatMoments(ctx({ defender }))).not.toContain("leaderAttacking");
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
    expect(tags).not.toContain("leaderAttacking");
    expect(tags).not.toContain("leaderNearHome");
  });
});
