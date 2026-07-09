// リプレイアダプタ(縮小DTO → CombatPlaybackInput)のテスト。
// core-engineのcomputeTurnLogが返すattackedエントリの形から、カットインが
// そのまま再生できる入力に復元できることを担保する
import { describe, expect, it } from "vitest";
import { getUnitDef, type TurnLogEntry } from "@parle-stroika/core-engine";
import { replayToPlayback } from "../src/lib/anim/replay";

function makeAttackedEntry(): Extract<TurnLogEntry, { type: "attacked" }> {
  const attack = getUnitDef("orcish_grunt").attacks[0];
  const retaliation = getUnitDef("spearman").attacks[0];
  return {
    id: "attacked#1#0",
    type: "attacked",
    atVersion: 1,
    attackerId: "sk1",
    attackerUnitDefId: "orcish_grunt",
    attackerPos: { x: 10, y: 4 },
    defenderId: "guard1",
    defenderUnitDefId: "spearman",
    defenderPos: { x: 10, y: 5 },
    attackerAttack: attack,
    result: {
      strikes: [
        { actor: "attacker", hit: true, damage: 7, targetHpAfter: 29 },
        { actor: "defender", hit: false, damage: 0, targetHpAfter: 34 },
      ],
      rounds: 1,
      attackerHpAfter: 34,
      defenderHpAfter: 29,
      attackerDied: false,
      defenderDied: false,
      attackerPoisoned: false,
      defenderPoisoned: false,
      attackerSlowed: false,
      defenderSlowed: false,
      retaliationAttack: retaliation,
    },
    replay: {
      attacker: { unitDefId: "orcish_grunt", owner: 1, pos: { x: 10, y: 4 }, hp: 34, maxHp: 34 },
      defender: { unitDefId: "spearman", owner: 0, pos: { x: 10, y: 5 }, hp: 36, maxHp: 36 },
      bystanders: [{ unitDefId: "bowman", owner: 0, pos: { x: 9, y: 5 } }],
    },
  };
}

describe("replayToPlayback", () => {
  it("縮小DTOから再生入力(CombatPlaybackInput)を復元する", () => {
    const input = replayToPlayback(makeAttackedEntry())!;
    expect(input).not.toBeNull();
    // 主役: 実idを使い、戦闘前HPが載る
    expect(input.attacker).toMatchObject({
      id: "sk1", unitDefId: "orcish_grunt", owner: 1, pos: { x: 10, y: 4 }, hp: 34, maxHp: 34,
    });
    expect(input.defender).toMatchObject({
      id: "guard1", unitDefId: "spearman", owner: 0, hp: 36, maxHp: 36,
    });
    // 打撃列・攻撃id(演出定義の解決キー)・反撃攻撃id
    expect(input.strikes).toHaveLength(2);
    expect(input.attackerAttackId).toBe(getUnitDef("orcish_grunt").attacks[0].id);
    expect(input.defenderAttackId).toBe(getUnitDef("spearman").attacks[0].id);
    // 書き割り: idは合成、HPはユニット定義から補完(バーは表示されないため任意)
    expect(input.bystanders).toHaveLength(1);
    expect(input.bystanders![0]).toMatchObject({
      id: "replay-b0", unitDefId: "bowman", owner: 0, pos: { x: 9, y: 5 },
    });
  });

  it("replayペイロードが無いエントリはnull(▶を出さない側の判定と一致)", () => {
    const entry = { ...makeAttackedEntry(), replay: undefined };
    expect(replayToPlayback(entry)).toBeNull();
  });
});
