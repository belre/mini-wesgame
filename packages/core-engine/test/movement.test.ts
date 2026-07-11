import { describe, expect, it } from "vitest";
import { patchUnitDef } from "./defPatch";
import { hexDistance, hexKey } from "../src/hex";
import { canMoveTo, computeReachable, moveCostFor, reconstructPath } from "../src/movement";
import { getUnitDef } from "../src/data/factions";
import { IMPASSABLE, terrainById } from "../src/data/terrain";
import type { GameMap, TraitId, UnitState } from "../src/types";

function flatMap(width: number, height: number, tiles?: string[]): GameMap {
  return {
    id: "test",
    name: "テスト",
    width,
    height,
    tiles: tiles ?? Array(height).fill("g".repeat(width)),
  };
}

function makeUnit(
  id: string,
  owner: number,
  pos: { x: number; y: number },
  unitDefId = "spearman",
  movesLeft?: number,
  slowed?: boolean,
  traits: TraitId[] = [],
): UnitState {
  const def = getUnitDef(unitDefId);
  return {
    id,
    unitDefId,
    owner,
    pos,
    hp: def.hp,
    maxHp: def.hp,
    movesLeft: movesLeft ?? def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: false,
    traits,
    poisoned: false,
    slowed,
    xp: 0,
  };
}

describe("computeReachable", () => {
  it("開けた草原では移動力=ヘックス距離ぶん届く", () => {
    const map = flatMap(12, 12);
    const unit = makeUnit("u1", 0, { x: 5, y: 5 }); // 槍兵: 移動力5
    const reachable = computeReachable({
      unit,
      unitDef: getUnitDef("spearman"),
      units: [unit],
      map,
    });
    for (const node of reachable.values()) {
      expect(hexDistance(unit.pos, node.coord)).toBeLessThanOrEqual(5);
    }
    // 距離5のヘックスに届く
    expect(reachable.has(hexKey({ x: 5, y: 0 }))).toBe(true);
    // 距離6には届かない
    expect(reachable.has(hexKey({ x: 5, y: 11 }))).toBe(false);
  });

  it("森は移動コスト2を消費する", () => {
    // x=1..2列を森にした横長マップ
    const map = flatMap(6, 3, ["gffggg", "gffggg", "gffggg"]);
    const unit = makeUnit("u1", 0, { x: 0, y: 1 }, "spearman", 2);
    const reachable = computeReachable({
      unit,
      unitDef: getUnitDef("spearman"),
      units: [unit],
      map,
    });
    // 森1マス目(コスト2)で移動力を使い切る
    const forest = reachable.get(hexKey({ x: 1, y: 1 }));
    expect(forest?.cost).toBe(2);
    expect(forest?.remaining).toBe(0);
    // 森2マス目には届かない
    expect(reachable.has(hexKey({ x: 2, y: 1 }))).toBe(false);
  });

  it("敵ユニットのヘックスには進入できない", () => {
    const map = flatMap(12, 12);
    const unit = makeUnit("u1", 0, { x: 2, y: 5 });
    const enemy = makeUnit("e1", 1, { x: 4, y: 5 });
    const reachable = computeReachable({
      unit,
      unitDef: getUnitDef("spearman"),
      units: [unit, enemy],
      map,
    });
    expect(reachable.has(hexKey(enemy.pos))).toBe(false);
  });

  it("ZOC: 敵隣接ヘックスに進入すると残り移動力が0になる", () => {
    const map = flatMap(12, 12);
    const unit = makeUnit("u1", 0, { x: 2, y: 5 });
    const enemy = makeUnit("e1", 1, { x: 5, y: 5 });
    const reachable = computeReachable({
      unit,
      unitDef: getUnitDef("spearman"),
      units: [unit, enemy],
      map,
    });
    // (4,5) は敵(5,5)の隣接 = ZOCヘックス
    const zocNode = reachable.get(hexKey({ x: 4, y: 5 }));
    expect(zocNode).toBeDefined();
    expect(zocNode!.remaining).toBe(0);
    expect(zocNode!.canStop).toBe(true);
  });

  it("小物(no_zoc): レベル0の敵はZOCを発しない(隣接を通過しても移動力が残る)", () => {
    // mini: Lv0ユニットが陣営削減で消えたためlevelをpatchして検証
    const restoreLv0 = patchUnitDef("orcish_grunt", (d) => {
      d.level = 0;
    });
    const map = flatMap(12, 12);
    const unit = makeUnit("u1", 0, { x: 2, y: 5 });
    // ゾンビ(lv0)。traitsにno_zocは保存しない — effectiveTraitsの暗黙付与で効くことの検証
    const corpse = makeUnit("e1", 1, { x: 5, y: 5 }, "orcish_grunt", undefined, undefined, [
      "undead",
    ]);
    const reachable = computeReachable({
      unit,
      unitDef: getUnitDef("spearman"),
      units: [unit, corpse],
      map,
    });
    // (4,5) は敵(5,5)の隣接だが、小物なので打ち切られない(距離2=コスト2、残り3)
    const node = reachable.get(hexKey({ x: 4, y: 5 }));
    expect(node).toBeDefined();
    expect(node!.remaining).toBe(3);
    // 敵の隣接を通り抜けて反対側(6,5)にも届く(敵ヘックス自体は進入不可のまま)
    expect(reachable.has(hexKey({ x: 6, y: 5 }))).toBe(true);
    expect(reachable.has(hexKey(corpse.pos))).toBe(false);
    restoreLv0();
  });

  it("味方ユニットは通過できるが停止はできない", () => {
    const map = flatMap(12, 12);
    const unit = makeUnit("u1", 0, { x: 2, y: 5 });
    const ally = makeUnit("a1", 0, { x: 3, y: 5 });
    const reachable = computeReachable({
      unit,
      unitDef: getUnitDef("spearman"),
      units: [unit, ally],
      map,
    });
    const allyNode = reachable.get(hexKey(ally.pos));
    expect(allyNode).toBeDefined();
    expect(allyNode!.canStop).toBe(false);
    expect(canMoveTo(reachable, ally.pos)).toBe(false);
    // 味方の先のヘックスには到達できる
    expect(canMoveTo(reachable, { x: 4, y: 5 })).toBe(true);
  });

  it("経路復元: 始点から終点まで連続した隣接ヘックス列を返す", () => {
    const map = flatMap(12, 12);
    const unit = makeUnit("u1", 0, { x: 2, y: 5 });
    const reachable = computeReachable({
      unit,
      unitDef: getUnitDef("spearman"),
      units: [unit],
      map,
    });
    const path = reconstructPath(reachable, { x: 6, y: 5 })!;
    expect(path[0]).toEqual({ x: 2, y: 5 });
    expect(path[path.length - 1]).toEqual({ x: 6, y: 5 });
    for (let i = 1; i < path.length; i++) {
      expect(hexDistance(path[i - 1], path[i])).toBe(1);
    }
  });

  it("遅化状態のユニットは移動コストが2倍になる", () => {
    const map = flatMap(12, 12);
    const unit = makeUnit("u1", 0, { x: 5, y: 5 }, "spearman", 5, true);
    const reachable = computeReachable({
      unit,
      unitDef: getUnitDef("spearman"),
      units: [unit],
      map,
    });
    // 通常なら距離2のコストは2だが、遅化で2倍の4になる
    expect(reachable.get(hexKey({ x: 5, y: 3 }))?.cost).toBe(4);
    // 移動力5では距離3(コスト6相当)まで届かない
    expect(reachable.has(hexKey({ x: 5, y: 2 }))).toBe(false);
  });

  it("飛行ユニットは岩場(歩行不可)もコスト1で越える", () => {
    // mini: 飛行ユニットが陣営削減で消えたため、狼をflyにpatchして検証
    const restore = patchUnitDef("wolf_rider", (d) => {
      d.movement = { type: "fly", points: 8 };
    });
    try {
      const map = flatMap(6, 3, ["gmmggg", "gmmggg", "gmmggg"]);
      const unit = makeUnit("u1", 0, { x: 0, y: 1 }, "wolf_rider", 3);
      const reachable = computeReachable({
        unit,
        unitDef: getUnitDef("wolf_rider"),
        units: [unit],
        map,
      });
      expect(reachable.get(hexKey({ x: 1, y: 1 }))?.cost).toBe(1);
      expect(reachable.get(hexKey({ x: 3, y: 1 }))?.cost).toBe(3);
    } finally {
      restore();
    }
  });
});

