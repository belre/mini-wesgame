import { hexDistance, hexEquals, hexOpposite } from "./hex";
import { getUnitDef } from "./data/factions";
import { alignmentMultiplier } from "./timeOfDay";
import { hasAbility, hasTrait, traitDamageBonus } from "./traits";
import type {
  AttackDef,
  AttackSpecial,
  DefenseType,
  Rng,
  TerrainDef,
  TimeOfDayDef,
  TraitId,
  UnitDef,
  UnitState,
} from "./types";

// 戦闘解決と期待値計算。
// クライアント: predictCombat をプレビュー表示に呼ぶ
// サーバー: 同じ関数で妥当性検証したうえで、resolveCombat に crypto random を注入して確定する
//
// 攻撃特性(奇襲/狂戦/突撃/生命吸収/先制/魔法/精密/疫病/毒)と
// 特性(強力/非力/器用/勇敢/野生/アンデッド)はここで解決される。
// 疫病(倒した相手の死体化)は盤面操作を伴うため engine.ts 側で CombatResult を見て処理する。

export const BERSERK_ROUNDS = 30;

// 複合特性の展開表: 毒針(poison_sting) = 精密(marksman) + 毒(poison)。
// プレイヤー向けの表示を1語に保つためのデータ上の包装で、ルール上は構成要素に展開して扱う。
// 精密単体はデータでは未使用(分かりづらいため定義しない方針)だがルールとしては残している
const COMPOSITE_SPECIALS: Partial<Record<AttackSpecial, readonly AttackSpecial[]>> = {
  poison_sting: ["marksman", "poison"],
};

export function hasSpecial(attack: AttackDef | null | undefined, s: AttackSpecial): boolean {
  const specials = attack?.specials;
  if (!specials) return false;
  return specials.some((x) => x === s || !!COMPOSITE_SPECIALS[x]?.includes(s));
}

// 命中率のベースは「100 - 防御側地形の防御率(DefenseType別)」。
// defenseOverride指定時はユニット個別の防御率を地形表の代わりに使う
// (UnitDef.defenseOverrides。movement.terrainOverridesの防御版)。
// 野生(feral)特性は村の防御率が50%に制限される(上書き値にも適用)。
export function hitChanceAgainst(
  defenderTerrain: TerrainDef,
  defenderDefenseType: DefenseType,
  defenderTraits?: readonly TraitId[],
  defenseOverride?: number,
): number {
  let defense = defenseOverride ?? defenderTerrain.defenseBonus[defenderDefenseType];
  if (hasTrait(defenderTraits, "feral") && defenderTerrain.id === "village") {
    defense = Math.min(defense, 50);
  }
  return (100 - defense) / 100;
}

// 魔法(magical): 常に70% / 精密(marksman): 攻撃側で使うとき最低60%
function computeHitChance(
  attack: AttackDef,
  targetTerrain: TerrainDef,
  targetDef: UnitDef,
  targetTraits: readonly TraitId[] | undefined,
  offense: boolean,
): number {
  if (hasSpecial(attack, "magical")) return 0.7;
  // defenseTypeが指定されていればそれを優先(騎馬など移動タイプと防御タイプが異なるユニット)
  const defenseType: DefenseType = targetDef.defenseType ?? targetDef.movement.type;
  const defenseOverride = targetDef.defenseOverrides?.[targetTerrain.id];
  let p = hitChanceAgainst(targetTerrain, defenseType, targetTraits, defenseOverride);
  if (offense && hasSpecial(attack, "marksman")) p = Math.max(p, 0.6);
  return p;
}

// 攻撃側だけで決まる基礎ダメージ(基礎値+特性補正) × 時間帯補正(勇敢は不利補正を無効化)。
// 対象(耐性・装甲・突撃/奇襲等)を必要としない部分だけを切り出した共通処理 —
// strikeDamage(対象確定後の本番計算)とdisplayDamage(対象未確定の表示用見積り)の両方から使う。
// ここを2箇所に書き散らすと、時間帯補正の式がズレて表示と実際の戦闘で数値が食い違う
// (2026-07-08: 実際にUIで基礎値のまま表示されていた不具合の再発防止)
function attackerOnlyDamage(
  attack: AttackDef,
  attackerDef: UnitDef,
  timeOfDay: TimeOfDayDef,
  attackerTraits: readonly TraitId[],
): { base: number; alignMult: number } {
  const base = Math.max(1, attack.damage + traitDamageBonus(attack.range, attackerTraits));
  let alignMult = alignmentMultiplier(attackerDef.alignment, timeOfDay);
  if (hasTrait(attackerTraits, "fearless") && alignMult < 1) alignMult = 1;
  return { base, alignMult };
}

