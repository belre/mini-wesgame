// CPU対戦の思考ルーチン(純粋関数)。
// applyAction と同じくクライアント・サーバーのどちらでも実行できるが、
// 現状はクライアント(CPU練習モード)がAPIを介さずブラウザ内で駆動する。
//
// 使い方: 手番がCPUの間、chooseCpuAction() を繰り返し呼んで1手ずつ applyAction に渡す。
// 昇格選択 → 攻撃 → 雇用 → 移動(村占領・敵への接近)の優先順で手を返し、
// 何もすることがなくなったら endTurn を返す。
// - 移動は canMoveTo(コスト>0)のみ返すため移動力が単調減少し、攻撃は attacksLeft を
//   消費するため、1ターン内で返す手は有限(必ず endTurn に到達する)
// - 霧(FOG)のマッチでは filterStateForViewer でCPU視点にフィルタした状態を渡すこと。
//   全情報を渡すとCPUがチート(隠れユニットの位置を知った行動)をしてしまう
import { predictCombat } from "./combat";
import { getFaction, getUnitDef } from "./data/factions";
import { mapById, mapMeta, terrainAt } from "./data/maps";
import { hexDistance, hexEquals, hexKey } from "./hex";
import { canMoveTo, computeReachable } from "./movement";
import { timeOfDayForTurn } from "./timeOfDay";
import type { Action, HexCoord, MatchState, Rng } from "./types";

// 維持費で赤字になりすぎないよう、盤面に維持する非リーダーユニット数の上限
const MAX_FIELD_UNITS = 8;
// この閾値を超える点数の攻撃だけ実行する(0 = 期待値がプラスなら殴る)
const ATTACK_SCORE_THRESHOLD = 0;

function pickByRng<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

