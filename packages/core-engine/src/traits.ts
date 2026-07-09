import type { AttackSpecial, Rng, TraitId, UnitAbility, UnitDef } from "./types";

// 特性(個性系)の付与とステータス補正。
// 付与は雇用時に1回だけ行い、結果(traits / maxHp / maxMoves)はUnitStateに固定する。
// 戦闘時に参照される特性(strong/weak/dextrous/fearless/undead/feral/healthy)は
// combat.ts / engine.ts が traits 配列を直接見る。

export const TRAIT_NAMES: Record<TraitId, string> = {
  strong: "Strong",
  intelligent: "Intelligent",
  quick: "Quick",
  resilient: "Resilient",
  dextrous: "Dextrous",
  fearless: "Fearless",
  dim: "Dim",
  slow: "Slow",
  weak: "Weak",
  undead: "Undead",
  healthy: "Healthy",
  feral: "Feral",
  no_zoc: "Puny",
};

export const SPECIAL_NAMES: Record<AttackSpecial, string> = {
  backstab: "Backstab",
  berserk: "Berserk",
  charge: "Charge",
  drain: "Drain",
  firststrike: "First Strike",
  magical: "Magical",
  marksman: "Marksman",
  plague: "Plague",
  poison: "Poison",
  poison_sting: "Poison Sting",
  slow: "Slows",
};

export const ABILITY_NAMES: Record<UnitAbility, string> = {
  ambush: "Ambush",
  submerge: "Submerge",
  cures: "Cures",
  heals4: "Heals +4",
  heals8: "Heals +8",
  leadership: "Leadership",
  regenerates: "Regenerates",
  skirmisher: "Skirmisher", // 2026-07-08 ユーザー指定: 「散兵」は兵科名で効果(ZOC無視)が伝わりにくいため改名(id不変)
  steadfast: "Steadfast",
};

export function hasAbility(def: UnitDef, ability: UnitAbility): boolean {
  return !!def.abilities?.includes(ability);
}

export function hasTrait(traits: readonly TraitId[] | undefined, t: TraitId): boolean {
  return !!traits && traits.includes(t);
}

// 参照用の実効特性: 保存されたtraitsに、レベル0の暗黙特性「小物(no_zoc)」を
// shallow copyで付加して返す。UnitStateのtraitsには保存しない(焼き込まない)ので、
// 昇級してlv1になれば自然に外れる(本家の「レベル0はZOCを持たない」準拠)。
// ルール判定(movement.tsのZOC)と特性表示(UI)はこちらを参照すること
export function effectiveTraits(
  def: UnitDef,
  traits: readonly TraitId[] | undefined,
): readonly TraitId[] {
  const base = traits ?? [];
  if (def.level === 0 && !base.includes("no_zoc")) return [...base, "no_zoc"];
  return base;
}

// 雇用時のランダム付与。forced + pool から picks 個(重複なし)
export function assignTraits(def: UnitDef, rng: Rng): TraitId[] {
  const cfg = def.traitConfig;
  if (!cfg) return [];
  const traits: TraitId[] = [...(cfg.forced ?? [])];
  const pool = [...(cfg.pool ?? [])];
  const picks = Math.min(cfg.picks ?? 0, pool.length);
  for (let i = 0; i < picks; i++) {
    const idx = Math.floor(rng() * pool.length);
    traits.push(pool.splice(idx, 1)[0]);
  }
  return traits;
}

// 特性補正込みの最大HP(固定値の加算 → 割合補正の順)
export function traitMaxHp(def: UnitDef, traits: readonly TraitId[]): number {
  let hp = def.hp;
  if (hasTrait(traits, "strong")) hp += 1;
  if (hasTrait(traits, "resilient")) hp += 4 + def.level;
  if (hasTrait(traits, "healthy")) hp += 2;
  if (hasTrait(traits, "weak")) hp -= 1;
  let ratio = 1;
  if (hasTrait(traits, "quick")) ratio -= 0.05;
  if (hasTrait(traits, "slow")) ratio += 0.05;
  return Math.max(1, Math.round(hp * ratio));
}

// 特性補正込みの移動力
export function traitMoves(def: UnitDef, traits: readonly TraitId[]): number {
  let moves = def.movement.points;
  if (hasTrait(traits, "quick")) moves += 1;
  if (hasTrait(traits, "slow")) moves -= 1;
  return Math.max(1, moves);
}

// 必要経験値(知的: -20% / 凡愚: +20%)。
// デフォルトはレベル0: 30、それ以外: レベル×40
export function maxXpFor(def: UnitDef, traits: readonly TraitId[]): number {
  const base = def.maxXp ?? (def.level === 0 ? 30 : def.level * 40);
  let ratio = 1;
  if (hasTrait(traits, "intelligent")) ratio -= 0.2;
  if (hasTrait(traits, "dim")) ratio += 0.2;
  return Math.max(1, Math.round(base * ratio));
}

// 攻撃の基礎ダメージへの特性補正(近接: 強力+1/非力-1、遠隔: 器用+1)
export function traitDamageBonus(
  range: "melee" | "ranged",
  traits: readonly TraitId[],
): number {
  let bonus = 0;
  if (range === "melee") {
    if (hasTrait(traits, "strong")) bonus += 1;
    if (hasTrait(traits, "weak")) bonus -= 1;
  } else {
    if (hasTrait(traits, "dextrous")) bonus += 1;
  }
  return bonus;
}