// ダメージの丸め(本家1.18のround_damage準拠。2026-07-14 Reddit報告の調査で判明):
// .5ちょうどのときは「基礎値側へ寄せる」= ボーナス(総合倍率>1)は切り捨て・
// ペナルティ(<1)は切り上げ。それ以外は通常の四捨五入。
// 本家は整数演算だが、こちらは倍率を浮動小数で合成しているため.5ちょうどを
// epsilonで判定する(倍率は1.25/0.75/2/0.5/(100-耐性)/100の積なので十分内側に入る)
function roundDamage(raw: number, totalMult: number): number {
  const frac = raw - Math.floor(raw);
  const isHalf = Math.abs(frac - 0.5) < 1e-9;
  const rounded = isHalf
    ? totalMult > 1
      ? Math.floor(raw)
      : Math.ceil(raw)
    : Math.round(raw);
  return Math.max(1, rounded);
}

// 1打あたりのダメージ
// = max(1, 基礎値+特性補正) × 時間帯補正(勇敢は不利補正を無効化) × 統率(+25%)
//   × 耐性補正(装甲: 防御側の正の耐性を2倍・上限50%) × 特効倍率(突撃/奇襲)
// 端数は本家round_damage準拠(.5は基礎値側へ)、最低1
export function strikeDamage(
  attack: AttackDef,
  attackerDef: UnitDef,
  defenderDef: UnitDef,
  timeOfDay: TimeOfDayDef,
  opts?: {
    attackerTraits?: readonly TraitId[];
    multiplier?: number;
    leadership?: boolean; // 統率持ちの味方が隣接しているか
    steadfastDefender?: boolean; // 対象が装甲能力持ちで、かつ防御側か
  },
): number {
  let resistance = defenderDef.resistances[attack.type] ?? 0;
  if (opts?.steadfastDefender && resistance > 0) {
    resistance = Math.min(50, resistance * 2); // 装甲: 弱点(負の値)には効果なし
  }
  const { base, alignMult } = attackerOnlyDamage(
    attack, attackerDef, timeOfDay, opts?.attackerTraits ?? []);
  const totalMult =
    alignMult *
    (opts?.leadership ? 1.25 : 1) *
    ((100 - resistance) / 100) *
    (opts?.multiplier ?? 1);
  return roundDamage(base * totalMult, totalMult);
}

// 表示用の見積りダメージ: 対象(敵ユニット)が定まっていない場面(ユニット情報パネル等)で
// 「今この瞬間の攻撃力」を出すためのヘルパー。耐性・装甲・突撃/奇襲といった対象依存の
// 特効は反映できない(対象が決まった時点でstrikeDamage/predictCombatが正の値を出す)。
// UI側で `a.damage * alignMult` のような即席計算を書き散らすと、統率・遅化等の
// 補正漏れや時間帯補正の式違いが起きやすいため、必ずこちらを経由すること
export function displayDamage(
  attack: AttackDef,
  attackerDef: UnitDef,
  timeOfDay: TimeOfDayDef,
  opts?: {
    attackerTraits?: readonly TraitId[];
    leadership?: boolean; // hasLeadershipSupport(unit, board.units) の結果を渡す
    slowed?: boolean; // unit.slowed。半減(端数の丸めはstrikeDamageと同じ最終丸め)
  },
): number {
  const { base, alignMult } = attackerOnlyDamage(
    attack, attackerDef, timeOfDay, opts?.attackerTraits ?? []);
  const totalMult = alignMult * (opts?.leadership ? 1.25 : 1) * (opts?.slowed ? 0.5 : 1);
  return roundDamage(base * totalMult, totalMult);
}

