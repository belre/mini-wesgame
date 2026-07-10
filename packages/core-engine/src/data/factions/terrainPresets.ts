// 陣営を横断する/種族内で共有する地形適性プリセット。
// movement.terrainOverrides(移動コスト個別上書き)と UnitDef.defenseOverrides(防御率個別上書き)
// を複数ユニットで使い回すためのもの。

// オーク種族の山岳適性(2026-07-08 ユーザー実測)。オークは山岳民族という設定で、
// walk型のオーク・トロル系全ユニットが岩場(mountains)に例外的に進入できる
// (歩兵は通常不可の壁。コスト2・防御60%で共通)
export const ORC_MOUNTAIN_MOVE: Record<string, number> = { mountains: 2 };
const ORC_MOUNTAIN_DEFENSE: Record<string, number> = { mountains: 60 };

// オーク歩兵系(兵卒→戦士、弓兵系列)。山岳適性 + 沼地がやや堅い(2026-07-08 ユーザー実測)
export const ORC_INFANTRY_MOVE_OVERRIDES: Record<string, number> = { ...ORC_MOUNTAIN_MOVE };
export const ORC_INFANTRY_DEFENSE_OVERRIDES: Record<string, number> = {
  ...ORC_MOUNTAIN_DEFENSE,
  swamp: 30,
};

// 狼系(wolf_rider→orcish_pillager)。山岳適性 + 狼は踏破性が高く丘が速い/沼地・浅瀬が堅い。
// 村は路地で機動を失う。トーチカは足の速いユニットに不利(本家準拠 — 2026-07-08 ユーザー実測)
export const ORC_WOLF_MOVE_OVERRIDES: Record<string, number> = {
  ...ORC_MOUNTAIN_MOVE,
  hills: 1,
  tochka: 3,
};
export const ORC_WOLF_DEFENSE_OVERRIDES: Record<string, number> = {
  ...ORC_MOUNTAIN_DEFENSE,
  village: 50,
  swamp: 30,
  shallow_water: 30,
  tochka: 40,
};

// トロル系(troll_whelp→troll)。山岳適性はあるが図体が大きく開けた地形・人工地形が苦手
// (2026-07-08 ユーザー実測)
export const ORC_TROLL_MOVE_OVERRIDES: Record<string, number> = { ...ORC_MOUNTAIN_MOVE };
export const ORC_TROLL_DEFENSE_OVERRIDES: Record<string, number> = {
  ...ORC_MOUNTAIN_DEFENSE,
  grassland: 30,
  forest: 40,
  village: 40,
  castle: 40,
  keep: 40,
};
