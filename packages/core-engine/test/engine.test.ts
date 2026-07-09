import { describe, expect, it } from "vitest";
import {
  applyAction,
  createInitialState,
  EngineError,
  STARTING_GOLD,
} from "../src/engine";
import { mapMeta, mapById } from "../src/data/maps";
import type { MatchState } from "../src/types";

const P0 = "user-alice";
const P1 = "user-bob";

// rng=()=>0 で特性付与を決定的にする(人間pool先頭から: 強力+知的 → 移動力は変化しない)
function newMatch(): MatchState {
  return createInitialState(
    {
      players: [
        { userId: P0, factionId: "loyalists" },
        { userId: P1, factionId: "northerners" },
      ],
      mapId: "valley_crossing",
    },
    () => 0,
  );
}

const alwaysHit = () => 0;

describe("createInitialState", () => {
  it("隊長はLv2以上のユニットから選べる(未指定は陣営デフォルト)", () => {
    const state = createInitialState(
      {
        players: [
          { userId: P0, factionId: "loyalists", leaderUnitId: "white_mage" },
          { userId: P1, factionId: "northerners" },
        ],
        mapId: "valley_crossing",
      },
      () => 0,
    );
    expect(state.units[0].unitDefId).toBe("white_mage");
    expect(state.units[1].unitDefId).toBe("orcish_warrior"); // デフォルト隊長
  });

  it("Lv1のユニットは隊長にできない", () => {
    expect(() =>
      createInitialState(
        {
          players: [
            { userId: P0, factionId: "loyalists", leaderUnitId: "spearman" },
            { userId: P1, factionId: "northerners" },
          ],
          mapId: "valley_crossing",
        },
        () => 0,
      ),
    ).toThrow(/レベル2以上/);
  });

  it("他陣営のユニットは隊長にできない", () => {
    expect(() =>
      createInitialState(
        {
          players: [
            { userId: P0, factionId: "loyalists", leaderUnitId: "orcish_grunt" },
            { userId: P1, factionId: "northerners" },
          ],
          mapId: "valley_crossing",
        },
        () => 0,
      ),
    ).toThrow(/存在しない/);
  });

  it("各プレイヤーのリーダーがkeepに配置される", () => {
    const state = newMatch();
    const meta = mapMeta(mapById("valley_crossing"));
    expect(state.units).toHaveLength(2);
    expect(state.units[0].pos).toEqual(meta.keeps[0]);
    expect(state.units[1].pos).toEqual(meta.keeps[1]);
    expect(state.units.every((u) => u.isLeader)).toBe(true);
    expect(state.players[0].gold).toBe(STARTING_GOLD);
    expect(state.activePlayer).toBe(0);
    expect(state.turnNumber).toBe(1);
  });
});

describe("applyAction: 手番と参加者の検証", () => {
  it("手番でないプレイヤーのアクションは拒否", () => {
    const state = newMatch();
    expect(() => applyAction(state, P1, { type: "endTurn" }, alwaysHit)).toThrowError(
      EngineError,
    );
  });

  it("参加していないユーザーのアクションは拒否", () => {
    const state = newMatch();
    expect(() =>
      applyAction(state, "user-mallory", { type: "endTurn" }, alwaysHit),
    ).toThrow(/参加者ではありません/);
  });
});

describe("applyAction: move", () => {
  it("到達可能なヘックスへ移動し、残り移動力が減る", () => {
    const state = newMatch();
    const leader = state.units[0]; // 副官: 移動力6、keep(2,2)
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "move", unitId: leader.id, target: { x: 2, y: 4 } },
      alwaysHit,
    );
    const moved = next.units.find((u) => u.id === leader.id)!;
    expect(moved.pos).toEqual({ x: 2, y: 4 });
    expect(moved.movesLeft).toBe(4);
    expect(events[0].type).toBe("moved");
    expect(next.turnVersion).toBe(state.turnVersion + 1);
    // 元のstateは変更されない(イミュータブル)
    expect(state.units[0].pos).toEqual({ x: 2, y: 2 });
  });

  it("到達不能なヘックスへの移動は拒否(pathはサーバー側で再計算)", () => {
    const state = newMatch();
    expect(() =>
      applyAction(
        state,
        P0,
        { type: "move", unitId: state.units[0].id, target: { x: 15, y: 11 } },
        alwaysHit,
      ),
    ).toThrow(/移動できません/);
  });

  it("相手ユニットは動かせない", () => {
    const state = newMatch();
    expect(() =>
      applyAction(
        state,
        P0,
        { type: "move", unitId: state.units[1].id, target: { x: 12, y: 8 } },
        alwaysHit,
      ),
    ).toThrow(/自軍のユニット/);
  });
});