// 統率: 同じ側の統率能力持ちユニットが隣接していれば与ダメージ+25%。
// 実際にボーナスを提供している隣接ユニット本体が要る場面(カットインの演出判定等)向けに
// 提供元自体を返す版を分離し、hasLeadershipSupportはその有無だけを見る薄いラッパーにする
export function leadershipSupportersOf(
  unit: UnitState,
  units: readonly UnitState[] | undefined,
): UnitState[] {
  if (!units) return [];
  return units.filter(
    (u) =>
      u.id !== unit.id &&
      u.owner === unit.owner &&
      u.hp > 0 &&
      hasAbility(getUnitDef(u.unitDefId), "leadership") &&
      hexDistance(u.pos, unit.pos) === 1,
  );
}

export function hasLeadershipSupport(
  unit: UnitState,
  units: readonly UnitState[] | undefined,
): boolean {
  return leadershipSupportersOf(unit, units).length > 0;
}

// このユニットにまだ意味のある行動が残っているか(表示用: 行動状態リング等)。
// movesLeft/attacksLeftの単純な残量だけでは不十分 — 村占領は移動終了時にmovesLeftだけ
// 0にする(engine.ts)ため、隣に敵がいないのにattacksLeftが残って「まだ行動可能」に
// 見えてしまう。ZOCで移動が止まった場合は定義上すでに敵に隣接しているため、この
// チェックで自然に「行動可能」のまま扱われる(特別扱い不要。2026-07-08)
export function hasRemainingAction(
  unit: UnitState,
  units: readonly UnitState[],
): boolean {
  if (unit.movesLeft > 0) return true;
  if (unit.attacksLeft <= 0) return false;
  return units.some(
    (u) => u.id !== unit.id && u.owner !== unit.owner && u.hp > 0 && hexDistance(u.pos, unit.pos) === 1,
  );
}

// 防御側の反撃手段: 同レンジの攻撃のうち期待ダメージ最大のものを選ぶ
export function chooseRetaliation(
  defenderDef: UnitDef,
  attackerDef: UnitDef,
  range: AttackDef["range"],
  timeOfDay: TimeOfDayDef,
): { attack: AttackDef; index: number } | null {
  let best: { attack: AttackDef; index: number; score: number } | null = null;
  for (let index = 0; index < defenderDef.attacks.length; index++) {
    const attack = defenderDef.attacks[index];
    if (attack.range !== range) continue;
    const score =
      strikeDamage(attack, defenderDef, attackerDef, timeOfDay) * attack.count;
    if (!best || score > best.score) best = { attack, index, score };
  }
  return best ? { attack: best.attack, index: best.index } : null;
}

// 奇襲(backstab): 防御側から見て攻撃側の正反対のヘックスに「防御側の敵」がいるとき成立
export function isBackstab(
  attacker: UnitState,
  defender: UnitState,
  units: readonly UnitState[] | undefined,
): boolean {
  if (!units) return false;
  const opposite = hexOpposite(attacker.pos, defender.pos);
  const unit = units.find((u) => u.hp > 0 && hexEquals(u.pos, opposite));
  return !!unit && unit.owner !== defender.owner && unit.id !== attacker.id;
}

export interface CombatContext {
  attacker: UnitState;
  attackerDef: UnitDef;
  defender: UnitState;
  defenderDef: UnitDef;
  attack: AttackDef; // 攻撃側が選択した攻撃
  attackerTerrain: TerrainDef;
  defenderTerrain: TerrainDef;
  timeOfDay: TimeOfDayDef;
  units?: readonly UnitState[]; // 奇襲判定用(省略時は奇襲不成立)
}

interface SidePlan {
  attack: AttackDef;
  damage: number;
  hitChance: number;
  strikes: number; // 1ラウンドあたり
}

interface CombatPlans {
  attackerPlan: SidePlan;
  defenderPlan: SidePlan | null;
  rounds: number; // 狂戦なら30、通常1
  defenderFirst: boolean; // 先制(firststrike)
  backstab: boolean;
  charge: boolean;
}

