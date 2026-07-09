// 霧(FOG)のテスト
import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "../src/engine";
import { getUnitDef } from "../src/data/factions";
import { computeVisionSet, filterStateForViewer } from "../src/visibility";
import type { MatchState, UnitState } from "../src/types";

const P0 = "user-alice";
const P1 = "user-bob";
const rng0 = () => 0;

function newMatch(fog: boolean): MatchState {
  return createInitialState(
    {
      players: [
        { userId: P0, factionId: "loyalists" },
        { userId: P1, factionId: "northerners" },
      ],
      mapId: "valley_crossing",
      fog,
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
  opts?: { movesLeft?: number },
): UnitState {
  const def = getUnitDef(unitDefId);
  const unit: UnitState = {
    id,
    unitDefId,
    owner,
    pos,
    hp: def.hp,
    maxHp: def.hp,
    movesLeft: opts?.movesLeft ?? def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: false,
    traits: [],
    poisoned: false,
    xp: 0,
  };
  state.units.push(unit);
  return unit;
}

describe("霧なし(デフォルト)", () => {
  it("computeVisionSetはnull(全ヘックス可視)を返し、遠くの敵も見える", () => {
    const state = newMatch(false);
    expect(state.fogEnabled).toBe(false);
    expect(computeVisionSet(state, 0)).toBeNull();
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.units).toHaveLength(2); // 相手リーダー(遠距離)も見える
  });
});

describe("霧あり", () => {
  it("視界 = 自軍ユニットからヘックス距離が移動力以内", () => {
    const state = newMatch(true);
    expect(state.fogEnabled).toBe(true);
    const vision = computeVisionSet(state, 0)!;
    expect(vision).not.toBeNull();
    // aliceのリーダー(2,2)・移動力6: (2,8)は距離6で視界内、(2,9)は距離7で視界外
    expect(vision.has("2,8")).toBe(true);
    expect(vision.has("2,9")).toBe(false);
  });

  it("開始時、対角のkeepにいる相手リーダーは互いに見えない", () => {
    const state = newMatch(true);
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.units).toHaveLength(1);
    expect(forAlice.units[0].owner).toBe(0);
    const forBob = filterStateForViewer(state, P1);
    expect(forBob.units).toHaveLength(1);
    expect(forBob.units[0].owner).toBe(1);
  });

  it("視界内に入った敵は見える", () => {
    const state = newMatch(true);
    pushUnit(state, "nearby", 1, "orcish_grunt", { x: 4, y: 4 }); // リーダー(2,2)から近距離
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.units.some((u) => u.id === "nearby")).toBe(true);
  });

  it("視界外の敵村の領有情報は隠れる(自軍の村は常に把握)", () => {
    const state = newMatch(true);
    state.villageOwners["12,4"] = 1; // bobが領有、aliceの視界外
    state.villageOwners["6,3"] = 0; // aliceが領有
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.villageOwners["12,4"]).toBeUndefined();
    expect(forAlice.villageOwners["6,3"]).toBe(0);
    // bobから見れば自分の村は見える
    const forBob = filterStateForViewer(state, P1);
    expect(forBob.villageOwners["12,4"]).toBe(1);
  });

  it("視界外の敵のZOCに踏み込むと移動が中断される", () => {
    const state = newMatch(true);
    // aliceのリーダーを遠くへ退避させ、moverの視界だけにする
    state.units[0].pos = { x: 15, y: 11 };
    pushUnit(state, "mover", 0, "spearman", { x: 0, y: 8 }); // 移動力5
    pushUnit(state, "lurker", 1, "orcish_grunt", { x: 0, y: 2 }); // 距離6 → 視界外
    // 事前確認: lurkerはaliceから見えない
    expect(filterStateForViewer(state, P0).units.some((u) => u.id === "lurker")).toBe(false);
    // (0,3)はlurkerのZOC。x=0列を北上する唯一の最短路の終点で発覚
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "move", unitId: "mover", target: { x: 0, y: 3 } },
      rng0,
    );
    expect(events.some((e) => e.type === "moveInterrupted")).toBe(true);
    const mover = next.units.find((u) => u.id === "mover")!;
    expect(mover.movesLeft).toBe(0);
    // 停止位置からはlurkerが見える(発覚)
    expect(
      filterStateForViewer(next, P0).units.some((u) => u.id === "lurker"),
    ).toBe(true);
  });

  it("旧レコード(fogEnabledなし)は霧なしとして扱われる", () => {
    const state = newMatch(false);
    delete (state as Partial<MatchState>).fogEnabled;
    const { state: next } = applyAction(state, P0, { type: "endTurn" }, rng0);
    expect(next.fogEnabled).toBe(false);
  });
});
