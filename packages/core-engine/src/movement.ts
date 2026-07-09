import { hexKey, hexNeighbors } from "./hex";
import { getUnitDef } from "./data/factions";
import { inBounds, terrainAt } from "./data/maps";
import { IMPASSABLE } from "./data/terrain";
import { effectiveTraits, hasAbility, hasTrait } from "./traits";
import type { GameMap, HexCoord, TerrainDef, UnitDef, UnitState } from "./types";

// 移動範囲計算: ダイクストラ法の変種。
// - 地形コストはユニットの移動タイプ(walk/fly/swim)ごとに参照。defenseTypeが指定されていれば
//   そちらを優先する(騎馬は移動コストも歩兵と異なるため。防御側の解決と同じ規則 — combat.ts参照)。
//   ユニット定義の terrainOverrides でさらに個別上書きできる(例: スケルトンの深海潜行)
// - 敵ユニットのいるヘックスには進入不可
// - 味方ユニットのいるヘックスは通過可能だが停止不可(canStop = false)
// - ZOC: 敵ユニットに隣接するヘックスへ進入した時点で残り移動力を0にする(展開打ち切り)。
//   すり抜け(skirmisher。旧称「散兵」)能力を持つユニットはZOCを無視する。
//   小物(no_zoc。レベル0ユニットに暗黙付与)のユニットはZOCを発しない
//
// クライアントはプレビュー用、サーバーは確定用として同じこの関数を実行する。

export function moveCostFor(unitDef: UnitDef, terrain: TerrainDef, slowed?: boolean): number {
  const costType = unitDef.defenseType ?? unitDef.movement.type;
  const base =
    unitDef.movement.terrainOverrides?.[terrain.id] ??
    terrain.moveCost[costType];
  if (base >= IMPASSABLE) return base; // 進入不可はそのまま(2倍にしても意味が変わらない)
  return slowed ? base * 2 : base; // 遅化: 移動コスト2倍
}

export interface ReachableNode {
  coord: HexCoord;
  cost: number; // 消費した移動力
  remaining: number; // そのヘックス到達時点の残り移動力(ZOC進入で0になる)
  canStop: boolean; // 停止(移動先として選択)可能か
  prev: string | null; // 経路復元用の直前ヘックスkey
}

export interface ComputeReachableParams {
  unit: UnitState;
  unitDef: UnitDef;
  units: UnitState[]; // 盤上の全ユニット
  map: GameMap;
}

export function computeReachable(
  params: ComputeReachableParams,
): Map<string, ReachableNode> {
  const { unit, unitDef, units, map } = params;
  const skirmisher = hasAbility(unitDef, "skirmisher");

  const occupiedByEnemy = new Set<string>();
  const occupiedByAlly = new Set<string>();
  const zocHexes = new Set<string>(); // 敵ユニットに隣接するヘックス
  for (const u of units) {
    if (u.id === unit.id) continue;
    const key = hexKey(u.pos);
    if (u.owner !== unit.owner) {
      occupiedByEnemy.add(key);
      const enemyTraits = effectiveTraits(getUnitDef(u.unitDefId), u.traits);
      if (!skirmisher && !hasTrait(enemyTraits, "no_zoc")) {
        for (const n of hexNeighbors(u.pos)) zocHexes.add(hexKey(n));
      }
    } else {
      occupiedByAlly.add(key);
    }
  }

  const result = new Map<string, ReachableNode>();
  const startKey = hexKey(unit.pos);
  result.set(startKey, {
    coord: unit.pos,
    cost: 0,
    remaining: unit.movesLeft,
    canStop: true, // 現在地に留まるのは常に可
    prev: null,
  });

  // マップが小さい(数十〜100マス)前提の単純な優先度つき探索。
  // 残り移動力が最大のノードから展開する(ZOCがあるため残り移動力の最大化が正)。
  const frontier: string[] = [startKey];
  while (frontier.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (result.get(frontier[i])!.remaining > result.get(frontier[bestIdx])!.remaining) {
        bestIdx = i;
      }
    }
    const currentKey = frontier.splice(bestIdx, 1)[0];
    const current = result.get(currentKey)!;
    if (current.remaining <= 0) continue;

    for (const next of hexNeighbors(current.coord)) {
      if (!inBounds(map, next)) continue;
      const nextKey = hexKey(next);
      if (occupiedByEnemy.has(nextKey)) continue;

      const cost = moveCostFor(unitDef, terrainAt(map, next), unit.slowed);
      if (cost >= IMPASSABLE || cost > current.remaining) continue;

      // ZOCヘックスへ進入したら残り移動力を打ち切る
      const remaining = zocHexes.has(nextKey) ? 0 : current.remaining - cost;
      const existing = result.get(nextKey);
      if (existing && existing.remaining >= remaining) continue;

      result.set(nextKey, {
        coord: next,
        cost: current.cost + cost,
        remaining,
        canStop: !occupiedByAlly.has(nextKey),
        prev: currentKey,
      });
      frontier.push(nextKey);
    }
  }

  return result;
}

// 経路復元(リプレイ・アニメーション用)。target が到達不能なら null。
export function reconstructPath(
  reachable: Map<string, ReachableNode>,
  target: HexCoord,
): HexCoord[] | null {
  let key: string | null = hexKey(target);
  const node = reachable.get(key);
  if (!node) return null;
  const path: HexCoord[] = [];
  while (key !== null) {
    const n: ReachableNode = reachable.get(key)!;
    path.unshift(n.coord);
    key = n.prev;
  }
  return path;
}

// 移動先として有効か(到達可能かつ停止可能)
export function canMoveTo(
  reachable: Map<string, ReachableNode>,
  target: HexCoord,
): boolean {
  const node = reachable.get(hexKey(target));
  return !!node && node.canStop && node.cost > 0;
}
