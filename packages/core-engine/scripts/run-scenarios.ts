#!/usr/bin/env tsx
// シナリオベースの整合性チェックランナー。
// vitest とは独立して動作し、scenarios/*.json に記述された期待値と
// エンジンの計算結果が一致するかを検証する。
//
// 使い方: npm run scenarios -w @parle-stroika/core-engine
//         tsx scripts/run-scenarios.ts

import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hitChanceAgainst, predictCombat } from "../src/combat";
import { getUnitDef } from "../src/data/factions";
import { terrainById } from "../src/data/terrain";
import { TIME_OF_DAY_DEFS } from "../src/timeOfDay";
import type { CombatPrediction } from "../src/combat";
import type { DefenseType, TraitId, UnitState } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, "../scenarios");
const TOLERANCE = 0.001;

// ---------------------------------------------------------------------------
// JSONスキーマ型
// ---------------------------------------------------------------------------

type TimeOfDayId = keyof typeof TIME_OF_DAY_DEFS;

interface CombatPredictionInput {
  attackerDefId: string;
  defenderDefId: string;
  attackIndex: number;
  attackerTerrainId: string;
  defenderTerrainId: string;
  timeOfDayId: TimeOfDayId;
  attackerTraits?: string[];
  defenderTraits?: string[];
}

interface CombatPredictionExpect {
  hitChance?: number;
  damagePerStrike?: number;
  strikes?: number;
  rounds?: number;
  backstab?: boolean;
  retaliation?: {
    damagePerStrike?: number;
    strikes?: number;
    hitChance?: number;
  } | null;
}

interface HitChanceInput {
  defenderTerrainId: string;
  defenseType?: string;
  defenderDefId?: string;
  defenderTraits?: string[];
}

type Scenario =
  | { type: "combat_prediction"; id: string; description: string; input: CombatPredictionInput; expect: CombatPredictionExpect }
  | { type: "combat_prediction"; id: string; description: string; input: CombatPredictionInput; expectError: string }
  | { type: "hit_chance"; id: string; description: string; input: HitChanceInput; expect: number }
  | { type: "hit_chance"; id: string; description: string; input: HitChanceInput; expectError: string };

