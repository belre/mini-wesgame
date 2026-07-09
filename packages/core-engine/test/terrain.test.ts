import { describe, expect, it } from "vitest";
import { IMPASSABLE, TERRAIN_BY_CHAR, TERRAINS } from "../src/data/terrain";

describe("砂地(sand)", () => {
  it("定義と文字マッピングが存在する", () => {
    expect(TERRAINS.sand).toBeDefined();
    expect(TERRAIN_BY_CHAR.s).toBe("sand");
  });

  it("足場の悪い開けた地形: 歩行コスト2・歩兵防御30%・水棲は陸に這い上がれる(コスト2)", () => {
    expect(TERRAINS.sand.moveCost.walk).toBe(2);
    expect(TERRAINS.sand.moveCost.swim).toBe(2);
    expect(TERRAINS.sand.defenseBonus.walk).toBe(30);
    // 開けた地形なので森(50%)より明確に守りにくい
    expect(TERRAINS.sand.defenseBonus.walk).toBeLessThan(TERRAINS.forest.defenseBonus.walk);
  });
});

describe("砂漠(desert)", () => {
  it("定義と文字マッピングが存在し、砂地と同性能", () => {
    expect(TERRAINS.desert).toBeDefined();
    expect(TERRAIN_BY_CHAR.d).toBe("desert");
    expect(TERRAINS.desert.moveCost).toEqual(TERRAINS.sand.moveCost);
    expect(TERRAINS.desert.defenseBonus).toEqual(TERRAINS.sand.defenseBonus);
  });
});

describe("山(mountains)", () => {
  it("地上部隊は侵入不可、飛行のみ通行できる(深水の陸版)", () => {
    expect(TERRAINS.mountains.moveCost.walk).toBe(IMPASSABLE);
    expect(TERRAINS.mountains.moveCost.swim).toBe(IMPASSABLE);
    expect(TERRAINS.mountains.moveCost.fly).toBe(1);
  });
});

describe("トーチカ(tochka)", () => {
  it("防御陣地: 歩行2・歩兵防御50%・騎馬は移動4/防御20%(本家mounted準拠)", () => {
    expect(TERRAIN_BY_CHAR.t).toBe("tochka");
    expect(TERRAINS.tochka.moveCost.walk).toBe(2);
    expect(TERRAINS.tochka.defenseBonus.walk).toBe(50);
    expect(TERRAINS.tochka.moveCost.cavalry).toBe(4);
    expect(TERRAINS.tochka.defenseBonus.cavalry).toBe(20);
  });
});

describe("沼地(swamp)", () => {
  it("湿地: 歩行3・歩兵防御20%・水棲は移動1で防御60%", () => {
    expect(TERRAIN_BY_CHAR.n).toBe("swamp");
    expect(TERRAINS.swamp.moveCost.walk).toBe(3);
    expect(TERRAINS.swamp.moveCost.swim).toBe(1);
    expect(TERRAINS.swamp.defenseBonus.walk).toBe(20);
    expect(TERRAINS.swamp.defenseBonus.swim).toBe(60);
  });
});

describe("岸(reef)と洞窟(cave)", () => {
  it("岸: 歩行2・水棲は移動2で防御70%(浅瀬の上位の足場)", () => {
    expect(TERRAIN_BY_CHAR.r).toBe("reef");
    expect(TERRAINS.reef.moveCost.walk).toBe(2);
    expect(TERRAINS.reef.moveCost.swim).toBe(2);
    expect(TERRAINS.reef.defenseBonus.swim).toBe(70);
  });
  it("洞窟: 低い天井で飛行は移動3・防御20%まで悪化。水棲も移動3で進入できる", () => {
    expect(TERRAIN_BY_CHAR.u).toBe("cave");
    expect(TERRAINS.cave.moveCost.fly).toBe(3);
    expect(TERRAINS.cave.defenseBonus.fly).toBe(20);
    expect(TERRAINS.cave.moveCost.swim).toBe(3);
  });
});

describe("通行不能地形(obstacle / void)", () => {
  it("障害物・場外は全移動タイプで進入不可", () => {
    for (const id of ["obstacle", "void"] as const) {
      expect(TERRAINS[id].moveCost.walk).toBe(IMPASSABLE);
      expect(TERRAINS[id].moveCost.fly).toBe(IMPASSABLE);
      expect(TERRAINS[id].moveCost.swim).toBe(IMPASSABLE);
    }
    expect(TERRAIN_BY_CHAR.x).toBe("obstacle");
    expect(TERRAIN_BY_CHAR.z).toBe("void");
  });
});

describe("地形テーブルの整合性", () => {
  it("TERRAIN_BY_CHARの全ての値がTERRAINSに存在する", () => {
    for (const id of Object.values(TERRAIN_BY_CHAR)) {
      expect(TERRAINS[id], `terrain missing: ${id}`).toBeDefined();
    }
  });
});
