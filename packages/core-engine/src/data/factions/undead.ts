import type { Faction } from "../../types";
import {
  BAT_TRAITS,
  GHOUL_TRAITS,
  HUMAN_TRAITS,
  UNDEAD_TRAITS,
} from "./traitPresets";
import { ZOMBIE_VARIATIONS } from "./zombie";

// アンデッド(フェーズ1の実装対象)
const SKELETON_RESISTANCES = {
  blade: 40,
  pierce: 60,
  impact: -20,
  fire: -20,
  cold: 60,
  arcane: -50,
} as const;

export const UNDEAD: Faction = {
  id: "undead",
  name: "アンデッド",
  defaultLeaderUnitId: "dark_sorcerer",
  assetPackUrl: "/assets/packs/undead.json",
  recruitableUnitIds: [
    "skeleton",
    "skeleton_archer",
    "dark_adapt",
    "ghoul",
    "ghost",
    "vampire_bat",
    "walking_corpse"
  ],
  availableLeaderUnitIds:[
    "lich",
    "dark_sorcerer",
    "deathblade"
  ],
  units: [
    {
      id: "lich",
      name: "リッチ",
      level: 2,
      hp: 28,
      movement: { type: "walk", points: 5 },
      attacks: [
        { id: "staff", name: "杖", damage: 6, count: 2, type: "impact", range: "melee" },
        {
          id: "cold_wave",
          name: "冷気の波動",
          damage: 12,
          count: 2,
          type: "cold",
          range: "ranged",
          specials: ["magical"],
        },
        { id: "shadow_wave", name: "影の波動", damage: 8, count: 2, type: "arcane", range: "ranged"},
      ],
      resistances: {},
      alignment: "chaotic",
      cost: 32,
      spriteKey: "units/undead/lich",
      traitConfig: UNDEAD_TRAITS,
    },
    {
      id: "dark_sorcerer",
      name: "黒魔術師",
      level: 2,
      hp: 28,
      movement: { type: "walk", points: 5 },
      attacks: [
        { id: "staff", name: "杖", damage: 6, count: 2, type: "impact", range: "melee" },
        {
          id: "cold_wave",
          name: "冷気の波動",
          damage: 12,
          count: 2,
          type: "cold",
          range: "ranged",
          specials: ["magical"],
        },
        { id: "shadow_wave", name: "影の波動", damage: 8, count: 2, type: "arcane", range: "ranged"},
      ],
      resistances: {},
      alignment: "chaotic",
      cost: 32,
      spriteKey: "units/undead/dark_sorcerer",
      traitConfig: HUMAN_TRAITS, // 黒魔術師は生きた人間
    },
    {
      id: "deathblade",
      name: "ウォーリアー",
      level: 2,
      hp: 39,
      movement: { type: "walk", points: 6},
      attacks: [
        {
          id: "axe",
          name: "斧",
          damage: 8,
          count: 5,
          type: "blade",
          range: "melee"
        }
      ],
      resistances: {...SKELETON_RESISTANCES},
      cost: 28,
      alignment: "chaotic",
      spriteKey: "units/undead/deathblade",
      traitConfig: UNDEAD_TRAITS
    },
    {
      id: "bone_archer",
      name: "アーチャー",
      level: 2,
      hp: 40,
      movement: { type: "walk", points: 5},
      attacks: [
        { id: "dagger", name: "ダガー", damage: 6, count: 2, type: "impact", range: "melee" },
        { id: "bow", name: "弓", damage: 10, count: 3, type: "pierce", range: "ranged" },
      ],
      resistances: { ...SKELETON_RESISTANCES },
      alignment: "chaotic",
      cost: 26,
      spriteKey: "units/undead/skeleton_banebow",
      traitConfig: UNDEAD_TRAITS,
    },
    {
      id: "wraith",
      name: "ゴースト",
      level: 2,
      hp: 25,
      movement: { type: "fly", points: 7},
      attacks: [
        {
          id: "deathsword",
          name: "死の剣",
          damage: 6,
          count: 4,
          type: "arcane",
          range: "melee",
          specials: ["drain"],
        },
        { id: "scream", name: "叫び声", damage: 4, count: 3, type: "cold", range: "ranged" },
      ],
      resistances: {
        blade: 50, pierce: 50, impact: 50,
        fire: 10, cold: 70, arcane: -10 
      },
      alignment: "chaotic",
      cost: 20,
      spriteKey: "units/undead/wraith",
      traitConfig: UNDEAD_TRAITS,
    },
    {
      id: "necrophage",
      name: "グール",
      level: 1,
      hp: 33,
      movement: { type: "walk", points: 5 },
      attacks: [
        {
          id: "claws",
          name: "爪",
          damage: 4,
          count: 3,
          type: "blade",
          range: "melee",
          specials: ["poison"],
        },
      ],
      resistances: {
        blade: 10, pierce: 30,
        fire: 10, cold: 40, arcane: 20 },
      alignment: "chaotic",
      cost: 16,
      spriteKey: "units/undead/necrophage",
      traitConfig: GHOUL_TRAITS, // アンデッド固定のみ(2026-07-08: 勇敢はトロル専用に)
    },
    {
      id: "bloodbat",
      name: "コウモリ",
      level: 1,
      hp: 27,
      movement: { type: "fly", points: 9},
      attacks: [
        {
          id: "fangs",
          name: "牙",
          damage: 5,
          count: 3,
          type: "blade",
          range: "melee",
          specials: ["drain"],
        },
      ],
      resistances: {
        impact: -20, cold: 30, arcane: 20
      },
      alignment: "chaotic",
      cost: 21,
      spriteKey: "units/undead/dread_bat",
      traitConfig: BAT_TRAITS, 
    },
    {
      id: "soulness",
      name: "ゾンビ",
      level: 1,
      hp: 28,
      movement: { type: "walk", points: 5 },
      attacks: [
        {
          id: "touch",
          name: "接触",
          damage: 7,
          count: 3,
          type: "impact",
          range: "melee",
          specials: ["plague"],
        },
      ],
      resistances: { arcane: -40 },
      alignment: "chaotic",
      cost: 8,
      spriteKey: "units/undead/soulness",
      traitConfig: UNDEAD_TRAITS,
    },
    {
      id: "skeleton",
      name: "ウォーリアー",
      level: 1,
      hp: 34,
      // 骨だけの体で水中を歩ける。本家の潜水(submerge)能力は「特性・能力を単純に保つ」
      // 方針で意図的に不採用(エンジン側の実装は残っている。テストはdefPatchで検証)
      movement: { type: "walk", points: 5, terrainOverrides: { shallow_water: 2, deep_water: 2 } },
      attacks: [
        { id: "axe", name: "斧", damage: 7, count: 3, type: "blade", range: "melee" },
      ],
      resistances: { ...SKELETON_RESISTANCES },
      alignment: "chaotic",
      cost: 15,
      spriteKey: "units/undead/skeleton",
      traitConfig: UNDEAD_TRAITS,
      advancesTo:[ "deathblade" ]
    },
    {
      id: "skeleton_archer",
      name: "アーチャー",
      level: 1,
      hp: 31,
      movement: { type: "walk", points: 5, terrainOverrides: { shallow_water: 2, deep_water: 2 } },
      attacks: [
        { id: "bone_fist", name: "骨の拳", damage: 3, count: 2, type: "impact", range: "melee" },
        { id: "bow", name: "弓", damage: 6, count: 3, type: "pierce", range: "ranged" },
      ],
      resistances: { ...SKELETON_RESISTANCES },
      alignment: "chaotic",
      cost: 14,
      spriteKey: "units/undead/skeleton_archer",
      traitConfig: UNDEAD_TRAITS,
      advancesTo: ["bone_archer"]
    },
    {
      id: "dark_adapt",
      name: "黒魔術師",
      level: 1,
      hp: 28,
      movement: { type: "walk", points: 5},
      attacks: [
        { id: "cold_storm", name: "冷気の嵐", damage: 10, count: 2, type: "cold", range: "ranged"},
        { id: "shadow_wave", name: "影の波動", damage: 8, count: 2, type: "arcane", range: "ranged"},
      ],
      resistances: {
        "arcane": 20
      },
      alignment: "chaotic",
      cost: 16,
      spriteKey: "units/undead/dark_adapt",
      traitConfig: HUMAN_TRAITS,
      advancesTo: ["dark_sorcerer"]
    },
    {
      id: "ghoul",
      name: "グール",
      level: 1,
      hp: 33,
      movement: { type: "walk", points: 5 },
      attacks: [
        {
          id: "claws",
          name: "爪",
          damage: 4,
          count: 3,
          type: "blade",
          range: "melee",
          specials: ["poison"],
        },
      ],
      resistances: {
        blade: 10, pierce: 30,
        fire: 10, cold: 40, arcane: 20 },
      alignment: "chaotic",
      cost: 16,
      spriteKey: "units/undead/ghoul",
      traitConfig: GHOUL_TRAITS, // アンデッド固定のみ(2026-07-08: 勇敢はトロル専用に)
      advancesTo: ["necrophage"]
    },
    {
      id: "ghost",
      name: "ゴースト",
      level: 1,
      hp: 18,
      movement: { type: "fly", points: 7 },
      attacks: [
        {
          id: "touch",
          name: "接触",
          damage: 4,
          count: 3,
          type: "arcane",
          range: "melee",
          specials: ["drain"],
        },
        { id: "wail", name: "うめき声", damage: 3, count: 3, type: "cold", range: "ranged" },
      ],
      resistances: {
        blade: 50, pierce: 50, impact: 50,
        fire: 10, cold: 70, arcane: -10 
      },
      alignment: "chaotic",
      cost: 19,
      spriteKey: "units/undead/ghost",
      traitConfig: UNDEAD_TRAITS,
      advancesTo: ["wraith"]
    },
    {
      id: "vampire_bat",
      name: "コウモリ",
      level: 0,
      hp: 16,
      movement: { type: "fly", points: 8 },
      attacks: [
        {
          id: "fangs",
          name: "牙",
          damage: 4,
          count: 2,
          type: "blade",
          range: "melee",
          specials: ["drain"],
        },
      ],
      resistances: {
        impact: -20, cold: 30, arcane: 20
      },
      alignment: "chaotic",
      cost: 13,
      spriteKey: "units/undead/vampire_bat",
      traitConfig: BAT_TRAITS, // 生きた獣なのでアンデッド特性なし。lv0なので小物(no_zoc)は暗黙付与
      advancesTo: ["bloodbat"]
    },
    {
      id: "walking_corpse",
      name: "ゾンビ",
      level: 0,
      hp: 18,
      movement: { type: "walk", points: 4 },
      attacks: [
        {
          id: "touch",
          name: "接触",
          damage: 4,
          count: 3,
          type: "impact",
          range: "melee",
          specials: ["plague"],
        },
      ],
      resistances: { arcane: -40 },
      alignment: "chaotic",
      cost: 8,
      spriteKey: "units/undead/walking_corpse",
      traitConfig: UNDEAD_TRAITS, // lv0なので小物(no_zoc)は暗黙付与(疫病スポーンも同様)
      advancesTo: ["soulness"]
    },
    ...ZOMBIE_VARIATIONS,
  ],
};
