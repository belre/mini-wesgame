import type { AttackDef, UnitDef } from "../../types";
import { UNDEAD_TRAITS } from "./traitPresets";

// 疫病(plague)で倒された側の種族によって変わる死体のフォーム。
// 本家Wesnoth(data/core/units/undead/Corpse_Walking.cfg)のWalking Corpse
// variationのうち、このゲームの陣営に登場する種族に対応する8種
// (bat/drake/mounted/saurian/swimmer/troll/wolf/wose)を移植。
// HP・移動速度は本家の該当variationをそのまま使用(基本形walking_corpseの
// HP18・移動4が本家と一致しているため換算不要)。攻撃・耐性・コストは
// walking_corpse(基本形)と同一のまま単純化(本家は種族ごとに細かく異なるが、
// 「特性・能力は単純に保つ」方針により差分は見た目とHP/移動のみに絞る)。
// 各Factionから使うにはplagueCorpseUnitIdでこのIDを指す(未配線時点では
// どのFactionからも参照されないため、追加しただけでは挙動は変わらない)。
const ZOMBIE_ATTACK: AttackDef = {
  id: "touch",
  name: "接触",
  damage: 4,
  count: 3,
  type: "impact",
  range: "melee",
  specials: ["plague"],
};
const ZOMBIE_RESISTANCES = { arcane: -40 };

export const ZOMBIE_VARIATIONS: UnitDef[] = [
  {
    id: "zombie_bat",
    name: "ゾンビ(コウモリ)",
    level: 0,
    hp: 15,
    movement: { type: "fly", points: 5 },
    attacks: [{ ...ZOMBIE_ATTACK }],
    resistances: { ...ZOMBIE_RESISTANCES },
    alignment: "chaotic",
    cost: 8,
    spriteKey: "units/undead/zombie_bat",
    traitConfig: UNDEAD_TRAITS, // lv0なので小物(no_zoc)は暗黙付与(疫病スポーンも同様)
  },
  {
    id: "zombie_drake",
    name: "ゾンビ(ドレーク)",
    level: 0,
    hp: 23,
    // 本家は死んだドレークが飛行力を失う設定(drakefoot=地上移動)。walkで近似
    movement: { type: "walk", points: 4 },
    attacks: [{ ...ZOMBIE_ATTACK }],
    resistances: { ...ZOMBIE_RESISTANCES },
    alignment: "chaotic",
    cost: 8,
    spriteKey: "units/undead/zombie_drake",
    traitConfig: UNDEAD_TRAITS,
  },
  {
    id: "zombie_mounted",
    name: "ゾンビ(騎乗)",
    level: 0,
    hp: 21,
    // 移動walk+防御cavalry(game-data-editing skillの騎馬ユニット規約)
    movement: { type: "walk", points: 5 },
    defenseType: "cavalry",
    attacks: [{ ...ZOMBIE_ATTACK }],
    resistances: { ...ZOMBIE_RESISTANCES },
    alignment: "chaotic",
    cost: 8,
    spriteKey: "units/undead/zombie_mounted",
    traitConfig: UNDEAD_TRAITS,
  },
  {
    id: "zombie_saurian",
    name: "ゾンビ(リザード)",
    level: 0,
    hp: 16,
    movement: { type: "walk", points: 4 },
    attacks: [{ ...ZOMBIE_ATTACK }],
    resistances: { ...ZOMBIE_RESISTANCES },
    alignment: "chaotic",
    cost: 8,
    spriteKey: "units/undead/zombie_saurian",
    traitConfig: UNDEAD_TRAITS,
  },
  {
    id: "zombie_swimmer",
    name: "ゾンビ(マーマン)",
    level: 0,
    hp: 18,
    movement: { type: "swim", points: 4 },
    attacks: [{ ...ZOMBIE_ATTACK }],
    resistances: { ...ZOMBIE_RESISTANCES },
    alignment: "chaotic",
    cost: 8,
    spriteKey: "units/undead/zombie_swimmer",
    traitConfig: UNDEAD_TRAITS,
  },
  {
    id: "zombie_troll",
    name: "ゾンビ(トロル)",
    level: 0,
    hp: 21,
    movement: { type: "walk", points: 4 },
    attacks: [{ ...ZOMBIE_ATTACK }],
    resistances: { ...ZOMBIE_RESISTANCES },
    alignment: "chaotic",
    cost: 8,
    spriteKey: "units/undead/zombie_troll",
    traitConfig: UNDEAD_TRAITS,
  },
  {
    id: "zombie_wolf",
    name: "ゾンビ(狼)",
    level: 0,
    hp: 19,
    movement: { type: "walk", points: 5 },
    attacks: [{ ...ZOMBIE_ATTACK }],
    resistances: { ...ZOMBIE_RESISTANCES },
    alignment: "chaotic",
    cost: 8,
    spriteKey: "units/undead/zombie_wolf",
    traitConfig: UNDEAD_TRAITS,
  },
  {
    id: "zombie_wose",
    name: "ゾンビ(トレント)",
    level: 0,
    hp: 26,
    movement: { type: "walk", points: 3 },
    attacks: [{ ...ZOMBIE_ATTACK }],
    resistances: { ...ZOMBIE_RESISTANCES },
    alignment: "chaotic",
    cost: 8,
    spriteKey: "units/undead/zombie_wose",
    traitConfig: UNDEAD_TRAITS,
  },
];