interface ScenarioFile {
  description?: string;
  scenarios: Scenario[];
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function makeUnit(defId: string, owner: number, traits: string[] = []): UnitState {
  const def = getUnitDef(defId);
  return {
    id: `${defId}-${owner}`,
    unitDefId: defId,
    owner,
    pos: { x: 0, y: 0 },
    hp: def.hp,
    maxHp: def.hp,
    movesLeft: def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: false,
    traits: traits as TraitId[],
    poisoned: false,
    xp: 0,
  };
}

function approxEq(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

function checkNum(field: string, actual: number, expected: number, errors: string[]): void {
  if (!approxEq(actual, expected)) {
    errors.push(`    ${field}: expected ${expected} got ${actual.toFixed(4)}`);
  }
}

// ---------------------------------------------------------------------------
// シナリオ実行
// ---------------------------------------------------------------------------

function runCombatPrediction(input: CombatPredictionInput): CombatPrediction {
  const attackerDef = getUnitDef(input.attackerDefId);
  const defenderDef = getUnitDef(input.defenderDefId);
  return predictCombat({
    attacker: makeUnit(input.attackerDefId, 0, input.attackerTraits),
    attackerDef,
    defender: makeUnit(input.defenderDefId, 1, input.defenderTraits),
    defenderDef,
    attack: attackerDef.attacks[input.attackIndex],
    attackerTerrain: terrainById(input.attackerTerrainId),
    defenderTerrain: terrainById(input.defenderTerrainId),
    timeOfDay: TIME_OF_DAY_DEFS[input.timeOfDayId],
  });
}

function runHitChance(input: HitChanceInput): number {
  const terrain = terrainById(input.defenderTerrainId);
  let defenseType: DefenseType;
  if (input.defenderDefId) {
    const def = getUnitDef(input.defenderDefId);
    defenseType = def.defenseType ?? def.movement.type;
  } else {
    defenseType = input.defenseType as DefenseType;
  }
  return hitChanceAgainst(terrain, defenseType, input.defenderTraits as TraitId[] | undefined);
}

// ---------------------------------------------------------------------------
// 期待値アサーション
// ---------------------------------------------------------------------------

function assertCombatPrediction(result: CombatPrediction, expect: CombatPredictionExpect): string[] {
  const errors: string[] = [];
  if (expect.hitChance !== undefined) checkNum("hitChance", result.hitChance, expect.hitChance, errors);
  if (expect.damagePerStrike !== undefined) {
    if (result.damagePerStrike !== expect.damagePerStrike) {
      errors.push(`    damagePerStrike: expected ${expect.damagePerStrike} got ${result.damagePerStrike}`);
    }
  }
  if (expect.strikes !== undefined && result.strikes !== expect.strikes) {
    errors.push(`    strikes: expected ${expect.strikes} got ${result.strikes}`);
  }
  if (expect.rounds !== undefined && result.rounds !== expect.rounds) {
    errors.push(`    rounds: expected ${expect.rounds} got ${result.rounds}`);
  }
  if (expect.backstab !== undefined && result.backstab !== expect.backstab) {
    errors.push(`    backstab: expected ${expect.backstab} got ${result.backstab}`);
  }
  if ("retaliation" in expect) {
    if (expect.retaliation === null) {
      if (result.retaliation !== null) errors.push("    retaliation: expected null got non-null");
    } else if (expect.retaliation !== undefined) {
      if (!result.retaliation) {
        errors.push("    retaliation: expected non-null got null");
      } else {
        const r = result.retaliation;
        const e = expect.retaliation;
        if (e.damagePerStrike !== undefined && r.damagePerStrike !== e.damagePerStrike) {
          errors.push(`    retaliation.damagePerStrike: expected ${e.damagePerStrike} got ${r.damagePerStrike}`);
        }
        if (e.strikes !== undefined && r.strikes !== e.strikes) {
          errors.push(`    retaliation.strikes: expected ${e.strikes} got ${r.strikes}`);
        }
        if (e.hitChance !== undefined) checkNum("retaliation.hitChance", r.hitChance, e.hitChance, errors);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// メインループ
// ---------------------------------------------------------------------------

let totalPass = 0;
let totalFail = 0;

const files = readdirSync(SCENARIOS_DIR)
  .filter((f) => extname(f) === ".json")
  .sort();

for (const file of files) {
  const raw = readFileSync(join(SCENARIOS_DIR, file), "utf-8");
  const sf = JSON.parse(raw) as ScenarioFile;
  console.log(`\n=== ${file}${sf.description ? ` — ${sf.description}` : ""} ===`);

  for (const scenario of sf.scenarios) {
    const label = `[${scenario.id}] ${scenario.description}`;
    const hasExpectError = "expectError" in scenario;

    try {
      if (scenario.type === "combat_prediction") {
        const result = runCombatPrediction(scenario.input);
        if (hasExpectError) {
          console.log(`  ✗ ${label}`);
          console.log(`    期待エラーなし: expected "${(scenario as { expectError: string }).expectError}"`);
          totalFail++;
        } else {
          const errors = assertCombatPrediction(result, scenario.expect);
          if (errors.length === 0) {
            console.log(`  ✓ ${label}`);
            totalPass++;
          } else {
            console.log(`  ✗ ${label}`);
            errors.forEach((e) => console.log(e));
            totalFail++;
          }
        }
      } else if (scenario.type === "hit_chance") {
        const result = runHitChance(scenario.input);
        if (hasExpectError) {
          console.log(`  ✗ ${label}`);
          console.log(`    期待エラーなし: expected "${(scenario as { expectError: string }).expectError}"`);
          totalFail++;
        } else {
          if (approxEq(result, scenario.expect)) {
            console.log(`  ✓ ${label}`);
            totalPass++;
          } else {
            console.log(`  ✗ ${label}`);
            console.log(`    expected ${scenario.expect} got ${result.toFixed(4)}`);
            totalFail++;
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (hasExpectError) {
        const expectedMsg = (scenario as { expectError: string }).expectError;
        if (message.includes(expectedMsg)) {
          console.log(`  ✓ ${label}  (throws: "${message}")`);
          totalPass++;
        } else {
          console.log(`  ✗ ${label}`);
          console.log(`    期待エラー: "${expectedMsg}"`);
          console.log(`    実際のエラー: "${message}"`);
          totalFail++;
        }
      } else {
        console.log(`  ✗ ${label}`);
        console.log(`    予期しないエラー: ${message}`);
        totalFail++;
      }
    }
  }
}

const status = totalFail === 0 ? "OK" : "FAIL";
console.log(`\n--- ${status}: ${totalPass} passed, ${totalFail} failed ---\n`);
if (totalFail > 0) process.exit(1);
