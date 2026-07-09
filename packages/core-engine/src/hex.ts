import type { HexCoord } from "./types";

// odd-q オフセット座標(フラットトップ、奇数列を下にずらす)のヘックス計算。
// 参考: https://www.redblobgames.com/grids/hexagons/

export function hexKey(c: HexCoord): string {
  return `${c.x},${c.y}`;
}

export function parseHexKey(key: string): HexCoord {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function hexEquals(a: HexCoord, b: HexCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

export function oddqToCube({ x, y }: HexCoord): CubeCoord {
  const q = x;
  const r = y - (x - (x & 1)) / 2;
  return { q, r, s: -q - r };
}

export function cubeToOddq(c: { q: number; r: number }): HexCoord {
  return { x: c.q, y: c.r + (c.q - (c.q & 1)) / 2 };
}

// aから見てbの正反対側の隣接ヘックス(奇襲(backstab)の判定に使用)
export function hexOpposite(a: HexCoord, b: HexCoord): HexCoord {
  const ca = oddqToCube(a);
  const cb = oddqToCube(b);
  return cubeToOddq({ q: 2 * cb.q - ca.q, r: 2 * cb.r - ca.r });
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ca = oddqToCube(a);
  const cb = oddqToCube(b);
  return Math.max(
    Math.abs(ca.q - cb.q),
    Math.abs(ca.r - cb.r),
    Math.abs(ca.s - cb.s),
  );
}

// odd-q オフセットの隣接6方向([dx, dy])。列の偶奇で異なる。
const ODDQ_DIRECTIONS: readonly (readonly (readonly [number, number])[])[] = [
  // 偶数列
  [
    [+1, 0],
    [+1, -1],
    [0, -1],
    [-1, -1],
    [-1, 0],
    [0, +1],
  ],
  // 奇数列
  [
    [+1, +1],
    [+1, 0],
    [0, -1],
    [-1, 0],
    [-1, +1],
    [0, +1],
  ],
] as const;

export function hexNeighbors(c: HexCoord): HexCoord[] {
  const dirs = ODDQ_DIRECTIONS[c.x & 1];
  return dirs.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }));
}
