// チュートリアルのガイド発火判定と、シナリオデータの整合性のテスト
import { describe, expect, it } from "vitest";
import { getUnitDef } from "../src/data/factions";
import { mapById, inBounds } from "../src/data/maps";
import { TUTORIALS } from "../src/data/tutorials";
import { createInitialState } from "../src/engine";
import { firedGuides, guideTriggered } from "../src/tutorial";
import type {
  MatchState,
  TutorialGuide,
  TutorialScript,
  UnitState,
} from "../src/types";

const rng0 = () => 0;

function newMatch(): MatchState {
  return createInitialState(
    {
      players: [
        { userId: "human", factionId: "loyalists" },
        { userId: "cpu", factionId: "northerners" },
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
  pos: { x: number; y: number },
): UnitState {
  const def = getUnitDef("spearman");
  const unit: UnitState = {
    id,
    unitDefId: def.id,
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

const turnGuide: TutorialGuide = {
  id: "g-turn",
  trigger: { type: "turn", turnNumber: 2 },
  text: "ターン2のガイド",
};

const hexGuide: TutorialGuide = {
  id: "g-hex",
  trigger: { type: "hex", hexes: [{ x: 6, y: 3 }, { x: 3, y: 6 }] },
  text: "村のガイド",
};

describe("guideTriggered", () => {
  it("turnトリガー: 指定ターン以降の自分の手番でのみ発火する", () => {
    const state = newMatch();
    expect(guideTriggered(turnGuide, state, 0)).toBe(false); // ターン1
    state.turnNumber = 2;
    expect(guideTriggered(turnGuide, state, 0)).toBe(true);
    state.turnNumber = 3; // 取りこぼし防止: 指定ターンを過ぎていても発火する(>=)
    expect(guideTriggered(turnGuide, state, 0)).toBe(true);
    state.activePlayer = 1; // 相手(CPU)の手番中は発火しない
    expect(guideTriggered(turnGuide, state, 0)).toBe(false);
  });

  it("hexトリガー: 自軍ユニットが指定ヘックスに乗ったときだけ発火する", () => {
    const state = newMatch();
    expect(guideTriggered(hexGuide, state, 0)).toBe(false);
    pushUnit(state, "enemy-on-hex", 1, { x: 6, y: 3 }); // 敵が乗っても発火しない
    expect(guideTriggered(hexGuide, state, 0)).toBe(false);
    pushUnit(state, "mine", 0, { x: 3, y: 6 }); // 自軍がいずれかのヘックスに乗ると発火
    expect(guideTriggered(hexGuide, state, 0)).toBe(true);
  });
});

describe("firedGuides", () => {
  it("表示済みIDを除いた発火中ガイドを定義順で返す", () => {
    const script: TutorialScript = {
      id: "t",
      name: "t",
      mapId: "valley_crossing",
      playerFactionId: "loyalists",
      cpuFactionId: "undead",
      guides: [turnGuide, hexGuide],
    };
    const state = newMatch();
    state.turnNumber = 2;
    pushUnit(state, "mine", 0, { x: 6, y: 3 });
    expect(firedGuides(script, state, 0, new Set()).map((g) => g.id)).toEqual([
      "g-turn",
      "g-hex",
    ]);
    expect(
      firedGuides(script, state, 0, new Set(["g-turn"])).map((g) => g.id),
    ).toEqual(["g-hex"]);
    expect(firedGuides(script, state, 0, new Set(["g-turn", "g-hex"]))).toEqual([]);
  });
});

describe("チュートリアルデータの整合性", () => {
  it("全シナリオ: マップ・陣営が実在し、トリガー/ハイライトのヘックスが盤内にある", () => {
    // ロード時バリデーション(data/tutorials.ts)を通過している時点でほぼ保証されるが、
    // データ追加時の目印としてここでも明示的に検証する
    for (const script of Object.values(TUTORIALS)) {
      const map = mapById(script.mapId);
      expect(script.guides.length).toBeGreaterThan(0);
      for (const guide of script.guides) {
        const hexes = [
          ...(guide.trigger.type === "hex" ? guide.trigger.hexes : []),
          ...(guide.highlightHexes ?? []),
        ];
        for (const h of hexes) {
          expect(inBounds(map, h)).toBe(true);
        }
      }
    }
  });

  it("初期盤面がシナリオ設定どおりに作れる(陣営・リーダーの検証を兼ねる)", () => {
    for (const script of Object.values(TUTORIALS)) {
      const state = createInitialState(
        {
          players: [
            {
              userId: "human",
              factionId: script.playerFactionId,
              leaderUnitId: script.playerLeaderUnitId,
            },
            { userId: "cpu", factionId: script.cpuFactionId },
          ],
          mapId: script.mapId,
          fog: script.fog,
        },
        rng0,
      );
      expect(state.units).toHaveLength(2);
    }
  });
});
