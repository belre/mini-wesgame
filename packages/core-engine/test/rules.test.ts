// 村(占領・収入・維持費・回復)と毒・疫病のエンジンレベルのテスト
import { describe, expect, it } from "vitest";
import { patchUnitDef } from "./defPatch";
import { applyAction, createInitialState } from "../src/engine";
import { getFaction, getUnitDef } from "../src/data/factions";
import type { MatchState, TraitId, UnitState } from "../src/types";

const P0 = "user-alice";
const P1 = "user-bob";
const rng0 = () => 0;

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
  opts?: { hp?: number; poisoned?: boolean; traits?: TraitId[]; slowed?: boolean },
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
    poisoned: opts?.poisoned ?? false,
    slowed: opts?.slowed,
    xp: 0,
  };
  state.units.push(unit);
  return unit;
}

// 両者がターンを終了して手番を一周させる
function cycle(state: MatchState): MatchState {
  const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
  return applyAction(s1, P1, { type: "endTurn" }, rng0).state;
}

describe("村の占領", () => {
  it("村に止まると領有し、移動が終了する", () => {
    const state = newMatch();
    const leader = state.units[0]; // (2,2) 移動6
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "move", unitId: leader.id, target: { x: 6, y: 3 } }, // 村
      rng0,
    );
    expect(next.villageOwners["6,3"]).toBe(0);
    expect(next.units.find((u) => u.id === leader.id)!.movesLeft).toBe(0);
    expect(events.some((e) => e.type === "villageCaptured")).toBe(true);
  });

  it("自軍領有済みの村では移動は終了しない", () => {
    const state = newMatch();
    state.villageOwners["6,3"] = 0;
    const leader = state.units[0];
    const { state: next } = applyAction(
      state,
      P0,
      { type: "move", unitId: leader.id, target: { x: 6, y: 3 } },
      rng0,
    );
    expect(next.units.find((u) => u.id === leader.id)!.movesLeft).toBeGreaterThan(0);
  });
});

describe("収入と維持費", () => {
  it("村1つで収入+2(基本2+村2)", () => {
    const state = newMatch();
    state.villageOwners["6,3"] = 0;
    const next = cycle(state); // aliceのターン開始まで一周
    expect(next.players[0].gold).toBe(100 + 4);
  });

  it("ユニットの維持費はレベル分。村がそれを相殺する", () => {
    const state = newMatch();
    // 槍兵(Lv1)を雇用: 100-14=86。村なし → 維持費1 → 収入 2-1=1
    const { state: s1 } = applyAction(
      state,
      P0,
      { type: "recruit", unitDefId: "spearman", target: { x: 1, y: 1 } },
      rng0,
    );
    const s2 = cycle(s1);
    expect(s2.players[0].gold).toBe(86 + 1);

    // 村が1つあれば維持費1を相殺: 収入 2+2-0=4
    const state2 = newMatch();
    state2.villageOwners["6,3"] = 0;
    const { state: t1 } = applyAction(
      state2,
      P0,
      { type: "recruit", unitDefId: "spearman", target: { x: 1, y: 1 } },
      rng0,
    );
    const t2 = cycle(t1);
    expect(t2.players[0].gold).toBe(86 + 4);
  });
});

describe("回復", () => {
  it("村の上でターン開始すると8回復する", () => {
    const state = newMatch();
    state.villageOwners["6,3"] = 0;
    pushUnit(state, "wounded", 0, "spearman", { x: 6, y: 3 }, { hp: 10 });
    const next = cycle(state);
    expect(next.units.find((u) => u.id === "wounded")!.hp).toBe(18);
  });

  it("行動しなかったユニットは2回復する(休息)", () => {
    const state = newMatch();
    pushUnit(state, "resting", 0, "spearman", { x: 8, y: 6 }, { hp: 10 });
    const next = cycle(state);
    expect(next.units.find((u) => u.id === "resting")!.hp).toBe(12);
  });

  it("移動したユニットは休息回復しない", () => {
    const state = newMatch();
    pushUnit(state, "mover", 0, "spearman", { x: 8, y: 6 }, { hp: 10 });
    const { state: s1 } = applyAction(
      state,
      P0,
      { type: "move", unitId: "mover", target: { x: 9, y: 6 } },
      rng0,
    );
    const s2 = cycle(s1);
    expect(s2.units.find((u) => u.id === "mover")!.hp).toBe(10);
  });

  it("最大HPを超えては回復しない", () => {
    const state = newMatch();
    state.villageOwners["6,3"] = 0;
    pushUnit(state, "almost", 0, "spearman", { x: 6, y: 3 }, { hp: 35 }); // maxHp 36
    const next = cycle(state);
    expect(next.units.find((u) => u.id === "almost")!.hp).toBe(36);
  });
});

