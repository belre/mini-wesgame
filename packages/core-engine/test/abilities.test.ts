// 能力(伏兵・潜水・治癒・回復・統率・再生・すり抜け・装甲)のテスト
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leadershipSupportersOf, predictCombat, type CombatContext } from "../src/combat";
import { getUnitDef } from "../src/data/factions";
import { terrainById } from "../src/data/terrain";
import { applyAction, createInitialState, EngineError } from "../src/engine";
import { hexKey } from "../src/hex";
import { computeReachable } from "../src/movement";
import { TIME_OF_DAY_DEFS } from "../src/timeOfDay";
import { filterStateForViewer, isHiddenFrom } from "../src/visibility";
import type { GameMap, MatchState, TraitId, UnitState } from "../src/types";
import { patchUnitDef } from "./defPatch";

const P0 = "user-alice";
const P1 = "user-bob";
const rng0 = () => 0;

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

function makeUnit(
  id: string,
  owner: number,
  unitDefId: string,
  pos: { x: number; y: number },
  opts?: { hp?: number; poisoned?: boolean; traits?: TraitId[]; movesLeft?: number },
): UnitState {
  const def = getUnitDef(unitDefId);
  return {
    id,
    unitDefId,
    owner,
    pos,
    hp: opts?.hp ?? def.hp,
    maxHp: def.hp,
    movesLeft: opts?.movesLeft ?? def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: false,
    traits: opts?.traits ?? [],
    poisoned: opts?.poisoned ?? false,
    xp: 0,
  };
}

function flatMap(width: number, height: number, tiles?: string[]): GameMap {
  return {
    id: "test",
    name: "テスト",
    width,
    height,
    tiles: tiles ?? Array(height).fill("g".repeat(width)),
  };
}

function cycle(state: MatchState): MatchState {
  const s1 = applyAction(state, P0, { type: "endTurn" }, rng0).state;
  return applyAction(s1, P1, { type: "endTurn" }, rng0).state;
}

describe("すり抜け(skirmisher)", () => {
  it("敵のZOCを無視して移動できる", () => {
    const map = flatMap(12, 12);
    const skirmisher = makeUnit("s", 0, "saurian_skirmisher", { x: 2, y: 5 });
    const enemy = makeUnit("e", 1, "spearman", { x: 5, y: 5 });
    const reachable = computeReachable({
      unit: skirmisher,
      unitDef: getUnitDef("saurian_skirmisher"),
      units: [skirmisher, enemy],
      map,
    });
    // ZOCヘックス(4,5)に入っても移動力が残る
    const zocNode = reachable.get(hexKey({ x: 4, y: 5 }));
    expect(zocNode).toBeDefined();
    expect(zocNode!.remaining).toBeGreaterThan(0);
  });
});

describe("地形コストの個別上書き(スケルトンの潜水移動)", () => {
  const wall = flatMap(6, 3, ["ggWggg", "ggWggg", "ggWggg"]); // x=2列が深海の壁

  it("スケルトンは深海を渡れる", () => {
    const skeleton = makeUnit("sk", 0, "skeleton", { x: 1, y: 1 });
    const reachable = computeReachable({
      unit: skeleton,
      unitDef: getUnitDef("skeleton"),
      units: [skeleton],
      map: wall,
    });
    expect(reachable.get(hexKey({ x: 2, y: 1 }))?.cost).toBe(2);
    expect(reachable.has(hexKey({ x: 3, y: 1 }))).toBe(true);
  });

  it("通常の歩行ユニットは深海に入れない", () => {
    const spearman = makeUnit("sp", 0, "spearman", { x: 1, y: 1 });
    const reachable = computeReachable({
      unit: spearman,
      unitDef: getUnitDef("spearman"),
      units: [spearman],
      map: wall,
    });
    expect(reachable.has(hexKey({ x: 2, y: 1 }))).toBe(false);
    expect(reachable.has(hexKey({ x: 3, y: 1 }))).toBe(false);
  });
});

function combatCtx(
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

describe("統率(leadership)", () => {
  it("統率持ちの味方が隣接していると与ダメージ+25%", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 });
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 });
    const lieutenant = makeUnit("l", 0, "lieutenant", { x: 7, y: 6 }); // 攻撃者に隣接
    const p = predictCombat(
      combatCtx(attacker, 0, defender, { units: [attacker, defender, lieutenant] }),
    );
    expect(p.damagePerStrike).toBe(9); // 槍7 × 1.25 = 8.75 → 9
  });

  it("隣接していなければ効果なし", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 });
    const defender = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 });
    const lieutenant = makeUnit("l", 0, "lieutenant", { x: 2, y: 2 }); // 遠い
    const p = predictCombat(
      combatCtx(attacker, 0, defender, { units: [attacker, defender, lieutenant] }),
    );
    expect(p.damagePerStrike).toBe(7);
  });

  it("leadershipSupportersOf: 提供元本体を返す(カットインの演出判定等が使う)", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 });
    const lieutenant = makeUnit("l", 0, "lieutenant", { x: 7, y: 6 }); // 隣接
    const far = makeUnit("l2", 0, "lieutenant", { x: 2, y: 2 }); // 遠い
    const enemyLieutenant = makeUnit("el", 1, "lieutenant", { x: 8, y: 7 }); // 敵軍(効果なし)
    const supporters = leadershipSupportersOf(attacker, [attacker, lieutenant, far, enemyLieutenant]);
    expect(supporters.map((u) => u.id)).toEqual(["l"]);
  });

  it("leadershipSupportersOf: 該当なしなら空配列", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 });
    const swordsman = makeUnit("s", 0, "swordsman", { x: 7, y: 6 }); // 隣接だが統率なし
    expect(leadershipSupportersOf(attacker, [attacker, swordsman])).toEqual([]);
  });
});

