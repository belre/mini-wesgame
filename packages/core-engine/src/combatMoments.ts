// カットイン演出向けの「今の戦闘で何が起きているか」の要約(2026-07-09)。
// 描画方法には一切踏み込まない純関数 — Web(CutInStage)・将来のExpo版どちらも
// 同じ配列を受け取って、それぞれの流儀で表示するだけでよい設計にする。
// タグは複数同時に成立しうる(例: 統率の加護を受けつつ死闘、等)ため常に配列で返す。
//
// 重要: 全タグは「攻撃側(このカットインで攻撃を仕掛けた側)」基準の客観的事実であり、
// 視聴者がattacker/defenderのどちら側かは考慮していない。CPU/相手が自分を攻撃してくる
// 場面では自分のユニットが防御側になるため、closeToDefeatingEnemy(=防御側のHPが低い)は
// 実際には「自分がピンチ」という悪い知らせになる。演出(音・エフェクト等)に感情価を
// 紐づける際は、必ずmyIndex === attacker.owner等で視聴者視点に読み替えてから使うこと。
import { hasLeadershipSupport, hasSpecial, strikeDamage } from "./combat";
import { hexDistance } from "./hex";
import { mapMeta } from "./data/maps";
import type { AttackDef, GameMap, TimeOfDayDef, UnitDef, UnitState } from "./types";

export type CombatMomentTag =
  | "closeToDefeatingEnemy" // 敵を倒しそう(相手=防御側のHPが低い)
  | "closeToBeingDefeated" // 危険、倒されるかも(自分=攻撃側のHPが低い。反撃の脅威が前提)
  | "desperateClash" // 死闘(攻撃側・防御側の双方のHPが低い)
  | "poisonedAttacker" // 攻撃側が毒状態で攻撃をする
  | "slowedAttacker" // 攻撃側が遅化状態で攻撃をする
  | "plagueAttack" // 使用中の攻撃(攻撃・反撃どちらでも)が疫病持ち
  | "poisonAttack" // 使用中の攻撃(攻撃・反撃どちらでも)が素の毒持ち(グールの爪など。毒針とは別枠)
  | "poisonStingAttack" // 攻撃側が毒針(精密+毒の複合)を使う
  | "slowAttack" // 使用中の攻撃(攻撃・反撃どちらでも)が遅化持ち
  | "drainAttack" // 使用中の攻撃(攻撃・反撃どちらでも)が生命吸収持ち
  | "leadershipBlessing" // どちらかが統率の加護を受けている
  | "leaderNearHome" // 参加リーダーが自軍の主城(keep)の近くにいる
  | "leaderUnderAttack" // 防御側がリーダー
  | "leaderAttacking"; // 攻撃側がリーダー

// リーダーが「自陣の近く」と見なす主城(keep)からの距離。厳密な基準ではなく演出用の目安
const LEADER_NEAR_HOME_HEXES = 3;

export interface CombatMomentContext {
  attacker: UnitState;
  attackerDef: UnitDef;
  defender: UnitState;
  defenderDef: UnitDef;
  attack: AttackDef; // 攻撃側が選択した攻撃
  retaliationAttack?: AttackDef | null; // 防御側の反撃(不可なら null/undefined)
  timeOfDay: TimeOfDayDef;
  units: readonly UnitState[]; // 統率判定に使う全体スナップショット(戦闘前)
  map: GameMap; // リーダー近接判定に使う
}

// 「あと一押しで倒せる/倒されそう」の閾値: 攻撃回数Nに対しmax(N-1, 1)発が
// 致死圏に入るかで判定する(単発攻撃はN=1をそのまま基準に使う。ユーザー指定の定義)
function nearLethal(attack: AttackDef, hp: number, perHitDamage: number): boolean {
  return hp > 0 && hp <= Math.max(attack.count - 1, 1) * perHitDamage;
}

// hasSpecialは毒針(poison_sting)を「精密+毒」に展開するため、これで"poison"を見ると
// 毒針の攻撃にも反応してしまう。ここでは素の毒だけを別枠のタグにしたいので、
// 展開前のspecials配列を直接見る(毒針はpoisonStingAttack側だけが拾う)
function hasPlainPoison(attack: AttackDef | null | undefined): boolean {
  return !!attack?.specials?.includes("poison");
}

export function summarizeCombatMoments(ctx: CombatMomentContext): CombatMomentTag[] {
  const tags: CombatMomentTag[] = [];

  // 敵を倒しそう: 相手(防御側)のHPが、攻撃側の攻撃で致死圏に入っているか
  const attackDamage = strikeDamage(ctx.attack, ctx.attackerDef, ctx.defenderDef, ctx.timeOfDay, {
    leadership: hasLeadershipSupport(ctx.attacker, ctx.units),
  });
  const defenderNearDeath = nearLethal(ctx.attack, ctx.defender.hp, attackDamage);
  if (defenderNearDeath) tags.push("closeToDefeatingEnemy");

  // 危険、倒されるかも: 自分(攻撃側)のHPが、反撃で致死圏に入っているか。
  // 「敵を倒しそう」とは別の独立した条件(2026-07-09: 両者が同じ条件を共有していて
  // 常に同時表示になるバグがあったため分離した)
  let attackerNearDeath = false;
  if (ctx.retaliationAttack) {
    const retaliationDamage = strikeDamage(
      ctx.retaliationAttack,
      ctx.defenderDef,
      ctx.attackerDef,
      ctx.timeOfDay,
      { leadership: hasLeadershipSupport(ctx.defender, ctx.units) },
    );
    attackerNearDeath = nearLethal(ctx.retaliationAttack, ctx.attacker.hp, retaliationDamage);
  }
  if (attackerNearDeath) tags.push("closeToBeingDefeated");
  if (attackerNearDeath && defenderNearDeath) tags.push("desperateClash");

  if (ctx.attacker.poisoned) tags.push("poisonedAttacker");
  if (ctx.attacker.slowed) tags.push("slowedAttacker");

  if (hasSpecial(ctx.attack, "plague") || hasSpecial(ctx.retaliationAttack, "plague")) {
    tags.push("plagueAttack");
  }
  if (hasPlainPoison(ctx.attack) || hasPlainPoison(ctx.retaliationAttack)) {
    tags.push("poisonAttack");
  }
  if (hasSpecial(ctx.attack, "poison_sting")) tags.push("poisonStingAttack");
  if (hasSpecial(ctx.attack, "slow") || hasSpecial(ctx.retaliationAttack, "slow")) {
    tags.push("slowAttack");
  }
  if (hasSpecial(ctx.attack, "drain") || hasSpecial(ctx.retaliationAttack, "drain")) {
    tags.push("drainAttack");
  }

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

  if (ctx.defender.isLeader) tags.push("leaderUnderAttack");
  if (ctx.attacker.isLeader) tags.push("leaderAttacking");

  return tags;
}