describe("毒の経過", () => {
  it("ターン開始時に8ダメージ(HPは1未満にならない)", () => {
    const state = newMatch();
    pushUnit(state, "sick", 0, "spearman", { x: 8, y: 6 }, { hp: 20, poisoned: true });
    pushUnit(state, "dying", 0, "spearman", { x: 10, y: 6 }, { hp: 5, poisoned: true });
    const next = cycle(state);
    expect(next.units.find((u) => u.id === "sick")!.hp).toBe(12);
    expect(next.units.find((u) => u.id === "dying")!.hp).toBe(1);
  });

  it("村の上なら毒が治る(そのターンの回復はなし)", () => {
    const state = newMatch();
    state.villageOwners["6,3"] = 0;
    pushUnit(state, "cured", 0, "spearman", { x: 6, y: 3 }, { hp: 20, poisoned: true });
    const next = cycle(state);
    const unit = next.units.find((u) => u.id === "cured")!;
    expect(unit.poisoned).toBe(false);
    expect(unit.hp).toBe(20);
  });
});

describe("回復・毒のイベント(healed/poisonDamage)", () => {
  // cycleと違い、P1のendTurn(P0のユニットが回復/毒ダメージを受ける側)のeventsを直接見る
  it("村での回復はhealedイベント(source: village)になる", () => {
    const state = newMatch();
    state.villageOwners["6,3"] = 0;
    pushUnit(state, "wounded", 0, "spearman", { x: 6, y: 3 }, { hp: 10 });
    const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
    const { events } = applyAction(s1, P1, { type: "endTurn" }, rng0);
    expect(events).toContainEqual({
      type: "healed",
      unitId: "wounded",
      amount: 8,
      source: "village",
    });
  });

  it("休息回復はhealedイベント(source: rest)になる", () => {
    const state = newMatch();
    pushUnit(state, "resting", 0, "spearman", { x: 8, y: 6 }, { hp: 10 });
    const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
    const { events } = applyAction(s1, P1, { type: "endTurn" }, rng0);
    expect(events).toContainEqual({
      type: "healed",
      unitId: "resting",
      amount: 2,
      source: "rest",
    });
  });

  it("隣接ヒーラー(heals8)による回復はhealedイベント(source: healer)になる", () => {
    const state = newMatch();
    pushUnit(state, "wounded", 0, "spearman", { x: 8, y: 6 }, { hp: 10 });
    pushUnit(state, "healer", 0, "white_mage", { x: 8, y: 7 }); // 隣接・heals8持ち
    const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
    const { events } = applyAction(s1, P1, { type: "endTurn" }, rng0);
    expect(events).toContainEqual({
      type: "healed",
      unitId: "wounded",
      amount: 8,
      source: "healer",
    });
  });

  it("回復しなかった(満タン)ユニットはhealedイベントを出さない", () => {
    const state = newMatch();
    pushUnit(state, "full", 0, "spearman", { x: 12, y: 6 }); // hp指定なし=maxHp、休息2も適用外(満タン)
    const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
    const { events } = applyAction(s1, P1, { type: "endTurn" }, rng0);
    expect(events.some((e) => e.type === "healed" && e.unitId === "full")).toBe(false);
  });

  it("毒ダメージはpoisonDamageイベントになる", () => {
    const state = newMatch();
    pushUnit(state, "sick", 0, "spearman", { x: 8, y: 6 }, { hp: 20, poisoned: true });
    const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
    const { events } = applyAction(s1, P1, { type: "endTurn" }, rng0);
    expect(events).toContainEqual({ type: "poisonDamage", unitId: "sick", amount: 8 });
  });

  it("村で毒が治った場合はpoisonDamageイベントを出さない", () => {
    const state = newMatch();
    state.villageOwners["6,3"] = 0;
    pushUnit(state, "cured", 0, "spearman", { x: 6, y: 3 }, { hp: 20, poisoned: true });
    const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
    const { events } = applyAction(s1, P1, { type: "endTurn" }, rng0);
    expect(events.some((e) => e.type === "poisonDamage")).toBe(false);
  });
});

describe("遅化(slow)の自動解除", () => {
  it("治療手段なしで、自分のターン開始時に自動的に解除される", () => {
    const state = newMatch();
    pushUnit(state, "slowed1", 0, "spearman", { x: 8, y: 6 }, { slowed: true });
    const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
    const next = applyAction(s1, P1, { type: "endTurn" }, rng0).state;
    expect(next.units.find((u) => u.id === "slowed1")!.slowed).toBe(false);
  });
});

