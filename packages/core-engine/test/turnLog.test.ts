// 相手ターンログ(索敵・雇用・被攻撃・昇格・自軍の回復/毒)のテスト
import { describe, expect, it } from "vitest";
import { createInitialState, type GameEvent } from "../src/engine";
import { getUnitDef } from "../src/data/factions";
import { hexNeighbors } from "../src/hex";
import { computeTurnLog, type TurnLogStep } from "../src/turnLog";
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
): UnitState {
  const def = getUnitDef(unitDefId);
  const unit: UnitState = {
    id,
    unitDefId,
    owner,
    pos,
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
  state.units.push(unit);
  return unit;
}

describe("computeTurnLog: 索敵", () => {
  it("霧越しに視界へ入った敵はspottedとして記録される", () => {
    const before = newMatch(true);
    pushUnit(before, "skeleton1", 1, "orcish_grunt", { x: 2, y: 9 }); // aliceリーダー(2,2)から距離7・視界外

    const afterMove = structuredClone(before);
    afterMove.units.find((u) => u.id === "skeleton1")!.pos = { x: 2, y: 8 }; // 距離6・視界内

    const steps: TurnLogStep[] = [
      {
        turnVersion: before.turnVersion + 1,
        state: afterMove,
        events: [
          {
            type: "moved",
            unitId: "skeleton1",
            from: { x: 2, y: 9 },
            to: { x: 2, y: 8 },
            path: [{ x: 2, y: 9 }, { x: 2, y: 8 }],
          },
        ],
      },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([
      {
        id: `spotted#skeleton1#${before.turnVersion + 1}`,
        type: "spotted",
        atVersion: before.turnVersion + 1,
        unitId: "skeleton1",
        unitDefId: "orcish_grunt",
        pos: { x: 2, y: 8 },
      },
    ]);
  });

  it("一瞬だけ見えて再び視界外に戻った場合でも記録される(最終状態だけの差分では消える情報)", () => {
    const before = newMatch(true);
    pushUnit(before, "skeleton1", 1, "orcish_grunt", { x: 2, y: 9 });

    const flashSeen = structuredClone(before);
    flashSeen.units.find((u) => u.id === "skeleton1")!.pos = { x: 2, y: 8 }; // 視界内

    const backToHidden = structuredClone(flashSeen);
    backToHidden.units.find((u) => u.id === "skeleton1")!.pos = { x: 2, y: 9 }; // 視界外に戻る

    const steps: TurnLogStep[] = [
      {
        turnVersion: before.turnVersion + 1,
        state: flashSeen,
        events: [],
      },
      {
        turnVersion: before.turnVersion + 2,
        state: backToHidden,
        events: [],
      },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: "spotted", unitId: "skeleton1" });
  });

  it("同じユニットは同じ相手ターン内で2回記録されない", () => {
    const before = newMatch(true);
    pushUnit(before, "skeleton1", 1, "orcish_grunt", { x: 2, y: 9 });

    const seen = structuredClone(before);
    seen.units.find((u) => u.id === "skeleton1")!.pos = { x: 2, y: 8 };
    const hiddenAgain = structuredClone(seen);
    hiddenAgain.units.find((u) => u.id === "skeleton1")!.pos = { x: 2, y: 9 };
    const seenAgain = structuredClone(hiddenAgain);
    seenAgain.units.find((u) => u.id === "skeleton1")!.pos = { x: 2, y: 8 };

    const steps: TurnLogStep[] = [
      { turnVersion: 1, state: seen, events: [] },
      { turnVersion: 2, state: hiddenAgain, events: [] },
      { turnVersion: 3, state: seenAgain, events: [] },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toHaveLength(1);
    expect(entries[0].atVersion).toBe(1);
  });
});

describe("computeTurnLog: 被攻撃", () => {
  it("自分のユニットが攻撃されたらattackedとして記録される", () => {
    const before = newMatch(false);
    pushUnit(before, "guard1", 0, "spearman", { x: 10, y: 5 });
    pushUnit(before, "skeleton1", 1, "orcish_grunt", { x: 10, y: 4 });

    const afterAttack = structuredClone(before);
    const attackEvent: GameEvent = {
      type: "combat",
      attackerId: "skeleton1",
      defenderId: "guard1",
      attackerAttack: getUnitDef("orcish_grunt").attacks[0],
      result: {
        strikes: [],
        rounds: 1,
        attackerHpAfter: 34,
        defenderHpAfter: 30,
        attackerDied: false,
        defenderDied: false,
        attackerPoisoned: false,
        defenderPoisoned: false,
        attackerSlowed: false,
        defenderSlowed: false,
        retaliationAttack: null,
      },
    };

    const steps: TurnLogStep[] = [
      { turnVersion: 1, state: afterAttack, events: [attackEvent] },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([
      {
        id: "attacked#1#0",
        type: "attacked",
        atVersion: 1,
        attackerId: "skeleton1",
        attackerUnitDefId: "orcish_grunt",
        attackerPos: { x: 10, y: 4 },
        defenderId: "guard1",
        defenderUnitDefId: "spearman",
        defenderPos: { x: 10, y: 5 },
        attackerAttack: attackEvent.attackerAttack,
        result: attackEvent.result,
        // リプレイ用の縮小DTO(戦闘前スナップショット)。周辺2hexに他ユニットはいない
        replay: {
          attacker: {
            unitDefId: "orcish_grunt",
            owner: 1,
            pos: { x: 10, y: 4 },
            hp: getUnitDef("orcish_grunt").hp,
            maxHp: getUnitDef("orcish_grunt").hp,
          },
          defender: {
            unitDefId: "spearman",
            owner: 0,
            pos: { x: 10, y: 5 },
            hp: getUnitDef("spearman").hp,
            maxHp: getUnitDef("spearman").hp,
          },
          bystanders: [],
        },
      },
    ]);
  });

  it("リプレイの書き割りは防御側から距離2以内のみ・3フィールドの縮小DTOになる", () => {
    const before = newMatch(false);
    pushUnit(before, "guard1", 0, "spearman", { x: 10, y: 5 });
    pushUnit(before, "skeleton1", 1, "orcish_grunt", { x: 10, y: 4 });
    pushUnit(before, "near-ally", 0, "bowman", { x: 9, y: 5 }); // 距離1 → 含まれる
    pushUnit(before, "near-enemy", 1, "orcish_assassin", { x: 10, y: 7 }); // 距離2 → 含まれる
    pushUnit(before, "far-away", 1, "wolf_rider", { x: 10, y: 9 }); // 距離4 → 含まれない

    const afterAttack = structuredClone(before);
    const attackEvent: GameEvent = {
      type: "combat",
      attackerId: "skeleton1",
      defenderId: "guard1",
      attackerAttack: getUnitDef("orcish_grunt").attacks[0],
      result: {
        strikes: [],
        rounds: 1,
        attackerHpAfter: 34,
        defenderHpAfter: 30,
        attackerDied: false,
        defenderDied: false,
        attackerPoisoned: false,
        defenderPoisoned: false,
        attackerSlowed: false,
        defenderSlowed: false,
        retaliationAttack: null,
      },
    };
    const entries = computeTurnLog(
      before,
      [{ turnVersion: 1, state: afterAttack, events: [attackEvent] }],
      P0,
    );
    const attacked = entries.find((e) => e.type === "attacked");
    expect(attacked?.type).toBe("attacked");
    if (attacked?.type !== "attacked") return;
    expect(attacked.replay?.bystanders).toEqual([
      { unitDefId: "bowman", owner: 0, pos: { x: 9, y: 5 } },
      { unitDefId: "orcish_assassin", owner: 1, pos: { x: 10, y: 7 } },
    ]);
  });

  it("霧で見えていないユニットはリプレイの書き割りに含まれない(情報漏れ防止)", () => {
    const before = newMatch(true); // 霧あり
    // リーダー(視界6)の届かない場所に舞台を作り、guardの視界を距離1に絞る
    const guard = pushUnit(before, "guard1", 0, "spearman", { x: 10, y: 5 });
    guard.maxMoves = 1;
    pushUnit(before, "skeleton1", 1, "orcish_grunt", { x: 10, y: 4 });
    // 距離2 = 書き割りの範囲内だが、霧で閲覧者からは見えていない
    pushUnit(before, "lurker", 1, "orcish_assassin", { x: 10, y: 7 });

    const afterAttack = structuredClone(before);
    const attackEvent: GameEvent = {
      type: "combat",
      attackerId: "skeleton1",
      defenderId: "guard1",
      attackerAttack: getUnitDef("orcish_grunt").attacks[0],
      result: {
        strikes: [],
        rounds: 1,
        attackerHpAfter: 34,
        defenderHpAfter: 30,
        attackerDied: false,
        defenderDied: false,
        attackerPoisoned: false,
        defenderPoisoned: false,
        attackerSlowed: false,
        defenderSlowed: false,
        retaliationAttack: null,
      },
    };
    const entries = computeTurnLog(
      before,
      [{ turnVersion: 1, state: afterAttack, events: [attackEvent] }],
      P0,
    );
    const attacked = entries.find((e) => e.type === "attacked");
    if (attacked?.type !== "attacked") throw new Error("attackedエントリがない");
    expect(attacked.replay?.bystanders).toEqual([]);
  });

  it("相手ユニット同士の攻撃(あり得ないはずだが)や自軍の攻撃はattackedに含まれない", () => {
    const before = newMatch(false);
    pushUnit(before, "mine", 0, "spearman", { x: 5, y: 5 });
    pushUnit(before, "enemy", 1, "orcish_grunt", { x: 6, y: 5 });

    const afterAttack = structuredClone(before);
    // 自分のユニットが攻撃した側(=自分のターンの出来事。相手ターンログには出さない)
    const attackEvent: GameEvent = {
      type: "combat",
      attackerId: "mine",
      defenderId: "enemy",
      attackerAttack: getUnitDef("spearman").attacks[0],
      result: {
        strikes: [],
        rounds: 1,
        attackerHpAfter: 40,
        defenderHpAfter: 20,
        attackerDied: false,
        defenderDied: false,
        attackerPoisoned: false,
        defenderPoisoned: false,
        attackerSlowed: false,
        defenderSlowed: false,
        retaliationAttack: null,
      },
    };
    const steps: TurnLogStep[] = [
      { turnVersion: 1, state: afterAttack, events: [attackEvent] },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([]);
  });
});

describe("computeTurnLog: 索敵と被攻撃の紐付け", () => {
  it("視界外から現れて攻撃してきたユニットは、spottedにfollowedByAttackIdが付く", () => {
    const before = newMatch(true);
    const guard = pushUnit(before, "guard1", 0, "spearman", { x: 10, y: 5 });
    guard.maxMoves = 3; // 視界を狭く固定(離れた場所から現れたことにするため)
    pushUnit(before, "skeleton1", 1, "orcish_grunt", { x: 15, y: 11 }); // guardからもリーダーからも遠い

    const adjacentToGuard = hexNeighbors(guard.pos)[0];
    const afterMove = structuredClone(before);
    afterMove.units.find((u) => u.id === "skeleton1")!.pos = adjacentToGuard;

    const afterAttack = structuredClone(afterMove);
    const attackEvent: GameEvent = {
      type: "combat",
      attackerId: "skeleton1",
      defenderId: "guard1",
      attackerAttack: getUnitDef("orcish_grunt").attacks[0],
      result: {
        strikes: [],
        rounds: 1,
        attackerHpAfter: 34,
        defenderHpAfter: 30,
        attackerDied: false,
        defenderDied: false,
        attackerPoisoned: false,
        defenderPoisoned: false,
        attackerSlowed: false,
        defenderSlowed: false,
        retaliationAttack: null,
      },
    };

    const steps: TurnLogStep[] = [
      { turnVersion: 11, state: afterMove, events: [] },
      { turnVersion: 12, state: afterAttack, events: [attackEvent] },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toHaveLength(2);
    const [spotted, attacked] = entries;
    expect(spotted).toMatchObject({
      type: "spotted",
      unitId: "skeleton1",
      atVersion: 11,
    });
    expect(attacked).toMatchObject({
      type: "attacked",
      attackerId: "skeleton1",
      defenderId: "guard1",
      atVersion: 12,
    });
    expect(spotted).toMatchObject({ followedByAttackId: attacked.id });
  });

  it("最初から見えていたユニットが攻撃してきた場合はfollowedByAttackIdを持つspottedは生成されない", () => {
    const before = newMatch(false);
    pushUnit(before, "guard1", 0, "spearman", { x: 5, y: 5 });
    pushUnit(before, "skeleton1", 1, "orcish_grunt", { x: 6, y: 5 }); // 最初から隣接=見えている

    const afterAttack = structuredClone(before);
    const attackEvent: GameEvent = {
      type: "combat",
      attackerId: "skeleton1",
      defenderId: "guard1",
      attackerAttack: getUnitDef("orcish_grunt").attacks[0],
      result: {
        strikes: [],
        rounds: 1,
        attackerHpAfter: 34,
        defenderHpAfter: 30,
        attackerDied: false,
        defenderDied: false,
        attackerPoisoned: false,
        defenderPoisoned: false,
        attackerSlowed: false,
        defenderSlowed: false,
        retaliationAttack: null,
      },
    };
    const steps: TurnLogStep[] = [
      { turnVersion: 1, state: afterAttack, events: [attackEvent] },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([
      expect.objectContaining({ type: "attacked", attackerId: "skeleton1" }),
    ]);
  });
});

describe("computeTurnLog: 新規出現(雇用等)", () => {
  it("視界内で新しく雇用されたユニットはrecruitedとして記録される(spottedと区別)", () => {
    const before = newMatch(false);
    const afterRecruit = structuredClone(before);
    pushUnit(afterRecruit, "newSkeleton", 1, "orcish_grunt", { x: 3, y: 3 });

    const steps: TurnLogStep[] = [
      {
        turnVersion: before.turnVersion + 1,
        state: afterRecruit,
        events: [{ type: "recruited", unit: afterRecruit.units.at(-1)! }],
      },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([
      {
        id: `recruited#newSkeleton#${before.turnVersion + 1}`,
        type: "recruited",
        atVersion: before.turnVersion + 1,
        unitId: "newSkeleton",
        unitDefId: "orcish_grunt",
        pos: { x: 3, y: 3 },
      },
    ]);
  });

  it("(フォールバック)雇用イベントを伴わずに新規ユニットが現れた場合はspottedとして記録される", () => {
    const before = newMatch(false);
    const afterSpawn = structuredClone(before);
    pushUnit(afterSpawn, "revived", 1, "orcish_grunt", { x: 3, y: 3 });

    const steps: TurnLogStep[] = [
      {
        turnVersion: before.turnVersion + 1,
        state: afterSpawn,
        events: [{ type: "plagueSpawned", unit: afterSpawn.units.at(-1)! }],
      },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([
      {
        id: `spotted#revived#${before.turnVersion + 1}`,
        type: "spotted",
        atVersion: before.turnVersion + 1,
        unitId: "revived",
        unitDefId: "orcish_grunt",
        pos: { x: 3, y: 3 },
      },
    ]);
  });
});

describe("computeTurnLog: 昇格", () => {
  it("見えている敵ユニットの昇格はleveledUpとして記録される", () => {
    const before = newMatch(false);
    pushUnit(before, "enemy1", 1, "orcish_grunt", { x: 10, y: 5 }); // 深海/森ではない(潜水判定の副作用を避ける)

    const afterLevelUp = structuredClone(before);
    const enemy = afterLevelUp.units.find((u) => u.id === "enemy1")!;
    enemy.unitDefId = "orcish_warrior"; // 実際の昇格先IDは重要でないので適当な別defIdで代用

    const steps: TurnLogStep[] = [
      {
        turnVersion: before.turnVersion + 1,
        state: afterLevelUp,
        events: [
          {
            type: "levelUp",
            unitId: "enemy1",
            fromDefId: "orcish_grunt",
            toDefId: "orcish_warrior",
            amla: false,
          },
        ],
      },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([
      {
        id: `leveledUp#${before.turnVersion + 1}#0`,
        type: "leveledUp",
        atVersion: before.turnVersion + 1,
        unitId: "enemy1",
        fromDefId: "orcish_grunt",
        toDefId: "orcish_warrior",
        amla: false,
        pos: { x: 10, y: 5 },
      },
    ]);
  });

  it("霧で隠れている敵ユニットの昇格は記録されない(情報漏洩防止)", () => {
    const before = newMatch(true);
    pushUnit(before, "enemy1", 1, "orcish_grunt", { x: 15, y: 11 }); // aliceリーダーから遠く、視界外

    const afterLevelUp = structuredClone(before);
    afterLevelUp.units.find((u) => u.id === "enemy1")!.unitDefId = "orcish_warrior";

    const steps: TurnLogStep[] = [
      {
        turnVersion: before.turnVersion + 1,
        state: afterLevelUp,
        events: [
          {
            type: "levelUp",
            unitId: "enemy1",
            fromDefId: "orcish_grunt",
            toDefId: "orcish_warrior",
            amla: false,
          },
        ],
      },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([]);
  });

  it("自軍ユニットの昇格はleveledUpに含まれない", () => {
    const before = newMatch(false);
    pushUnit(before, "mine", 0, "spearman", { x: 5, y: 5 });

    const afterLevelUp = structuredClone(before);
    afterLevelUp.units.find((u) => u.id === "mine")!.unitDefId = "lieutenant";

    const steps: TurnLogStep[] = [
      {
        turnVersion: 1,
        state: afterLevelUp,
        events: [
          { type: "levelUp", unitId: "mine", fromDefId: "spearman", toDefId: "lieutenant", amla: false },
        ],
      },
    ];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([]);
  });
});

describe("computeTurnLog: 自軍の回復・毒(相手のendTurnで発生)", () => {
  it("自軍ユニットのhealedイベントは記録される", () => {
    const before = newMatch(false);
    pushUnit(before, "mine", 0, "spearman", { x: 5, y: 5 });

    const after = structuredClone(before);
    const healEvent: GameEvent = {
      type: "healed",
      unitId: "mine",
      amount: 8,
      source: "village",
    };
    const steps: TurnLogStep[] = [{ turnVersion: 1, state: after, events: [healEvent] }];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([
      {
        id: "healed#1#0",
        type: "healed",
        atVersion: 1,
        unitId: "mine",
        unitDefId: "spearman",
        amount: 8,
        source: "village",
        pos: { x: 5, y: 5 },
      },
    ]);
  });

  it("敵ユニットのhealedイベントは記録されない(自軍のみ対象)", () => {
    const before = newMatch(false);
    pushUnit(before, "enemy", 1, "orcish_grunt", { x: 5, y: 5 });

    const after = structuredClone(before);
    const healEvent: GameEvent = {
      type: "healed",
      unitId: "enemy",
      amount: 8,
      source: "village",
    };
    const steps: TurnLogStep[] = [{ turnVersion: 1, state: after, events: [healEvent] }];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([]);
  });

  it("自軍ユニットのpoisonDamageイベントは記録される", () => {
    const before = newMatch(false);
    pushUnit(before, "mine", 0, "spearman", { x: 5, y: 5 });

    const after = structuredClone(before);
    const poisonEvent: GameEvent = { type: "poisonDamage", unitId: "mine", amount: 8 };
    const steps: TurnLogStep[] = [{ turnVersion: 1, state: after, events: [poisonEvent] }];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([
      {
        id: "poisonDamage#1#0",
        type: "poisonDamage",
        atVersion: 1,
        unitId: "mine",
        unitDefId: "spearman",
        amount: 8,
        pos: { x: 5, y: 5 },
      },
    ]);
  });

  it("敵ユニットのpoisonDamageイベントは記録されない(自軍のみ対象)", () => {
    const before = newMatch(false);
    pushUnit(before, "enemy", 1, "orcish_grunt", { x: 5, y: 5 });

    const after = structuredClone(before);
    const poisonEvent: GameEvent = { type: "poisonDamage", unitId: "enemy", amount: 8 };
    const steps: TurnLogStep[] = [{ turnVersion: 1, state: after, events: [poisonEvent] }];

    const entries = computeTurnLog(before, steps, P0);
    expect(entries).toEqual([]);
  });
});
