// 盤面の配色(HexGrid・CutInStage・情報パネル等の全レンダラーで共有)。
// HexGrid肥大化の分割(2026-07-08リファクタ)で components/HexGrid.tsx から移設
export const OWNER_COLORS = ["#3b6fd4", "#c04545"];
export const OWNER_COLORS_LIGHT = ["#7ea4f0", "#e08a8a"];

// スプライト未取得・未定義時のフォールバック色polygon用(クリック判定の実体も兼ねる)
export const TERRAIN_COLORS: Record<string, string> = {
  grassland: "#4e7a3a",
  forest: "#2d5527",
  sand: "#b3a06c",
  desert: "#d8c391",
  hills: "#7a6a45",
  mountains: "#6b6b70",
  shallow_water: "#3a6ea5",
  deep_water: "#1e3f66",
  obstacle: "#5a5f52",
  void: "#a8acb4",
  reef: "#8aa08a",
  cave: "#3a3a40",
  swamp: "#4a5f52",
  tochka: "#6f7a5a",
  village: "#a58a4e",
  castle: "#8a8f9c",
  keep: "#b8933f",
};

// HPバーの配色(残量に応じて緑→黄→赤)
export function hpColor(ratio: number): string {
  if (ratio > 0.55) return "#63c463";
  if (ratio > 0.3) return "#dbA43a";
  return "#d9534f";
}

// 命中率の配色(戦闘予測の簡略表示用。2026-07-09方針: 40%未満=赤・40〜60%=黄・60%以上=緑。
// 「高/中/低」の段階語には丸めない — 数字はそのまま出し、色だけで直感的な良し悪しを添える)
export function hitChanceColor(ratio: number): string {
  if (ratio >= 0.6) return "#63c463";
  if (ratio >= 0.4) return "#dbA43a";
  return "#d9534f";
}