describe("疫病(plague)", () => {
  // mini: 疫病の担い手(歩く死体)が陣営削減で消えたため、戦士の攻撃にplagueを
  // patchしてルール自体を検証する。死体フォームIDも既存ユニットへ一時配線する
  // (エンジンのフォールバック"walking_corpse"はminiでは解決不能=休眠)
  const plagueTouch = () =>
    patchUnitDef("orcish_grunt", (def) => {
      def.attacks = [
        { id: "touch", name: "接触", damage: 9, count: 2, type: "impact", range: "melee", specials: ["plague"] },
      ];
    });

  it("歩く死体に倒されたユニットは相手側の死体になる", () => {
    const restore = plagueTouch();
    const loyalists = getFaction("loyalists");
    loyalists.plagueCorpseUnitId = "orcish_grunt";
    const state = newMatch();
    pushUnit(state, "victim", 0, "spearman", { x: 8, y: 6 }, { hp: 1 });
    const corpse = pushUnit(state, "corpse", 1, "orcish_grunt", { x: 8, y: 7 }, {
      traits: ["undead"],
    });
    state.activePlayer = 1;
    const { state: next, events } = applyAction(
      state,
      P1,
      { type: "attack", attackerId: corpse.id, defenderId: "victim", attackIndex: 0 },
      rng0,
    );
    // 犠牲者は消え、同じ場所にbob側の歩く死体が湧く
    expect(next.units.find((u) => u.id === "victim")).toBeUndefined();
    const spawned = events.find((e) => e.type === "plagueSpawned");
    expect(spawned).toBeDefined();
    const newCorpse = next.units.find(
      (u) => u.owner === 1 && u.pos.x === 8 && u.pos.y === 6,
    );
    expect(newCorpse?.unitDefId).toBe("orcish_grunt");
    restore();
    delete loyalists.plagueCorpseUnitId;
  });

  it("アンデッド特性のユニットは死体化しない", () => {
    const restore = plagueTouch();
    const state = newMatch();
    pushUnit(state, "victim", 0, "spearman", { x: 8, y: 6 }, { hp: 1, traits: ["undead"] });
    const corpse = pushUnit(state, "corpse", 1, "orcish_grunt", { x: 8, y: 7 }, {
      traits: ["undead"],
    });
    state.activePlayer = 1;
    const { state: next, events } = applyAction(
      state,
      P1,
      { type: "attack", attackerId: corpse.id, defenderId: "victim", attackIndex: 0 },
      rng0,
    );
    expect(events.some((e) => e.type === "plagueSpawned")).toBe(false);
    expect(next.units.some((u) => u.owner === 1 && u.pos.x === 8 && u.pos.y === 6)).toBe(
      false,
    );
    restore();
  });

  it("村の上で倒されたユニットは死体化しない", () => {
    const restore = plagueTouch();
    const state = newMatch();
    pushUnit(state, "victim", 0, "spearman", { x: 6, y: 3 }, { hp: 1 }); // (6,3)は村
    const corpse = pushUnit(state, "corpse", 1, "orcish_grunt", { x: 6, y: 4 }, {
      traits: ["undead"],
    });
    state.activePlayer = 1;
    const { state: next, events } = applyAction(
      state,
      P1,
      { type: "attack", attackerId: corpse.id, defenderId: "victim", attackIndex: 0 },
      rng0,
    );
    expect(events.some((e) => e.type === "plagueSpawned")).toBe(false);
    expect(next.units.some((u) => u.owner === 1 && u.pos.x === 6 && u.pos.y === 3)).toBe(
      false,
    );
    restore();
  });

  it("死体の種類は倒された側の陣営のplagueCorpseUnitIdに従う", () => {
    const restorePatch = plagueTouch();
    const loyalists = getFaction("loyalists");
    expect(loyalists.plagueCorpseUnitId).toBeUndefined(); // 人間フォルムは未指定のまま
    loyalists.plagueCorpseUnitId = "spearman"; // 配線の検証用に一時的に差し替える
    try {
      const state = newMatch();
      pushUnit(state, "victim", 0, "spearman", { x: 8, y: 6 }, { hp: 1 });
      const corpse = pushUnit(state, "corpse", 1, "orcish_grunt", { x: 8, y: 7 }, {
        traits: ["undead"],
      });
      state.activePlayer = 1;
      const { state: next } = applyAction(
        state,
        P1,
        { type: "attack", attackerId: corpse.id, defenderId: "victim", attackIndex: 0 },
        rng0,
      );
      const newCorpse = next.units.find(
        (u) => u.owner === 1 && u.pos.x === 8 && u.pos.y === 6,
      );
      expect(newCorpse?.unitDefId).toBe("spearman");
    } finally {
      delete loyalists.plagueCorpseUnitId;
      restorePatch();
    }
  });

  // mini: 実データ配線テスト(drakes.plagueCorpseUnitId=zombie_drake)は陣営削減で削除。
  // 本家parle-stroikaに完全版がある

});
