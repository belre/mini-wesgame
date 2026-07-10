// 盤面のヘックス幾何(React/DOM非依存の定数と純関数)。
// HexGrid肥大化の分割(2026-07-08リファクタ)で components/HexGrid.tsx から移設。
// 座標系の全体像は skill: board-rendering §1(盤面座標/ビュー空間/スクリーン投影)
import { inBounds, type GameMap, type HexCoord } from "@parle-stroika/core-engine";

// ヘックスの外接円半径。盤面px系の基本単位(立体物のoffset/jitterもこのS単位)
export const S = 36;
// ヘックスの横幅(盤面px)= Wesnothスプライトの原寸72pxと1:1。
// 画面上の実サイズ計測(BoardScreenのhexサイズ表示)が参照する
export const HEX_WIDTH_PX = 2 * S;
const SQRT3 = Math.sqrt(3);

// ヘックスのDOM要素id(クリックガイドのスポットライト・zoomToElementでの
// カメラ中心合わせが参照する安定キー。マップサイズに依存しない)
export function hexElementId(c: HexCoord): string {
  return `hex-${c.x}-${c.y}`;
}

export function hexCenter(c: HexCoord): { cx: number; cy: number } {
  return {
    cx: S + 1.5 * S * c.x,
    cy: SQRT3 * S * (c.y + 0.5 * (c.x & 1)) + (SQRT3 / 2) * S,
  };
}

// 盤面全体の描画ピクセルサイズ。svgのviewBoxと初期カメラ計算(BoardScreen)が共有する
export function boardPixelSize(map: { width: number; height: number }): {
  width: number;
  height: number;
} {
  return {
    width: 1.5 * S * (map.width - 1) + 2 * S,
    height: SQRT3 * S * (map.height + 0.5) + S,
  };
}

// ヘックス頂点は cos/sin を使わず正確な定数で求める。
// Math.cos/sin は正確な丸めが仕様で要求されず、SSR(Node)とブラウザで最終桁が
// ズレて座標文字列が一致せずhydrationエラーになる(Math.sqrtは正確な丸めが保証される)。
// さらに小数2桁に丸めて文字列を安定・短縮する(検証: SpriteAnimDemo.tsxで先に確認済み)
const HEX_CORNERS: [number, number][] = [
  [1, 0],
  [0.5, SQRT3 / 2],
  [-0.5, SQRT3 / 2],
  [-1, 0],
  [-0.5, -SQRT3 / 2],
  [0.5, -SQRT3 / 2],
];

export const round2 = (v: number) => Math.round(v * 100) / 100;

export function hexPointsAt(center: { cx: number; cy: number }): string {
  return HEX_CORNERS.map(
    ([dx, dy]) => `${round2(center.cx + S * dx)},${round2(center.cy + S * dy)}`,
  ).join(" ");
}

// 同じ列(x固定、yが上下に並ぶ)でanchorの奥隣(画面奥=cyが小さい側)のヘックスを返す。
// 用途: 縦列で重なったユニットの巡回選択・敵ユニットの背後ヘックスへの移動先指定
// (どちらもBoardScreen.tsx onHexClick。同じ「奥隣」計算を共有する)
export function backNeighborOf(map: GameMap, anchor: HexCoord): HexCoord | null {
  const anchorCy = hexCenter(anchor).cy;
  let back: HexCoord | null = null;
  let backCy = anchorCy;
  for (const dy of [-1, 1]) {
    const c = { x: anchor.x, y: anchor.y + dy };
    if (!inBounds(map, c)) continue;
    const cy = hexCenter(c).cy;
    if (cy < backCy) {
      backCy = cy;
      back = c;
    }
  }
  return back;
}
