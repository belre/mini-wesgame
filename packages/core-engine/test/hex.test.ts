import { describe, expect, it } from "vitest";
import { hexDistance, hexNeighbors, hexKey } from "../src/hex";

describe("hexNeighbors (odd-q offset)", () => {
  it("偶数列の隣接6ヘックス", () => {
    const keys = hexNeighbors({ x: 2, y: 2 }).map(hexKey).sort();
    expect(keys).toEqual(
      ["3,2", "3,1", "2,1", "1,1", "1,2", "2,3"].sort(),
    );
  });

  it("奇数列の隣接6ヘックス", () => {
    const keys = hexNeighbors({ x: 1, y: 1 }).map(hexKey).sort();
    expect(keys).toEqual(
      ["2,2", "2,1", "1,0", "0,1", "0,2", "1,2"].sort(),
    );
  });
});

describe("hexDistance", () => {
  it("同一ヘックスは0", () => {
    expect(hexDistance({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(0);
  });

  it("同一列の縦移動は行差", () => {
    expect(hexDistance({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(5);
  });

  it("隣接ヘックスは1", () => {
    for (const n of hexNeighbors({ x: 4, y: 4 })) {
      expect(hexDistance({ x: 4, y: 4 }, n)).toBe(1);
    }
    for (const n of hexNeighbors({ x: 5, y: 4 })) {
      expect(hexDistance({ x: 5, y: 4 }, n)).toBe(1);
    }
  });

  it("対称性", () => {
    const a = { x: 2, y: 7 };
    const b = { x: 11, y: 3 };
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
  });
});