describe("装甲(steadfast)", () => {
  // 現ロースターにsteadfast持ちがいない(knalganのドワーフ警護兵が無効化中)ため、
  // swordsmanに装甲+耐性30(貫通・斬撃)を一時パッチしてルール自体を検証する
  let restore: () => void;
  beforeAll(() => {
    restore = patchUnitDef("swordsman", (def) => {
      def.abilities = ["steadfast"];
      def.resistances = { ...def.resistances, pierce: 30, blade: 30 };
    });
  });
  afterAll(() => restore());

  it("防御時、正の耐性が2倍(上限50%)", () => {
    const attacker = makeUnit("a", 0, "spearman", { x: 8, y: 6 });
    const guardsman = makeUnit("g", 1, "swordsman", { x: 8, y: 7 });
    const p = predictCombat(combatCtx(attacker, 0, guardsman));
    // 槍7 × (100-50)/100 = 3.5 → 4(貫通耐性30 → 60だが上限50)
    expect(p.damagePerStrike).toBe(4);
  });

  it("攻撃時は恩恵を受けない", () => {
    const guardsman = makeUnit("g", 0, "swordsman", { x: 8, y: 6 });
    const grunt = makeUnit("d", 1, "orcish_grunt", { x: 8, y: 7 });
    const p = predictCombat(combatCtx(guardsman, 0, grunt));
    // 反撃: 剣9 × (100-30)/100 = 6.3 → 6(装甲側が攻撃したので耐性は2倍にならない)
    expect(p.retaliation?.damagePerStrike).toBe(6);
  });
});

describe("回復・治癒・再生", () => {
  it("回復+8: 隣接する味方を8回復する", () => {
    const state = newMatch();
    state.units.push(makeUnit("healer", 0, "white_mage", { x: 8, y: 6 }));
    state.units.push(makeUnit("wounded", 0, "spearman", { x: 8, y: 7 }, { hp: 10 }));
    const next = cycle(state);
    expect(next.units.find((u) => u.id === "wounded")!.hp).toBe(18);
  });

  it("回復+4: 隣接する味方を4回復する", () => {
    const state = newMatch();
    state.units.push(makeUnit("healer", 0, "saurian_augur", { x: 8, y: 6 }));
    state.units.push(makeUnit("wounded", 0, "spearman", { x: 8, y: 7 }, { hp: 10 }));
    const next = cycle(state);
    expect(next.units.find((u) => u.id === "wounded")!.hp).toBe(14);
  });

  it("治癒: 隣接する味方の毒を治療する(そのターンは回復しない)", () => {
    const state = newMatch();
    state.units.push(makeUnit("curer", 0, "elvish_shaman", { x: 8, y: 6 }));
    state.units.push(
      makeUnit("sick", 0, "spearman", { x: 8, y: 7 }, { hp: 20, poisoned: true }),
    );
    const next = cycle(state);
    const sick = next.units.find((u) => u.id === "sick")!;
    expect(sick.poisoned).toBe(false);
    expect(sick.hp).toBe(20);
  });

  it("再生: 毎ターン8回復。毒なら治療する", () => {
    const state = newMatch();
    state.units.push(makeUnit("troll1", 0, "troll_whelp", { x: 8, y: 6 }, { hp: 10 }));
    state.units.push(
      makeUnit("troll2", 0, "troll", { x: 10, y: 6 }, { hp: 30, poisoned: true }),
    );
    const next = cycle(state);
    expect(next.units.find((u) => u.id === "troll1")!.hp).toBe(18);
    const troll2 = next.units.find((u) => u.id === "troll2")!;
    expect(troll2.poisoned).toBe(false);
    expect(troll2.hp).toBe(30);
  });

  it("回復源は加算されず最大値のみ(村8+回復+8でも8)", () => {
    const state = newMatch();
    state.villageOwners["6,3"] = 0;
    state.units.push(makeUnit("healer", 0, "white_mage", { x: 6, y: 4 })); // 村(6,3)の隣
    state.units.push(makeUnit("wounded", 0, "spearman", { x: 6, y: 3 }, { hp: 10 }));
    const next = cycle(state);
    expect(next.units.find((u) => u.id === "wounded")!.hp).toBe(18);
  });
});

