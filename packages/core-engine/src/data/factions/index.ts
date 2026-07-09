import type { Faction, UnitDef } from "../../types";
import { LOYALISTS } from "./loyalists";
import { NORTHERNERS } from "./northerners";

// mini-wesgame(2026-07-09): 陣営データは人間族とオークのみ。
// 公開リポジトリのため他陣営(undead/rebels/drakes/knalgan/zombie)は
// データファイルごと削除した(本家parle-stroikaには全6陣営が残っている)
export const FACTIONS: Record<string, Faction> = {
  loyalists: LOYALISTS,
  northerners: NORTHERNERS,
};

export const DEFAULT_FACTION_ID = "loyalists"
export const PLAYABLE_FACTION_IDS = ["loyalists", "northerners"]

const unitDefRegistry = new Map<string, UnitDef>();
for (const faction of Object.values(FACTIONS)) {
  for (const unit of faction.units) {
    if (unitDefRegistry.has(unit.id)) {
      throw new Error(`duplicate unit id across factions: ${unit.id}`);
    }
    unitDefRegistry.set(unit.id, unit);
  }
}
// 昇格先の整合性チェック(データのtypoをロード時に検出)
for (const unit of unitDefRegistry.values()) {
  for (const targetId of unit.advancesTo ?? []) {
    if (!unitDefRegistry.has(targetId)) {
      throw new Error(`unknown advancesTo: ${unit.id} -> ${targetId}`);
    }
  }
}

export function getFaction(factionId: string): Faction {
  const faction = FACTIONS[factionId];
  if (!faction) throw new Error(`unknown faction: ${factionId}`);
  return faction;
}

export function getUnitDef(unitDefId: string): UnitDef {
  const def = unitDefRegistry.get(unitDefId);
  if (!def) throw new Error(`unknown unit def: ${unitDefId}`);
  return def;
}
