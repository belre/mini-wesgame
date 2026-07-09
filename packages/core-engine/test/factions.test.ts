// 陣営データの整合性テスト。AttackDef.id(英語の安定キー。表示名nameとは別)は
// フロント側のスプライトアニメ選択(lib/sprites.ts)がゲームイベント経由で参照するため、
// 空・重複・書き忘れがあるとアニメが黙って汎用フォールバックになる(手で気づきにくい)
import { describe, expect, it } from "vitest";
import { FACTIONS, getUnitDef } from "../src/data/factions";
import { ZOMBIE_VARIATIONS } from "../src/data/factions/zombie";

describe("陣営データの整合性", () => {
  it("全ユニットの全攻撃にidが設定されている(英数字とアンダースコアのみ)", () => {
    for (const faction of Object.values(FACTIONS)) {
      for (const unit of faction.units) {
        for (const attack of unit.attacks) {
          expect(attack.id, `${faction.id}/${unit.id}の攻撃「${attack.name}」`).toMatch(
            /^[a-z][a-z0-9_]*$/,
          );
        }
      }
    }
  });

  it("同一ユニット内で攻撃idが重複していない", () => {
    for (const faction of Object.values(FACTIONS)) {
      for (const unit of faction.units) {
        const ids = unit.attacks.map((a) => a.id);
        expect(new Set(ids).size, `${faction.id}/${unit.id}`).toBe(ids.length);
      }
    }
  });
});

describe("疫病の死体フォーム(zombie.ts)", () => {
  it("8種すべてがgetUnitDefで解決できる", () => {
    for (const variation of ZOMBIE_VARIATIONS) {
      expect(getUnitDef(variation.id).id).toBe(variation.id);
    }
  });

  it("どのFactionのrecruitableUnitIds/availableLeaderUnitIdsにも含まれない(疫病専用の死体フォームのため)", () => {
    const zombieIds = new Set(ZOMBIE_VARIATIONS.map((v) => v.id));
    for (const faction of Object.values(FACTIONS)) {
      for (const id of [...faction.recruitableUnitIds, ...faction.availableLeaderUnitIds]) {
        expect(zombieIds.has(id), `${faction.id}: ${id}`).toBe(false);
      }
    }
  });

  it("plagueCorpseUnitIdは多数派種族に配線済み(drakes)。他は人間型死体で正確なため未設定のまま", () => {
    expect(FACTIONS.drakes.plagueCorpseUnitId).toBe("zombie_drake");
    for (const id of ["loyalists", "rebels", "northerners", "undead"]) {
      expect(FACTIONS[id].plagueCorpseUnitId, id).toBeUndefined();
    }
  });

  it("plagueCorpseUnitIdを設定しているFactionは値がZOMBIE_VARIATIONSの有効なIDを指す", () => {
    const zombieIds = new Set(ZOMBIE_VARIATIONS.map((v) => v.id));
    for (const faction of Object.values(FACTIONS)) {
      if (faction.plagueCorpseUnitId) {
        expect(zombieIds.has(faction.plagueCorpseUnitId), faction.id).toBe(true);
      }
    }
  });
});