describe("伏兵(ambush)・潜水(submerge)の可視判定", () => {
  // 現ロースターにambush/submerge持ちがいない(「特性・能力を単純に保つ」方針で、
  // 説明が増える能力はデータから意図的に外している。エンジン実装は残す)ため、
  // elvish_scout=伏兵 / skeleton=潜水 を一時パッチしてルール自体を検証する
  let restoreAmbush: () => void;
  let restoreSubmerge: () => void;
  beforeAll(() => {
    restoreAmbush = patchUnitDef("elvish_scout", (def) => {
      def.abilities = ["ambush"];
    });
    restoreSubmerge = patchUnitDef("skeleton", (def) => {
      def.abilities = ["submerge"];
    });
  });
  afterAll(() => {
    restoreAmbush();
    restoreSubmerge();
  });

  it("森の伏兵は敵から見えない(自軍からは見える)", () => {
    const state = newMatch();
    state.units.push(makeUnit("ranger", 1, "elvish_scout", { x: 3, y: 4 })); // 森
    expect(isHiddenFrom(state.units.find((u) => u.id === "ranger")!, 0, state)).toBe(true);
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.units.some((u) => u.id === "ranger")).toBe(false);
    const forBob = filterStateForViewer(state, P1);
    expect(forBob.units.some((u) => u.id === "ranger")).toBe(true);
  });

  it("隣接されると見える", () => {
    const state = newMatch();
    state.units.push(makeUnit("ranger", 1, "elvish_scout", { x: 3, y: 4 }));
    state.units.push(makeUnit("scout", 0, "spearman", { x: 4, y: 4 })); // 隣接
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.units.some((u) => u.id === "ranger")).toBe(true);
  });

  it("攻撃した後(attacksLeft=0)は見える", () => {
    const state = newMatch();
    const ranger = makeUnit("ranger", 1, "elvish_scout", { x: 3, y: 4 });
    ranger.attacksLeft = 0;
    state.units.push(ranger);
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.units.some((u) => u.id === "ranger")).toBe(true);
  });

  it("深海のスケルトンは敵から見えない", () => {
    const state = newMatch();
    state.units.push(makeUnit("lurker", 1, "skeleton", { x: 6, y: 5 })); // 深海
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.units.some((u) => u.id === "lurker")).toBe(false);
  });

  it("森にいても伏兵能力がなければ見える", () => {
    const state = newMatch();
    state.units.push(makeUnit("visible", 1, "elvish_fighter", { x: 3, y: 4 })); // 森
    const forAlice = filterStateForViewer(state, P0);
    expect(forAlice.units.some((u) => u.id === "visible")).toBe(true);
  });

  it("隠れた敵のヘックスへ移動しようとすると手前で停止する(発覚)", () => {
    const state = newMatch();
    // (5,4)からはレンジャー(3,4)は見えない(隣接していない)。目的地に敵が潜んでいる
    state.units.push(makeUnit("ranger", 1, "elvish_scout", { x: 3, y: 4 }));
    state.units.push(makeUnit("mover", 0, "spearman", { x: 5, y: 4 }));
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "move", unitId: "mover", target: { x: 3, y: 4 } },
      rng0,
    );
    // 目的地には到達できず、途中(レンジャーのZOC)で停止する
    const mover = next.units.find((u) => u.id === "mover")!;
    expect(mover.pos).not.toEqual({ x: 3, y: 4 });
    expect(mover.movesLeft).toBe(0);
    expect(events.some((e) => e.type === "moveInterrupted")).toBe(true);
  });

  it("経路の途中で隠れユニットのZOCに入るとそこで移動終了する", () => {
    const state = newMatch();
    // 森(1,5)に隠れたレンジャー。x=0列を北上する経路(唯一の最短路)が(0,6)でZOCに触れる
    state.units.push(makeUnit("ranger", 1, "elvish_scout", { x: 1, y: 5 }));
    state.units.push(
      makeUnit("mover", 0, "spearman", { x: 0, y: 7 }, { movesLeft: 4 }),
    );
    const { state: next, events } = applyAction(
      state,
      P0,
      { type: "move", unitId: "mover", target: { x: 0, y: 3 } },
      rng0,
    );
    const mover = next.units.find((u) => u.id === "mover")!;
    expect(mover.pos).toEqual({ x: 0, y: 6 }); // 目的地(0,3)には届かない
    expect(mover.movesLeft).toBe(0);
    expect(events.some((e) => e.type === "moveInterrupted")).toBe(true);
    // 停止位置は隠れユニットに隣接しているため、以後は相手が見える(発覚)
    const forAlice = filterStateForViewer(next, P0);
    expect(forAlice.units.some((u) => u.id === "ranger")).toBe(true);
  });
});
