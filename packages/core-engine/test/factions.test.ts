// 陣営データの整合性テスト。AttackDef.id(英語の安定キー。表示名nameとは別)は
// フロント側のスプライトアニメ選択(lib/sprites.ts)がゲームイベント経由で参照するため、
// 空・重複・書き忘れがあるとアニメが黙って汎用フォールバックになる(手で気づきにくい)
import { describe, expect, it } from "vitest";
import { FACTIONS, getUnitDef } from "../src/data/factions";

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

// mini-wesgame: 疫病の死体フォーム(zombie.ts)は陣営削減で削除。
// 疫病機構はエンジンに残るが担い手なしの休眠状態(本家に完全版のテストあり)
