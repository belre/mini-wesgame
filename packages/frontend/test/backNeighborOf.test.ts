// 縦列(同じx、y±1)の「奥隣」判定(lib/board/geometry.ts backNeighborOf)の仕様固定。
// ユニット巡回選択(重なったユニットの奥へ選択を切り替える)と、移動中に敵ユニットの
// 背後ヘックスへ移動先を切り替える機能(BoardScreen.tsx onHexClick)の両方が
// この1つの関数を共有しているため、ここで幾何条件を独立に検証しておく。
// mini-wesgame(2026-07-09): 傾き・視点反転を廃止したため、奥は常にy-1側の単純な仕様になった。
import { describe, expect, it } from "vitest";
import { mapById } from "@parle-stroika/core-engine";
import { backNeighborOf } from "../src/lib/board/geometry";

const map = mapById("valley_crossing"); // 16x12。テストの舞台は本番と同じ実マップ

describe("backNeighborOf", () => {
  it("奥はy-1側(素のcyが単調増加するため)", () => {
    expect(backNeighborOf(map, { x: 4, y: 5 })).toEqual({ x: 4, y: 4 });
  });

  it("盤面端(y=0)ではy-1が範囲外なので候補なし", () => {
    expect(backNeighborOf(map, { x: 4, y: 0 })).toBeNull();
  });

  it("列の外(x軸は変えない): 常にanchorと同じxのヘックスだけを返す", () => {
    const back = backNeighborOf(map, { x: 7, y: 6 });
    expect(back?.x).toBe(7);
  });
});
