// マップデータ(JSON)のロードとバリデーションのテスト
import { describe, expect, it } from "vitest";
import { MAPS, mapById, mapMeta, VALLEY_CROSSING } from "../src/data/maps";

describe("マップデータ(JSON)のロード", () => {
  it("登録済みマップは寸法・タイル文字の検証を通過している", () => {
    // MAPSの構築時に validateMap が走るため、ここに到達できていれば検証済み。
    // 念のため主要な整合性を再確認する
    for (const map of Object.values(MAPS)) {
      expect(map.tiles).toHaveLength(map.height);
      for (const row of map.tiles) {
        expect(row).toHaveLength(map.width);
      }
      const meta = mapMeta(map);
      expect(meta.keeps).toHaveLength(2);
      expect(meta.castlesByPlayer[0].length).toBeGreaterThan(0);
      expect(meta.castlesByPlayer[1].length).toBeGreaterThan(0);
    }
  });

  it("マッチ作成画面用の名前と説明文を持つ", () => {
    const map = mapById("valley_crossing");
    expect(map.name).toBe("デバッグマップ");
    expect(map.description).toBeTruthy();
    expect(VALLEY_CROSSING).toBe(map);
  });
});
