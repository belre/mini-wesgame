// ユニット別の移動コスト・防御率を本家Wesnothと照合するための調査用CSVを生成する。
// 1回限りの雛形生成ツール(単体実行: npx tsx scripts/gen-terrain-audit.ts)。
// 出力: docs/terrain_audit/<faction>.csv (5陣営分)
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FACTIONS, PLAYABLE_FACTION_IDS } from "../src/data/factions";
import { moveCostFor } from "../src/movement";
import { TERRAINS } from "../src/data/terrain";
import type { UnitDef } from "../src/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "terrain_audit");

// /dev/units(frontend/src/components/UnitCatalog.tsxのTERRAIN_DISPLAY_ORDER)と
// 完全に同じ並び(2026-07-08 ユーザー指定)。突き合わせ時に迷わないよう両者を必ず同期させること。
// 障害物・場外は全ユニット進入不可(本家に対応地形なし)だが、一覧表との対応を崩さないため含める
const TERRAIN_IDS = [
  "grassland", "hills", "mountains", "forest",
  "village", "castle", "keep",
  "swamp", "shallow_water", "reef", "deep_water",
  "tochka",
  "sand", "desert",
  "cave",
  "obstacle", "void",
];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function unitRows(unit: UnitDef): string[] {
  const rows: string[] = [];
  const defenseType = unit.defenseType ?? unit.movement.type;
  for (const terrainId of TERRAIN_IDS) {
    const terrain = TERRAINS[terrainId];
    const baselineMove = moveCostFor(unit, terrain);
    const baselineDefense = unit.defenseOverrides?.[terrainId] ?? terrain.defenseBonus[defenseType];
    rows.push(
      [
        unit.id,
        unit.name,
        unit.level,
        unit.movement.type,
        defenseType,
        terrainId,
        terrain.name,
        baselineMove >= 99 ? "不可" : baselineMove,
        baselineDefense,
        "", // your_move_cost (空欄。デフォルトのままなら空欄のままでよい)
        "", // your_defense   (空欄。デフォルトのままなら空欄のままでよい)
        terrainId === "obstacle" || terrainId === "void" ? "全ユニット進入不可のため調査対象外" : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return rows;
}

const HEADER = [
  "unit_id",
  "unit_name",
  "level",
  "move_type",
  "defense_type",
  "terrain_id",
  "terrain_name",
  "baseline_move_cost",
  "baseline_defense",
  "your_move_cost",
  "your_defense",
  "note",
].join(",");

await mkdir(ROOT, { recursive: true });

// 対象陣営をCLI引数で絞れる(例: npx tsx scripts/gen-terrain-audit.ts northerners rebels drakes undead)。
// 引数なしなら全陣営(記入済みのCSVも上書きしてしまうので、記入済みの陣営があるときは明示指定すること)
const targetIds = process.argv.slice(2);
const factionIds = targetIds.length > 0 ? targetIds : PLAYABLE_FACTION_IDS;

for (const factionId of factionIds) {
  const faction = FACTIONS[factionId];
  const units = faction.units.filter((u) => !u.id.startsWith("zombie_")); // 疫病死体フォームは対象外
  const lines = [HEADER];
  for (const unit of units) {
    lines.push(...unitRows(unit));
  }
  const out = join(ROOT, `${factionId}.csv`);
  await writeFile(out, lines.join("\n") + "\n", "utf8");
  console.log(`${factionId}.csv: ${units.length}ユニット × ${TERRAIN_IDS.length}地形 = ${units.length * TERRAIN_IDS.length}行`);
}
