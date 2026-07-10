// 対戦アセット計画(planMatchAssets)のテスト。
// Loading画面が「何をダウンロードすべきか」を正しく列挙できることを検証する。
// 計画はスプライト定義表(コンテンツ層)から導出される論理単位のリストで、
// CDN上の物理配置には依存しない(backlog A-4で配置を変えても計画は不変)。
import { describe, expect, it } from "vitest";
import { getFaction } from "@parle-stroika/core-engine";
import { matchAssetKey, planMatchAssets, planSpritePacks } from "../src/lib/assets/matchAssets";
import { UNIT_SPRITES } from "../src/lib/content";

const LOYALISTS_VS_NORTHERNERS = {
  mapId: "valley_crossing",
  players: [
    { userId: "p0", factionId: "loyalists", gold: 100 },
    { userId: "p1", factionId: "northerners", gold: 100 },
  ],
};

describe("planMatchAssets", () => {
  it("両陣営の全スプライト定義済みユニットをチームカラー別に含む", () => {
    const plan = planMatchAssets(LOYALISTS_VS_NORTHERNERS);
    for (const [owner, factionId] of [[0, "loyalists"], [1, "northerners"]] as const) {
      for (const unit of getFaction(factionId).units) {
        if (!UNIT_SPRITES[unit.spriteKey]) continue;
        expect(
          plan.some(
            (i) => i.kind === "unit" && i.spriteKey === unit.spriteKey && i.owner === owner,
          ),
          `${factionId}の${unit.id}(owner=${owner})が計画にない`,
        ).toBe(true);
      }
    }
    // 相手陣営のユニットが自分のownerで混入していないこと
    expect(
      plan.some(
        (i) => i.kind === "unit" && i.spriteKey === "units/northerners/orcish_warrior" && i.owner === 0,
      ),
    ).toBe(false);
  });

  it("マップに存在する地形のうちスプライト定義があるものを含む", () => {
    const plan = planMatchAssets(LOYALISTS_VS_NORTHERNERS);
    const terrains = plan.filter((i) => i.kind === "terrain").map((i) => i.terrainId);
    // valley_crossingに確実にある地形の代表(草原・村・城)
    expect(terrains).toContain("grassland");
    expect(terrains).toContain("village");
    expect(terrains).toContain("castle");
  });

  it("項目キーに重複がない(ミラーマッチでもowner別に分かれる)", () => {
    const mirror = planMatchAssets({
      mapId: "valley_crossing",
      players: [
        { userId: "p0", factionId: "northerners", gold: 100 },
        { userId: "p1", factionId: "northerners", gold: 100 },
      ],
    });
    const keys = mirror.map(matchAssetKey);
    expect(new Set(keys).size).toBe(keys.length);
    // 同じspriteKeyがowner 0/1の2項目として存在する(チームカラーが異なるため両方必要)
    expect(keys).toContain("unit:units/northerners/orcish_warrior#0");
    expect(keys).toContain("unit:units/northerners/orcish_warrior#1");
  });

  it("全項目にUI表示用ラベルがある", () => {
    for (const item of planMatchAssets(LOYALISTS_VS_NORTHERNERS)) {
      expect(item.label.length, matchAssetKey(item)).toBeGreaterThan(0);
    }
  });
});

describe("planSpritePacks", () => {
  it("両陣営のユニットパック名(units-<dir>)+terrainを返す", () => {
    const packs = planSpritePacks(LOYALISTS_VS_NORTHERNERS);
    expect(packs).toContain("units-loyalists");
    expect(packs).toContain("units-northerners");
    expect(packs).toContain("terrain");
  });

  it("ミラーマッチ(同一陣営)でもパック名は重複しない", () => {
    const packs = planSpritePacks({
      players: [
        { userId: "p0", factionId: "northerners", gold: 100 },
        { userId: "p1", factionId: "northerners", gold: 100 },
      ],
    });
    expect(new Set(packs).size).toBe(packs.length);
    expect(packs).toContain("units-northerners");
    expect(packs).toContain("terrain");
  });
});