describe("moveCostFor: 騎馬(defenseType=cavalry)は移動コストも歩兵と別枠を参照する", () => {
  it("cavalrymanは森でコスト3(歩兵walkは2)。本家mounted準拠のユーザー実測値", () => {
    const cavalryman = getUnitDef("cavalryman");
    const spearman = getUnitDef("spearman");
    expect(cavalryman.defenseType).toBe("cavalry");
    expect(moveCostFor(cavalryman, terrainById("forest"))).toBe(3);
    expect(moveCostFor(spearman, terrainById("forest"))).toBe(2);
  });

  it("開けた地形(草原・村)では歩兵と同じコスト", () => {
    const cavalryman = getUnitDef("cavalryman");
    expect(moveCostFor(cavalryman, terrainById("grassland"))).toBe(1);
    expect(moveCostFor(cavalryman, terrainById("village"))).toBe(1);
  });
});

describe("軽装(defenseType: lightfoot。本家elusivefoot準拠 2026-07-08)", () => {
  it.each([
    ["orcish_nightblade", "northerners"],
    ["orcish_spy", "northerners"],
  ])("%s(%s陣営)は沼地・浅瀬を歩兵より速く渡る(コスト2)", (unitId) => {
    const unit = getUnitDef(unitId);
    expect(unit.defenseType).toBe("lightfoot");
    expect(moveCostFor(unit, terrainById("swamp"))).toBe(2);
    expect(moveCostFor(unit, terrainById("shallow_water"))).toBe(2);
    // 通常のwalk型ならコスト3(参考: spearman)
    expect(moveCostFor(getUnitDef("spearman"), terrainById("swamp"))).toBe(3);
  });

  it("岩場(mountains)は本家準拠でwalk/lightfootともコスト3。cavalryのみ不可", () => {
    const nightblade = getUnitDef("orcish_nightblade");
    expect(moveCostFor(nightblade, terrainById("mountains"))).toBe(3);
    expect(moveCostFor(getUnitDef("spearman"), terrainById("mountains"))).toBe(3);
    expect(moveCostFor(getUnitDef("cavalryman"), terrainById("mountains"))).toBe(IMPASSABLE);
  });
});
