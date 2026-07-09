// 縦列(同じx、y±1)の「奥隣」判定(lib/board/geometry.ts backNeighborOf)の仕様固定。
// ユニット巡回選択(重なったユニットの奥へ選択を切り替える)と、移動中に敵ユニットの
// 背後ヘックスへ移動先を切り替える機能(BoardScreen.tsx onHexClick)の両方が
// この1つの関数を共有しているため、ここで幾何条件を独立に検証しておく。
import { describe, expect, it } from "vitest";
import { mapById } from "@parle-stroika/core-engine";
import { backNeighborOf, hexCenter } from "../src/lib/board/geometry";
import { projectTilt, BOARD_DIAGONAL_DEG } from "../src/lib/tilt";

const map = mapById("valley_crossing"); // 16x12。テストの舞台は本番と同じ実マップ

describe("backNeighborOf", () => {
  it("非傾け・非反転: 奥はy-1側(素のcyが単調増加するため)", () => {
    expect(backNeighborOf(map, false, false, { x: 4, y: 5 })).toEqual({ x: 4, y: 4 });
  });

  it("非傾け・ビュー反転: 奥がy+1側に反転する(反転でcyの大小が逆転するため)", () => {
    expect(backNeighborOf(map, true, false, { x: 4, y: 5 })).toEqual({ x: 4, y: 6 });
  });

  it("盤面端(y=0)で非傾け・非反転: y-1が範囲外なのでy+1は奥にならず候補なし", () => {
    expect(backNeighborOf(map, false, false, { x: 4, y: 0 })).toBeNull();
  });

  it("盤面端(y=height-1)でビュー反転: y+1が範囲外なのでy-1は奥にならず候補なし", () => {
    expect(backNeighborOf(map, true, false, { x: 4, y: map.height - 1 })).toBeNull();
  });

  it("傾き表示(tilted): 実際の投影(projectTilt)でcyが小さい側と一致する", () => {
    // 関数の実装と同じ投影式を使い、"cyが小さい方を奥として選ぶ"契約そのものを検証する
    // (定数変更に対して脆くならないよう、座標の決め打ちではなく契約で確認する)
    for (const viewFlipped of [false, true]) {
      const anchor = { x: 4, y: 5 };
      const W = 1.5 * 36 * (map.width - 1) + 2 * 36;
      const H = Math.sqrt(3) * 36 * (map.height + 0.5) + 36;
      const origin = { cx: W / 2, cy: H / 2 };
      const screenCy = (c: { x: number; y: number }) => {
        const raw = hexCenter(c);
        const flipped = viewFlipped ? { cx: W - raw.cx, cy: H - raw.cy } : raw;
        return projectTilt(flipped, origin, true, BOARD_DIAGONAL_DEG).cy;
      };
      const anchorCy = screenCy(anchor);
      const upCy = screenCy({ x: anchor.x, y: anchor.y - 1 });
      const downCy = screenCy({ x: anchor.x, y: anchor.y + 1 });
      const expected =
        upCy < anchorCy && upCy <= downCy
          ? { x: anchor.x, y: anchor.y - 1 }
          : downCy < anchorCy
            ? { x: anchor.x, y: anchor.y + 1 }
            : null;
      expect(backNeighborOf(map, viewFlipped, true, anchor)).toEqual(expected);
    }
  });

  it("列の外(x軸は変えない): 常にanchorと同じxのヘックスだけを返す", () => {
    const back = backNeighborOf(map, false, false, { x: 7, y: 6 });
    expect(back?.x).toBe(7);
  });
});
