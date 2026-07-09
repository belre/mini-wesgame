import type { Faction, UnitDef } from "../../types";
import { DRAKES } from "./drakes";
//import { KNALGAN } from "./knalgan";
import { LOYALISTS } from "./loyalists";
import { NORTHERNERS } from "./northerners";
import { REBELS } from "./rebels";
import { UNDEAD } from "./undead";

export { ZOMBIE_VARIATIONS } from "./zombie";

// 6陣営基本パック。フェーズ1で対戦可能なのは忠誠軍 vs アンデッドだが、
// スキーマ・データは6陣営分を最初から揃えておく(計画書セクション6.2)。
export const FACTIONS: Record<string, Faction> = {
  loyalists: LOYALISTS,
  undead: UNDEAD,
  rebels: REBELS,
  northerners: NORTHERNERS,
  //knalgan: KNALGAN,
  drakes: DRAKES,
};

// フェーズ1でマッチ作成時に選択可能な陣営
export const DEFAULT_FACTION_ID = "loyalists"
// mini-wesgame: 遊べる陣営は人間族とオークのみ(2026-07-08 移植方針)。
// 他陣営のデータ定義はルールテストの資産として温存(ゲームからは選べない)
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
