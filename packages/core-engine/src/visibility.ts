import { getUnitDef } from "./data/factions";
import { mapById, terrainAt } from "./data/maps";
import { hexDistance, hexKey } from "./hex";
import { hasAbility } from "./traits";
import type { MatchState, UnitState } from "./types";

// 可視判定: 霧(FOG)と伏兵(ambush)・潜水(submerge)。
// サーバーはこれを使って「閲覧者ごとに見える盤面」へフィルタしてから返す
// (隠れた敵ユニットの情報をクライアントに一切渡さないことでチートを防ぐ)。
//
// 霧の視界ルール(fogEnabledのマッチのみ):
// - 自軍の各ユニットから「ヘックス距離 ≤ そのユニットの移動力(maxMoves)」が視界
//   (地形コストを使わない距離ベースの簡易版。隣接ヘックスが必ず視界に入るため、
//    伏兵・潜水の「隣接で発覚」ルールと矛盾しない)
// - 視界外の敵ユニットは見えない。視界外の敵村の領有情報も隠す(自軍の村は常に把握)
//
// 伏兵・潜水の可視ルール(状態を持たない。都度この条件で再計算する):
// - 伏兵持ちが森 / 潜水持ちが深海にいる間は敵から見えない。ただし
//   - 閲覧者側のユニットが隣接している場合は見える
//   - 攻撃した後(attacksLeft = 0)はそのターンの間見える(次の自ターン開始のリフレッシュで再び隠れる)

// 閲覧者の視界ヘックス集合。霧なしなら null(=全ヘックス可視)を返す。
// filterStateForViewer や engine の移動処理のように複数ユニットを判定する場合は
// これを一度だけ計算して isHiddenFrom に渡すこと。
export function computeVisionSet(
  state: MatchState,
  viewerIndex: number,
): Set<string> | null {
  if (!state.fogEnabled) return null;
  const map = mapById(state.mapId);
  const viewers = state.units
    .filter((u) => u.owner === viewerIndex)
    .map((u) => ({
      pos: u.pos,
      range: u.maxMoves ?? getUnitDef(u.unitDefId).movement.points,
    }));
  const vision = new Set<string>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const coord = { x, y };
      if (viewers.some((v) => hexDistance(v.pos, coord) <= v.range)) {
        vision.add(hexKey(coord));
      }
    }
  }
  return vision;
}

export function isHiddenFrom(
  unit: UnitState,
  viewerIndex: number,
  state: MatchState,
  visionSet?: Set<string> | null, // 未指定なら内部で計算(単発判定用)
): boolean {
  if (unit.owner === viewerIndex) return false;

  // 霧: 視界外の敵は見えない
  const vision =
    visionSet === undefined ? computeVisionSet(state, viewerIndex) : visionSet;
  if (vision && !vision.has(hexKey(unit.pos))) return true;

  // 伏兵・潜水
  const def = getUnitDef(unit.unitDefId);
  const map = mapById(state.mapId);
  const terrainId = terrainAt(map, unit.pos).id;
  const hiding =
    (hasAbility(def, "ambush") && terrainId === "forest") ||
    (hasAbility(def, "submerge") && terrainId === "deep_water");
  if (!hiding) return false;
  if (unit.attacksLeft <= 0) return false; // 行動済み(攻撃した等)は露見する
  const spotted = state.units.some(
    (u) => u.owner === viewerIndex && hexDistance(u.pos, unit.pos) === 1,
  );
  return !spotted;
}

// 閲覧者に見える盤面へフィルタする。参加者でない閲覧者(観戦)には両陣営の隠れユニットを隠す。
export function filterStateForViewer(
  state: MatchState,
  viewerUserId: string,
): MatchState {
  const viewerIndex = state.players.findIndex((p) => p.userId === viewerUserId);

  if (viewerIndex < 0) {
    // 観戦者: どちらの隠密ユニットも見せない(霧は適用しない。観戦は正式機能化時に再設計)
    return {
      ...state,
      units: state.units.filter((u) => !isHiddenFrom(u, 1 - u.owner, state, null)),
    };
  }

  const vision = computeVisionSet(state, viewerIndex);
  const units = state.units.filter(
    (u) => !isHiddenFrom(u, viewerIndex, state, vision),
  );

  // 霧: 視界外の敵村の領有情報を隠す(自軍の村は常に把握している)
  let villageOwners = state.villageOwners ?? {};
  if (vision) {
    villageOwners = Object.fromEntries(
      Object.entries(villageOwners).filter(
        ([key, owner]) => owner === viewerIndex || vision.has(key),
      ),
    );
  }

  return { ...state, units, villageOwners };
}
