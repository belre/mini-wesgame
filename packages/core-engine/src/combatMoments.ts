// カットイン演出向けの「今の戦闘で何が起きているか」の要約(2026-07-09)。
// 描画方法には一切踏み込まない純関数 — Web(CutInStage)・将来のExpo版どちらも
// 同じ配列を受け取って、それぞれの流儀で表示するだけでよい設計にする。
// タグは複数同時に成立しうる(例: 統率の加護を受けつつ主城の近く、等)ため常に配列で返す。
//
// 2026-07-10: HP・状態異常・攻撃特殊系のタグ(致死圏・毒・遅化・生命吸収等)は
// mini-wesgameでは情報過多で紛らわしいとの判断で撤去し、統率・リーダー関連
// (統率/主塔に近い/リーダーが攻撃する)の3種のみに絞った(ユーザー判断)
import { hasLeadershipSupport } from "./combat";
import { hexDistance } from "./hex";
import { mapMeta } from "./data/maps";
import type { GameMap, UnitState } from "./types";

export type CombatMomentTag =
  | "leadershipBlessing" // どちらかが統率の加護を受けている
  | "leaderNearHome" // 参加リーダーが自軍の主城(keep)の近くにいる
  | "leaderAttacking"; // 攻撃側がリーダー

// リーダーが「自陣の近く」と見なす主城(keep)からの距離。厳密な基準ではなく演出用の目安
const LEADER_NEAR_HOME_HEXES = 3;

export interface CombatMomentContext {
  attacker: UnitState;
  defender: UnitState;
  units: readonly UnitState[]; // 統率判定に使う全体スナップショット(戦闘前)
  map: GameMap; // リーダー近接判定に使う
}

export function summarizeCombatMoments(ctx: CombatMomentContext): CombatMomentTag[] {
  const tags: CombatMomentTag[] = [];

  if (
    hasLeadershipSupport(ctx.attacker, ctx.units) ||
    hasLeadershipSupport(ctx.defender, ctx.units)
  ) {
    tags.push("leadershipBlessing");
  }

  const keeps = mapMeta(ctx.map).keeps;
  const nearOwnKeep = (u: UnitState) => {
    const keep = keeps[u.owner];
    return !!keep && hexDistance(u.pos, keep) <= LEADER_NEAR_HOME_HEXES;
  };
  if (
    (ctx.attacker.isLeader && nearOwnKeep(ctx.attacker)) ||
    (ctx.defender.isLeader && nearOwnKeep(ctx.defender))
  ) {
    tags.push("leaderNearHome");
  }

  if (ctx.attacker.isLeader) tags.push("leaderAttacking");

  return tags;
}