describe("applyAction: recruit", () => {
  it("リーダーがkeepにいれば自軍の城ヘックスに雇用できる", () => {
    const state = newMatch();
    const { state: next } = applyAction(
      state,
      P0,
      { type: "recruit", unitDefId: "spearman", target: { x: 1, y: 1 } },
      alwaysHit,
    );
    expect(next.players[0].gold).toBe(STARTING_GOLD - 14);
    const recruited = next.units.find((u) => !u.isLeader)!;
    expect(recruited.unitDefId).toBe("spearman");
    expect(recruited.movesLeft).toBe(0); // 雇用したターンは行動不可
    expect(recruited.attacksLeft).toBe(0);
  });

  it("敵陣の城ヘックスには配置できない", () => {
    const state = newMatch();
    expect(() =>
      applyAction(
        state,
        P0,
        { type: "recruit", unitDefId: "spearman", target: { x: 12, y: 8 } },
        alwaysHit,
      ),
    ).toThrow(/自軍の城ヘックス/);
  });

  it("他陣営のユニットは雇用できない", () => {
    const state = newMatch();
    expect(() =>
      applyAction(
        state,
        P0,
        { type: "recruit", unitDefId: "orcish_grunt", target: { x: 1, y: 1 } },
        alwaysHit,
      ),
    ).toThrow(/雇用できない/);
  });

  it("占有済みヘックスには雇用できない", () => {
    const state = newMatch();
    const { state: s1 } = applyAction(
      state,
      P0,
      { type: "recruit", unitDefId: "spearman", target: { x: 1, y: 1 } },
      alwaysHit,
    );
    expect(() =>
      applyAction(
        s1,
        P0,
        { type: "recruit", unitDefId: "bowman", target: { x: 1, y: 1 } },
        alwaysHit,
      ),
    ).toThrow(/埋まって/);
  });

  it("リーダーがkeepを離れると雇用できない", () => {
    const state = newMatch();
    const { state: s1 } = applyAction(
      state,
      P0,
      { type: "move", unitId: state.units[0].id, target: { x: 4, y: 3 } },
      alwaysHit,
    );
    expect(() =>
      applyAction(
        s1,
        P0,
        { type: "recruit", unitDefId: "spearman", target: { x: 1, y: 1 } },
        alwaysHit,
      ),
    ).toThrow(/主城/);
  });

  it("ゴールド不足なら雇用できない", () => {
    const state = newMatch();
    state.players[0].gold = 5;
    expect(() =>
      applyAction(
        state,
        P0,
        { type: "recruit", unitDefId: "spearman", target: { x: 1, y: 1 } },
        alwaysHit,
      ),
    ).toThrow(/ゴールド/);
  });
});

describe("applyAction: endTurn", () => {
  it("手番が交代し、両者終了でターン数が進む", () => {
    const state = newMatch();
    const { state: s1 } = applyAction(state, P0, { type: "endTurn" }, alwaysHit);
    expect(s1.activePlayer).toBe(1);
    expect(s1.turnNumber).toBe(1);
    expect(s1.players[1].gold).toBe(STARTING_GOLD + 2); // 収入

    const { state: s2 } = applyAction(s1, P1, { type: "endTurn" }, alwaysHit);
    expect(s2.activePlayer).toBe(0);
    expect(s2.turnNumber).toBe(2);
  });

  it("手番が回ってきたプレイヤーのユニットがリフレッシュされる", () => {
    const state = newMatch();
    // P0のリーダーを移動させてからP0→P1→P0とターンを回す
    const { state: s1 } = applyAction(
      state,
      P0,
      { type: "move", unitId: state.units[0].id, target: { x: 2, y: 4 } },
      alwaysHit,
    );
    const { state: s2 } = applyAction(s1, P0, { type: "endTurn" }, alwaysHit);
    const { state: s3 } = applyAction(s2, P1, { type: "endTurn" }, alwaysHit);
    const leader = s3.units.find((u) => u.owner === 0)!;
    expect(leader.movesLeft).toBe(6);
    expect(leader.attacksLeft).toBe(1);
  });
});