// 手番プレイヤー(state.activePlayer)の次の1手を決める
export function chooseCpuAction(state: MatchState, rng: Rng): Action {
  const me = state.activePlayer;
  const map = mapById(state.mapId);
  const meta = mapMeta(map);
  const myUnits = state.units.filter((u) => u.owner === me);
  const enemies = state.units.filter((u) => u.owner !== me);

  // 1) 自軍ユニットの昇格待ちがあれば最優先で解決する(解決するまで他の手が打てない)
  const pending = (state.pendingPromotion ?? []).find(
    (p) => state.units.find((u) => u.id === p.unitId)?.owner === me,
  );
  if (pending) {
    return {
      type: "chooseLevelUp",
      unitId: pending.unitId,
      targetDefId: pickByRng(pending.choices, rng),
    };
  }

  // 2) 攻撃: 隣接する敵への全攻撃手段を期待値で採点し、最良の1手を返す
  const tod = timeOfDayForTurn(state.scheduleId, state.startIndex, state.turnNumber);
  let bestAttack: { action: Action; score: number } | null = null;
  for (const unit of myUnits) {
    if (unit.attacksLeft <= 0) continue;
    const unitDef = getUnitDef(unit.unitDefId);
    for (const enemy of enemies) {
      if (hexDistance(unit.pos, enemy.pos) !== 1) continue;
      const enemyDef = getUnitDef(enemy.unitDefId);
      for (let attackIndex = 0; attackIndex < unitDef.attacks.length; attackIndex++) {
        const p = predictCombat({
          attacker: unit,
          attackerDef: unitDef,
          defender: enemy,
          defenderDef: enemyDef,
          attack: unitDef.attacks[attackIndex],
          attackerTerrain: terrainAt(map, unit.pos),
          defenderTerrain: terrainAt(map, enemy.pos),
          timeOfDay: tod,
          units: state.units,
        });
        const dealt = Math.min(p.expectedDamageDealt * p.rounds, enemy.hp);
        const taken = Math.min(p.expectedDamageTaken * p.rounds, unit.hp);
        // リーダーは敗北条件なので、反撃で大きく削られる攻撃はしない
        if (unit.isLeader && taken >= unit.hp * 0.34) continue;
        let score = dealt - taken * 0.6;
        if (dealt >= enemy.hp) score += enemy.isLeader ? 40 : 10; // 撃破(勝利)見込みボーナス
        if (taken >= unit.hp) score -= 15; // 返り討ちの危険
        if (score > (bestAttack?.score ?? ATTACK_SCORE_THRESHOLD)) {
          bestAttack = {
            action: {
              type: "attack",
              attackerId: unit.id,
              defenderId: enemy.id,
              attackIndex,
            },
            score,
          };
        }
      }
    }
  }
  if (bestAttack) return bestAttack.action;

  // 3) 雇用: リーダーが主城にいて、空き城ヘックスと資金があれば雇う
  const leader = myUnits.find((u) => u.isLeader);
  const player = state.players[me];
  const faction = getFaction(player.factionId);
  if (
    leader &&
    hexEquals(leader.pos, meta.keeps[me]) &&
    myUnits.length - 1 < MAX_FIELD_UNITS
  ) {
    const freeCastle = meta.castlesByPlayer[me].find(
      (c) => !state.units.some((u) => hexEquals(u.pos, c)),
    );
    // モード制限(PlayerState.recruitUnitIds)があれば最優先で従う
    const recruitPool =
      state.players[me].recruitUnitIds ??
      faction.cpuRecruitableUnitIds ??
      faction.recruitableUnitIds;
    const affordable = recruitPool
      .map((id) => faction.units.find((u) => u.id === id))
      .filter((def) => def !== undefined && def.cost <= player.gold);
    if (freeCastle && affordable.length > 0) {
      return {
        type: "recruit",
        unitDefId: pickByRng(affordable, rng)!.id,
        target: freeCastle,
      };
    }
  }

  // 4) 移動: 「未領有の村の占領」と「目標(村・敵)への接近」を採点して最良の1手を返す。
  //    リーダーは主城から動かさない(雇用と敗北条件の保護)
  const objectives: HexCoord[] = enemies.map((e) => e.pos);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const coord = { x, y };
      if (
        terrainAt(map, coord).id === "village" &&
        (state.villageOwners ?? {})[hexKey(coord)] !== me
      ) {
        objectives.push(coord);
      }
    }
  }
  const distToObjective = (coord: HexCoord): number =>
    objectives.length === 0
      ? 0
      : Math.min(...objectives.map((o) => hexDistance(coord, o)));
  const hexScore = (coord: HexCoord, defenseType: string): number => {
    const terrain = terrainAt(map, coord);
    const defense =
      terrain.defenseBonus[defenseType as keyof typeof terrain.defenseBonus] ?? 0;
    return -3 * distToObjective(coord) + defense / 10;
  };

  let bestMove: { action: Action; score: number } | null = null;
  for (const unit of myUnits) {
    if (unit.isLeader || unit.movesLeft <= 0) continue;
    const unitDef = getUnitDef(unit.unitDefId);
    const defenseType = unitDef.defenseType ?? unitDef.movement.type;
    const reachable = computeReachable({ unit, unitDef, units: state.units, map });
    const stayScore = hexScore(unit.pos, defenseType);
    for (const node of reachable.values()) {
      if (!canMoveTo(reachable, node.coord)) continue;
      const captures =
        terrainAt(map, node.coord).id === "village" &&
        (state.villageOwners ?? {})[hexKey(node.coord)] !== me;
      const score = hexScore(node.coord, defenseType) + (captures ? 40 : 0);
      // 「今いる場所より明確に良い」場合だけ動く(その場往復のループを防ぐ)
      if (score > stayScore + 0.5 && score > (bestMove?.score ?? -Infinity)) {
        bestMove = {
          action: { type: "move", unitId: unit.id, target: node.coord },
          score,
        };
      }
    }
  }
  if (bestMove) return bestMove.action;

  return { type: "endTurn" };
}
