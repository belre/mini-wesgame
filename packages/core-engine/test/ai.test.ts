// CPU思考ルーチン(ai.ts)のテスト。
// 「必ず合法手を返し、有限手数でターンを終える」ことが最重要の不変条件。
import { describe, expect, it } from "vitest";
import { chooseCpuAction } from "../src/ai";
import { getUnitDef } from "../src/data/factions";
import { mapById, terrainAt } from "../src/data/maps";
import { applyAction, createInitialState } from "../src/engine";
import type { Action, MatchState, Rng, TraitId, UnitState } from "../src/types";

const P0 = "user-alice";
const P1 = "cpu-player";
const rng0 = () => 0;

// テスト再現性のためのシード付き乱数(LCG)
function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function newMatch(): MatchState {
  return createInitialState(
    {
      players: [
        { userId: P0, factionId: "loyalists" },
        { userId: P1, factionId: "undead" },
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
  opts?: { hp?: number; traits?: TraitId[] },
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
    xp: 0,
  };
  state.units.push(unit);
  return unit;
}

describe("chooseCpuAction", () => {
  it("自軍ユニットの昇格待ちがあれば最優先でchooseLevelUpを返す", () => {
    const state = newMatch();
    pushUnit(state, "u1", 0, "elvish_fighter", { x: 8, y: 6 });
    state.pendingPromotion.push({
      unitId: "u1",
      choices: ["elvish_captain", "elvish_hero"],
    });
    const action = chooseCpuAction(state, rng0);
    expect(action.type).toBe("chooseLevelUp");
    if (action.type === "chooseLevelUp") {
      expect(action.unitId).toBe("u1");
      expect(["elvish_captain", "elvish_hero"]).toContain(action.targetDefId);
    }
  });

  it("隣接する瀕死の敵がいれば攻撃で仕留めにいく", () => {
    const state = newMatch();
    pushUnit(state, "atk", 0, "spearman", { x: 8, y: 6 });
    pushUnit(state, "def", 1, "orcish_grunt", { x: 8, y: 7 }, { hp: 1 });
    const action = chooseCpuAction(state, rng0);
    expect(action.type).toBe("attack");
    if (action.type === "attack") {
      expect(action.attackerId).toBe("atk");
      expect(action.defenderId).toBe("def");
    }
  });

  it("リーダーが主城にいて資金があれば雇用する", () => {
    const state = newMatch(); // 初期状態: 両リーダーがkeep上、gold 100
    const action = chooseCpuAction(state, rng0);
    expect(action.type).toBe("recruit");
  });

  it("移動力の範囲に未領有の村があれば占領しにいく", () => {
    const state = newMatch();
    state.players[0].gold = 0; // 雇用をさせない
    pushUnit(state, "walker", 0, "spearman", { x: 4, y: 3 }); // 村(6,3)の近く
    const action = chooseCpuAction(state, rng0);
    expect(action.type).toBe("move");
    if (action.type === "move") {
      expect(action.unitId).toBe("walker");
      const map = mapById(state.mapId);
      expect(terrainAt(map, action.target).id).toBe("village");
    }
  });

  it("CPUのターンは有限手数で必ずendTurnに到達し、全手が合法である", () => {
    let state = newMatch();
    const rng = seededRng(42);
    let ended = false;
    for (let i = 0; i < 100; i++) {
      const action: Action = chooseCpuAction(state, rng);
      state = applyAction(state, P0, action, rng).state; // 不正な手ならここでthrow
      if (action.type === "endTurn") {
        ended = true;
        break;
      }
    }
    expect(ended).toBe(true);
    expect(state.activePlayer).toBe(1);
  });

  it("CPU同士で10ターン対戦してもエラーにならない(スモーク)", () => {
    let state = newMatch();
    const rng = seededRng(7);
    for (let i = 0; i < 2000; i++) {
      if (state.status !== "active" || state.turnNumber > 10) break;
      const actor = state.players[state.activePlayer].userId;
      const action = chooseCpuAction(state, rng);
      state = applyAction(state, actor, action, rng).state;
    }
    // 進行していること(初期状態のまま止まっていない)を確認
    expect(state.turnNumber > 1 || state.status === "finished").toBe(true);
  });
});