describe("最長ターン数(maxTurns)", () => {
  function newMatchWithMaxTurns(maxTurns: number): MatchState {
    return createInitialState(
      {
        players: [
          { userId: P0, factionId: "loyalists" },
          { userId: P1, factionId: "northerners" },
        ],
        mapId: "valley_crossing",
        maxTurns,
      },
      () => 0,
    );
  }

  function endBothTurns(state: MatchState) {
    const { state: s1 } = applyAction(state, P0, { type: "endTurn" }, alwaysHit);
    return applyAction(s1, P1, { type: "endTurn" }, alwaysHit);
  }

  it("未指定(optional)なら無制限: 何ターン重ねても終了しない", () => {
    let state = newMatch();
    for (let i = 0; i < 5; i++) {
      state = endBothTurns(state).state;
    }
    expect(state.status).toBe("active");
    expect(state.turnNumber).toBe(6);
  });

  it("上限ちょうどまでは進行中のまま", () => {
    const state = newMatchWithMaxTurns(2);
    const { state: s1 } = endBothTurns(state); // turnNumber -> 2
    expect(s1.turnNumber).toBe(2);
    expect(s1.status).toBe("active");
  });

  it("上限を超えたら引き分けで終了する(status=finished, winner=null)", () => {
    const state = newMatchWithMaxTurns(2);
    const { state: s1 } = endBothTurns(state); // turnNumber -> 2, まだ進行中
    const { state: s2, events } = endBothTurns(s1); // turnNumber -> 3, 上限超過
    expect(s2.status).toBe("finished");
    expect(s2.winner).toBeNull();
    expect(events.some((e) => e.type === "matchFinished" && e.winner === null)).toBe(true);
    // 終了後のアクションは拒否される
    expect(() => applyAction(s2, P0, { type: "endTurn" }, alwaysHit)).toThrow(/終了/);
  });

  it("0以下や非整数のmaxTurnsは作成時にエラー", () => {
    const base = {
      players: [
        { userId: P0, factionId: "loyalists" },
        { userId: P1, factionId: "northerners" },
      ],
      mapId: "valley_crossing",
    };
    expect(() => createInitialState({ ...base, maxTurns: 0 }, () => 0)).toThrow(EngineError);
    expect(() => createInitialState({ ...base, maxTurns: -1 }, () => 0)).toThrow(EngineError);
    expect(() => createInitialState({ ...base, maxTurns: 1.5 }, () => 0)).toThrow(EngineError);
  });
});

describe("applyAction: attack", () => {
  function adjacentSetup(): MatchState {
    const state = newMatch();
    // 隣接位置に手動配置(odd-q: (5,5)と(5,6)は隣接)
    state.units[0].pos = { x: 5, y: 5 };
    state.units[1].pos = { x: 5, y: 6 };
    return state;
  }

  it("隣接する敵を攻撃し、結果が反映される", () => {
    const state = adjacentSetup();
    const { state: next, events } = applyAction(
      state,
      P0,
      {
        type: "attack",
        attackerId: state.units[0].id,
        defenderId: state.units[1].id,
        attackIndex: 0,
      },
      alwaysHit,
    );
    const combatEvent = events.find((e) => e.type === "combat");
    expect(combatEvent).toBeDefined();
    const attacker = next.units.find((u) => u.owner === 0)!;
    expect(attacker.attacksLeft).toBe(0);
    expect(attacker.movesLeft).toBe(0);
    const defender = next.units.find((u) => u.owner === 1)!;
    expect(defender.hp).toBeLessThan(58); // オークの戦士 HP58
  });

  it("隣接していない敵は攻撃できない", () => {
    const state = newMatch(); // リーダー同士は遠く離れている
    expect(() =>
      applyAction(
        state,
        P0,
        {
          type: "attack",
          attackerId: state.units[0].id,
          defenderId: state.units[1].id,
          attackIndex: 0,
        },
        alwaysHit,
      ),
    ).toThrow(/隣接/);
  });

  it("リーダー撃破でマッチ終了・勝者確定", () => {
    const state = adjacentSetup();
    state.units[1].hp = 1;
    const { state: next, events } = applyAction(
      state,
      P0,
      {
        type: "attack",
        attackerId: state.units[0].id,
        defenderId: state.units[1].id,
        attackIndex: 0,
      },
      alwaysHit,
    );
    expect(next.status).toBe("finished");
    expect(next.winner).toBe(0);
    expect(next.units).toHaveLength(1);
    expect(events.some((e) => e.type === "matchFinished")).toBe(true);
    // 終了後のアクションは拒否される
    expect(() => applyAction(next, P0, { type: "endTurn" }, alwaysHit)).toThrow(
      /終了/,
    );
  });
});

describe("applyAction: surrender", () => {
  it("降参すると相手の勝利で終了する", () => {
    const state = newMatch();
    const { state: next } = applyAction(state, P0, { type: "surrender" }, alwaysHit);
    expect(next.status).toBe("finished");
    expect(next.winner).toBe(1);
  });
});
