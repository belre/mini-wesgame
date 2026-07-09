// 経験値(XP)とレベルアップのテスト
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FACTIONS, getUnitDef } from "../src/data/factions";
import { applyAction, createInitialState, killXp } from "../src/engine";
import { maxXpFor } from "../src/traits";
import type { MatchState, TraitId, UnitDef, UnitState } from "../src/types";
import { patchUnitDef } from "./defPatch";

const P0 = "user-alice";
const P1 = "user-bob";
const rng0 = () => 0; // 全弾命中
const rngMiss = () => 0.99; // 全弾回避

function newMatch(): MatchState {
  return createInitialState(
    {
      players: [
        { userId: P0, factionId: "loyalists" },
        { userId: P1, factionId: "northerners" },
      ],
      mapId: "valley_crossing",
    },
    rng0,
  );
}

function pushUnit(
  state: MatchState,
  id: string,
  owner: number,
  unitDefId: string,
  pos: { x: number; y: number },
  opts?: { hp?: number; xp?: number; traits?: TraitId[] },
): UnitState {
  const def = getUnitDef(unitDefId);
  const unit: UnitState = {
    id,
    unitDefId,
    owner,
    pos,
    hp: opts?.hp ?? def.hp,
    maxHp: def.hp,
    movesLeft: def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: false,
    traits: opts?.traits ?? [],
    poisoned: false,
    xp: opts?.xp ?? 0,
  };
  state.units.push(unit);
  return unit;
}

// maxXpFor が読むのは level と maxXp のみ。実データはユニットごとの調整で
// 随時maxXpが明示指定されうる(2026-07-08〜)ため、デフォルト式そのものの検証は
// 実データに依存しない合成defで行う
function fakeUnitDef(level: number, maxXp?: number): UnitDef {
  return { level, maxXp } as UnitDef;
}

describe("maxXpFor / killXp", () => {
  const spearman = getUnitDef("spearman"); // Lv1(2026-07-08 ユーザー指定でmaxXp=42を明示)
  it("必要XPのデフォルトはレベル×40(レベル0は30)", () => {
    expect(maxXpFor(fakeUnitDef(1), [])).toBe(40);
    expect(maxXpFor(fakeUnitDef(0), [])).toBe(30); // Lv0
    expect(maxXpFor(fakeUnitDef(2), [])).toBe(80); // Lv2
  });

  it("spearmanはmaxXp=42を明示指定(2026-07-08 ユーザー指定)", () => {
    expect(maxXpFor(spearman, [])).toBe(42);
  });

  it("bowmanはmaxXp=39を明示指定(2026-07-08 ユーザー指定)", () => {
    expect(maxXpFor(getUnitDef("bowman"), [])).toBe(39);
  });

  it("知的は-20%、凡愚は+20%(spearmanの明示XP=42基準)", () => {
    expect(maxXpFor(spearman, ["intelligent"])).toBe(34); // round(42*0.8)
    expect(maxXpFor(spearman, ["dim"])).toBe(50); // round(42*1.2)
  });

  it("撃破XPはレベル×8(レベル0は4)", () => {
    expect(killXp(0)).toBe(4);
    expect(killXp(1)).toBe(8);
    expect(killXp(2)).toBe(16);
  });
});

describe("戦闘での経験値の入手", () => {
  function attack(state: MatchState, rng: () => number) {
    return applyAction(
      state,
      P0,
      { type: "attack", attackerId: "atk", defenderId: "def", attackIndex: 0 },
      rng,
    );
  }

  it("双方生存: 互いに相手のレベル分のXPを得る", () => {
    const state = newMatch();
    pushUnit(state, "atk", 0, "spearman", { x: 8, y: 6 });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 });
    const { state: next } = attack(state, rngMiss); // 全弾回避で双方無傷
    expect(next.units.find((u) => u.id === "atk")!.xp).toBe(1);
    expect(next.units.find((u) => u.id === "def")!.xp).toBe(1);
  });

  it("撃破: レベル×8のXPを得る", () => {
    const state = newMatch();
    pushUnit(state, "atk", 0, "spearman", { x: 8, y: 6 });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 1 });
    const { state: next } = attack(state, rng0);
    expect(next.units.find((u) => u.id === "atk")!.xp).toBe(8);
  });

  it("レベル0の撃破は+4XP", () => {
    // mini版にLv0ユニット(本家ゾンビ系)がいないため、一時的にLv0へ書き換えて検証する
    const restore = patchUnitDef("orcish_grunt", (d) => {
      d.level = 0;
    });
    try {
      const state = newMatch();
      pushUnit(state, "atk", 0, "spearman", { x: 8, y: 6 });
      pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 1 });
      const { state: next } = attack(state, rng0);
      expect(next.units.find((u) => u.id === "atk")!.xp).toBe(4);
    } finally {
      restore();
    }
  });
});