// 予測と確定が必ず同じ数値を使うよう、計画の組み立てを一本化する
function buildPlans(ctx: CombatContext): CombatPlans {
  const { attacker, attackerDef, defender, defenderDef, attack, timeOfDay } = ctx;
  const retaliation = chooseRetaliation(defenderDef, attackerDef, attack.range, timeOfDay);

  const charge = hasSpecial(attack, "charge");
  const backstab = hasSpecial(attack, "backstab") && isBackstab(attacker, defender, ctx.units);
  let attackerMult = 1;
  if (charge) attackerMult *= 2; // 突撃: 与ダメージ2倍
  if (backstab) attackerMult *= 2; // 奇襲: 2倍
  if (attacker.slowed) attackerMult *= 0.5; // 遅化: 自分の攻撃ダメージ半減
  let defenderMult = charge ? 2 : 1; // 突撃: 被ダメージも2倍
  if (defender.slowed) defenderMult *= 0.5; // 遅化: 反撃ダメージも半減

  const attackerPlan: SidePlan = {
    attack,
    damage: strikeDamage(attack, attackerDef, defenderDef, timeOfDay, {
      attackerTraits: attacker.traits,
      multiplier: attackerMult,
      leadership: hasLeadershipSupport(attacker, ctx.units),
      // 装甲(steadfast)は「防御しているユニット」にのみ効く
      steadfastDefender: hasAbility(defenderDef, "steadfast"),
    }),
    hitChance: computeHitChance(attack, ctx.defenderTerrain, defenderDef, defender.traits, true),
    strikes: attack.count,
  };

  const defenderPlan: SidePlan | null = retaliation
    ? {
        attack: retaliation.attack,
        damage: strikeDamage(retaliation.attack, defenderDef, attackerDef, timeOfDay, {
          attackerTraits: defender.traits,
          multiplier: defenderMult,
          leadership: hasLeadershipSupport(defender, ctx.units),
          steadfastDefender: false, // 攻撃側は装甲の恩恵を受けない
        }),
        hitChance: computeHitChance(
          retaliation.attack,
          ctx.attackerTerrain,
          attackerDef,
          attacker.traits,
          false,
        ),
        strikes: retaliation.attack.count,
      }
    : null;

  const berserk =
    hasSpecial(attack, "berserk") ||
    (defenderPlan ? hasSpecial(defenderPlan.attack, "berserk") : false);
  const defenderFirst =
    !!defenderPlan &&
    hasSpecial(defenderPlan.attack, "firststrike") &&
    !hasSpecial(attack, "firststrike");

  return {
    attackerPlan,
    defenderPlan,
    rounds: berserk ? BERSERK_ROUNDS : 1,
    defenderFirst,
    backstab,
    charge,
  };
}

export interface CombatPrediction {
  hitChance: number; // 攻撃側の命中率 [0,1]
  expectedDamageDealt: number; // 期待与ダメージ(1ラウンドあたり)
  expectedDamageTaken: number; // 期待被ダメージ(1ラウンドあたり)
  damagePerStrike: number;
  strikes: number;
  rounds: number; // 狂戦なら30
  backstab: boolean; // 現在の位置取りで奇襲が成立しているか
  retaliation: {
    attack: AttackDef;
    hitChance: number;
    damagePerStrike: number;
    strikes: number;
  } | null;
}

export function predictCombat(ctx: CombatContext): CombatPrediction {
  const plans = buildPlans(ctx);
  const a = plans.attackerPlan;
  const d = plans.defenderPlan;
  return {
    hitChance: a.hitChance,
    expectedDamageDealt: a.hitChance * a.damage * a.strikes,
    expectedDamageTaken: d ? d.hitChance * d.damage * d.strikes : 0,
    damagePerStrike: a.damage,
    strikes: a.strikes,
    rounds: plans.rounds,
    backstab: plans.backstab,
    retaliation: d
      ? {
          attack: d.attack,
          hitChance: d.hitChance,
          damagePerStrike: d.damage,
          strikes: d.strikes,
        }
      : null,
  };
}

export interface StrikeEvent {
  actor: "attacker" | "defender";
  hit: boolean;
  damage: number; // 外れた場合は0
  targetHpAfter: number;
  drained?: number; // 生命吸収での回復量
}

export interface CombatResult {
  strikes: StrikeEvent[];
  rounds: number; // 実際に行われたラウンド数
  attackerHpAfter: number;
  defenderHpAfter: number;
  attackerDied: boolean;
  defenderDied: boolean;
  attackerPoisoned: boolean; // この戦闘で新たに毒になったか
  defenderPoisoned: boolean;
  attackerSlowed: boolean; // この戦闘で新たに遅化状態になったか(次の戦闘から自分のダメージが半減)
  defenderSlowed: boolean;
  retaliationAttack: AttackDef | null; // 防御側が使った反撃(疫病判定に使用)
}

// 攻守が打ち合う。どちらかが倒れた時点で終了。狂戦なら最大30ラウンド繰り返す。
export function resolveCombat(ctx: CombatContext, rng: Rng): CombatResult {
  const { attacker, attackerDef, defender, defenderDef } = ctx;
  const plans = buildPlans(ctx);

  let attackerHp = attacker.hp;
  let defenderHp = defender.hp;
  const attackerMaxHp = attacker.maxHp ?? attackerDef.hp;
  const defenderMaxHp = defender.maxHp ?? defenderDef.hp;
  let attackerPoisoned = false;
  let defenderPoisoned = false;
  let attackerSlowed = false;
  let defenderSlowed = false;
  const strikes: StrikeEvent[] = [];

  const doStrike = (side: "attacker" | "defender") => {
    const plan = side === "attacker" ? plans.attackerPlan : plans.defenderPlan!;
    const hit = rng() < plan.hitChance;
    let damage = 0;
    let drained: number | undefined;
    if (hit) {
      damage = plan.damage;
      const targetTraits = side === "attacker" ? defender.traits : attacker.traits;
      if (side === "attacker") defenderHp = Math.max(0, defenderHp - damage);
      else attackerHp = Math.max(0, attackerHp - damage);

      // 生命吸収: 与ダメージの半分回復(アンデッド特性には無効)
      if (hasSpecial(plan.attack, "drain") && !hasTrait(targetTraits, "undead")) {
        drained = Math.floor(damage / 2);
        if (side === "attacker") {
          attackerHp = Math.min(attackerMaxHp, attackerHp + drained);
        } else {
          defenderHp = Math.min(defenderMaxHp, defenderHp + drained);
        }
      }
      // 毒: 命中で毒状態に(アンデッド特性には無効)
      if (hasSpecial(plan.attack, "poison") && !hasTrait(targetTraits, "undead")) {
        if (side === "attacker" && !defender.poisoned) defenderPoisoned = true;
        if (side === "defender" && !attacker.poisoned) attackerPoisoned = true;
      }
      // 遅化: 命中で鈍化状態に。この戦闘中の自分のダメージには影響せず、次の戦闘から適用される
      if (hasSpecial(plan.attack, "slow")) {
        if (side === "attacker" && !defender.slowed) defenderSlowed = true;
        if (side === "defender" && !attacker.slowed) attackerSlowed = true;
      }
    }
    strikes.push({
      actor: side,
      hit,
      damage,
      targetHpAfter: side === "attacker" ? defenderHp : attackerHp,
      ...(drained !== undefined ? { drained } : {}),
    });
  };

  const order: ("attacker" | "defender")[] = plans.defenderFirst
    ? ["defender", "attacker"]
    : ["attacker", "defender"];
  let roundsDone = 0;

  outer: for (let round = 0; round < plans.rounds; round++) {
    roundsDone++;
    const attackerCount = plans.attackerPlan.strikes;
    const defenderCount = plans.defenderPlan?.strikes ?? 0;
    for (let i = 0; i < Math.max(attackerCount, defenderCount); i++) {
      for (const side of order) {
        if (attackerHp <= 0 || defenderHp <= 0) break outer;
        const count = side === "attacker" ? attackerCount : defenderCount;
        if (i >= count) continue;
        doStrike(side);
      }
    }
    if (attackerHp <= 0 || defenderHp <= 0) break;
  }

  return {
    strikes,
    rounds: roundsDone,
    attackerHpAfter: attackerHp,
    defenderHpAfter: defenderHp,
    attackerDied: attackerHp === 0,
    defenderDied: defenderHp === 0,
    attackerPoisoned,
    defenderPoisoned,
    attackerSlowed,
    defenderSlowed,
    retaliationAttack: plans.defenderPlan?.attack ?? null,
  };
}