describe("レベルアップ", () => {
  it("昇格先があればそのユニットに変身し、全回復・特性引き継ぎ・XP繰り越し", () => {
    const state = newMatch();
    // 魔術師(必要XP54。2026-07-08 ユーザー指定)がXP47の状態で撃破(+8) → 55 → 白魔術師へ昇格、XP1
    pushUnit(state, "atk", 0, "mage", { x: 8, y: 6 }, { xp: 47, hp: 5, traits: ["strong"] });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 1 });
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "attack", attackerId: "atk", defenderId: "def", attackIndex: 1 }, // スパーク
      rng0,
    );
    const unit = next.units.find((u) => u.id === "atk")!;
    expect(unit.unitDefId).toBe("white_mage");
    expect(unit.xp).toBe(1);
    expect(unit.maxHp).toBe(36); // 白魔術師35 + 強力1
    expect(unit.hp).toBe(unit.maxHp); // 全回復
    expect(unit.traits).toContain("strong"); // 特性引き継ぎ
    const levelUp = events.find((e) => e.type === "levelUp");
    expect(levelUp).toMatchObject({ fromDefId: "mage", toDefId: "white_mage", amla: false });
  });

  it("昇格先がなければAMLA: 最大HP+3と全回復", () => {
    const state = newMatch();
    // pikeman(Lv2・必要XP80・昇格先なし)がXP79の状態で撃破(+8) → 87 → AMLA、XP7
    pushUnit(state, "atk", 0, "pikeman", { x: 8, y: 6 }, { xp: 79, hp: 10 });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 1 });
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "attack", attackerId: "atk", defenderId: "def", attackIndex: 0 },
      rng0,
    );
    const unit = next.units.find((u) => u.id === "atk")!;
    expect(unit.unitDefId).toBe("pikeman");
    expect(unit.maxHp).toBe(58); // 55 + 3
    expect(unit.hp).toBe(58);
    expect(unit.xp).toBe(7);
    const levelUp = events.find((e) => e.type === "levelUp");
    expect(levelUp).toMatchObject({ amla: true });
  });

  it("防御側も戦闘でXPを得てレベルアップできる", () => {
    const state = newMatch();
    pushUnit(state, "atk", 0, "spearman", { x: 8, y: 6 });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { xp: 41 });
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "attack", attackerId: "atk", defenderId: "def", attackIndex: 0 },
      rngMiss, // 双方生存 → 防御側は+1XPで42(必要XP)に到達
    );
    const def = next.units.find((u) => u.id === "def")!;
    expect(def.xp).toBe(0);
    // オークの兵卒はオークの戦士(HP58)へ昇格する(AMLAではない)
    expect(def.unitDefId).toBe("orcish_warrior");
    expect(def.maxHp).toBe(58);
    expect(events.some((e) => e.type === "levelUp")).toBe(true);
  });
});

describe("昇格ラインのデータ整合性", () => {
  it("全ユニットのadvancesToは実在するユニットを指す", () => {
    for (const faction of Object.values(FACTIONS)) {
      for (const unit of faction.units) {
        for (const targetId of unit.advancesTo ?? []) {
          expect(() => getUnitDef(targetId)).not.toThrow();
        }
      }
    }
  });
});

describe("多選択昇格(chooseLevelUp)", () => {
  // 現ロースターに複数昇格先を持つユニットがいないため、
  // elvish_fighterのadvancesToを一時パッチしてルール自体を検証する
  let restore: () => void;
  beforeAll(() => {
    restore = patchUnitDef("spearman", (def) => {
      def.advancesTo = ["lieutenant", "swordsman"];
    });
  });
  afterAll(() => restore());

  it("2つ以上の昇格先がある場合、pendingPromotionが設定されてアクションがブロックされる", () => {
    const state = newMatch();
    // パッチ済み: elvish_fighter は advancesTo: ["lieutenant", "swordsman"]
    pushUnit(state, "atk", 0, "spearman", { x: 8, y: 6 }, { xp: 39 });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 1 });
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "attack", attackerId: "atk", defenderId: "def", attackIndex: 0 },
      rng0,
    );
    expect(next.pendingPromotion).toHaveLength(1);
    expect(next.pendingPromotion[0].unitId).toBe("atk");
    expect(next.pendingPromotion[0].choices).toEqual(["lieutenant", "swordsman"]);
    expect(events.some((e) => e.type === "pendingLevelUp")).toBe(true);
    expect(() => applyAction(next, P0, { type: "endTurn" }, rng0)).toThrow(/昇格先を選択/);
  });

  it("chooseLevelUpで昇格先を選ぶと昇格が確定しpendingPromotionがクリアされる", () => {
    const state = newMatch();
    pushUnit(state, "atk", 0, "spearman", { x: 8, y: 6 }, { xp: 39 });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 1 });
    const { state: pending } = applyAction(
      state,
      P0,
      { type: "attack", attackerId: "atk", defenderId: "def", attackIndex: 0 },
      rng0,
    );
    const { state: next, events } = applyAction(
      pending,
      P0,
      { type: "chooseLevelUp", unitId: "atk", targetDefId: "swordsman" },
      rng0,
    );
    const unit = next.units.find((u) => u.id === "atk")!;
    expect(unit.unitDefId).toBe("swordsman");
    expect(unit.hp).toBe(unit.maxHp);
    expect(next.pendingPromotion).toHaveLength(0);
    const levelUp = events.find((e) => e.type === "levelUp");
    expect(levelUp).toMatchObject({ fromDefId: "spearman", toDefId: "swordsman", amla: false });
  });

  it("chooseLevelUpで無効な昇格先を指定するとエラー", () => {
    const state = newMatch();
    pushUnit(state, "atk", 0, "spearman", { x: 8, y: 6 }, { xp: 39 });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 1 });
    const { state: pending } = applyAction(
      state,
      P0,
      { type: "attack", attackerId: "atk", defenderId: "def", attackIndex: 0 },
      rng0,
    );
    expect(() =>
      applyAction(pending, P0, { type: "chooseLevelUp", unitId: "atk", targetDefId: "spearman" }, rng0),
    ).toThrow(/無効な昇格先/);
  });
});
