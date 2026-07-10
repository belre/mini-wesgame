import type { Faction } from "../../types";
import { HUMAN_TRAITS } from "./traitPresets";

const HUMAN_RESISTANCES = {
  arcane: 20,
} as const;



// 忠誠軍(フェーズ1の実装対象)。数値は本家Wesnothの同名ユニットに近似。
export const LOYALISTS: Faction = {
  id: "loyalists",
  name: "Humans",
  defaultLeaderUnitId: "lieutenant",
  assetPackUrl: "/assets/packs/loyalists.json",
  recruitableUnitIds: [
    "spearman",
    "bowman",
    "heavy_infantryman",
    "cavalryman",
    "horseman",
    "mage",
    "fencer"
  ],
  availableLeaderUnitIds: [
    "lieutenant",
    "swordsman",
    "white_mage"
  ],
  units: [
    {
      id: "lieutenant",
      name: "General",
      level: 2,
      hp: 40,
      movement: { type: "walk", points: 6 },
      abilities: ["leadership"],
      attacks: [
        { id: "sword", name: "Sword", damage: 8, count: 3, type: "blade", range: "melee" },
        { id: "crossbow", name: "Crossbow", damage: 5, count: 3, type: "pierce", range: "ranged" },
      ],
      resistances: HUMAN_RESISTANCES,
      alignment: "lawful",
      cost: 35,
      spriteKey: "units/loyalists/lieutenant",
      traitConfig: HUMAN_TRAITS,
    },
    {
      id: "white_mage",
      name: "Mage",
      level: 2,
      hp: 35,
      movement: { type: "walk", points: 5 },
      abilities: ["cures", "heals8"],
      attacks: [
        { id: "staff", name: "Staff", damage: 6, count: 2, type: "impact", range: "melee" },
        {
          id: "lightbeam",
          name: "Holy Ray", // 2026-07-08 ユーザー指定(id不変。type: arcane は維持)
          damage: 9,
          count: 3,
          type: "arcane",
          range: "ranged",
          specials: ["magical"],
        },
      ],
      resistances: { arcane: 40 },
      alignment: "lawful",
      cost: 40,
      spriteKey: "units/loyalists/white_mage",
      traitConfig: HUMAN_TRAITS,
    },
    {
      id: "swordsman",
      name: "Blademaster",
      level: 2,
      hp: 55,
      movement: { type: "walk", points: 5 },
      attacks: [
        { id: "sword", name: "Sword", damage: 8, count: 4, type: "blade", range: "melee" }
      ],
      // 2026-07-08 ユーザー指定: 槍兵系(pikeman)と同系統の重装なので斬撃・打撃に強い
      resistances: { ...HUMAN_RESISTANCES, blade: 20, impact: 20 },
      alignment: "lawful",
      cost: 25,
      spriteKey: "units/loyalists/swordsman",
      traitConfig: HUMAN_TRAITS
    },
    {
      id: "pikeman",
      name: "Spearman",
      level: 2,
      hp: 55,
      movement: { type: "walk", points: 5},
      attacks : [
        {
          id: "spear",
          name: "Pike",
          damage: 10,
          count: 3,
          type: "pierce",
          range: "melee",
          specials: ["firststrike"],
        }
      ],
      // 2026-07-08 ユーザー指定: 重装の槍兵は貫通に強い
      resistances: { ...HUMAN_RESISTANCES, pierce: 20 },
      alignment: "lawful",
      cost: 25,
      spriteKey: "units/loyalists/pikeman",
      traitConfig: HUMAN_TRAITS,
    },
    {
      id: "longbowman",
      name: "Archer",
      level: 2,
      hp: 51,
      movement : { type: "walk", points: 5},
      attacks: [
        { id: "dagger", name: "Sword", damage: 8, count: 2, type: "blade", range: "melee" },
        { id: "bow", name: "Longbow", damage: 10, count: 3, type: "pierce", range: "ranged" },
      ],
      resistances: HUMAN_RESISTANCES,
      alignment: "lawful",
      cost: 26,
      spriteKey: "units/loyalists/longbowman",
      traitConfig: HUMAN_TRAITS,
    },
    {
      id: "shocktrooper",
      name: "Heavy Infantry",
      level: 2,
      hp: 52,
      movement : { type: "walk", points: 4},
      attacks: [
        { id: "mace", name: "Mace", damage: 18, count: 2, type: "impact", range: "melee" },
      ],
      resistances: {
        blade: 50, pierce: 40, impact: 10,
        fire: -10, cold: -10, arcane: 20
      },
      alignment: "lawful",
      cost: 35,
      spriteKey: "units/loyalists/shocktrooper",
      traitConfig: HUMAN_TRAITS,
    },
    {
      id: "dragoon",
      name: "Dragoon", // 2026-07-08 ユーザー指定: Lv1/Lv2で同名になったため統一改名(id不変)
      level: 2,
      hp: 49,
      movement: { type: "walk", points: 9},
      attacks: [
        { id: "sword", name: "Sword", damage: 6, count: 4, type: "blade", range: "melee" },
        { id: "crossbow", name: "Crossbow", damage: 12, count: 1, type: "pierce", range: "ranged"}
      ],
      resistances: {
        blade: 30, pierce: -20, impact: 40,
        cold: 20, arcane: 20
      },
      alignment: "lawful",
      cost: 34, // 2026-07-08 ユーザー指定(昇格先専用で雇用機会は無いが本家DBに合わせる)
      spriteKey: "units/loyalists/dragoon",
      traitConfig: HUMAN_TRAITS,
      defenseType: "cavalry"
    },
    {
      id: "cuirassier",
      name: "Lancer",
      level: 2,
      hp: 50,
      movement: { type: "walk", points: 10},
      attacks: [
        {
          id: "charged_saber",
          name: "Lance", // 2026-07-08 ユーザー指定: Lv1(horseman)と表記統一(id不変)
          damage: 12,
          count: 3,
          type: "pierce",
          range: "melee",
          specials: ["charge"],
        },
      ],
      resistances: {
        blade: 20, pierce: -20, impact: 30,
        arcane: 20
       },
      alignment: "lawful",
      cost: 40,
      spriteKey: "units/loyalists/lancer",
      traitConfig: HUMAN_TRAITS,
      defenseType: "cavalry",      
    },
    {
      id: "duelist",
      name: "Duelist",
      level: 2,
      hp: 44,
      movement: { type: "walk", points: 7},
      attacks: [
        { id: "saber", name: "Saber", damage: 7, count: 4, type: "blade", range: "melee" },
        { id: "crossbow", name: "Crossbow", damage: 12, count: 1, type: "pierce", range: "ranged"}
      ],
      resistances: {
        "blade" : -30, "pierce" : -20, "impact" : -20,
        "cold" : 10, "arcane" : 20
      },
      abilities: ["skirmisher"],
      alignment: "lawful",
      cost: 32, // 2026-07-08 ユーザー指定(旧: fencerと同値16のまま据え置かれていた)
      spriteKey: "units/loyalists/duelist",
      traitConfig: HUMAN_TRAITS,
    },
    {
      id: "spearman",
      name: "Spearman",
      level: 1,
      hp: 36,
      movement: { type: "walk", points: 5 },
      attacks: [
        {
          id: "spear",
          name: "Spear",
          damage: 7,
          count: 3,
          type: "pierce",
          range: "melee",
          specials: ["firststrike"],
        },
        { id: "javelin", name: "Javelin", damage: 6, count: 1, type: "pierce", range: "ranged" },
      ],
      resistances: HUMAN_RESISTANCES,
      alignment: "lawful",
      cost: 14,
      spriteKey: "units/loyalists/spearman",
      traitConfig: HUMAN_TRAITS,
      maxXp: 42, // 2026-07-08 ユーザー指定
      advancesTo: ["pikeman"]
    },
    {
      id: "bowman",
      name: "Archer",
      level: 1,
      hp: 33,
      movement: { type: "walk", points: 5 },
      attacks: [
        { id: "dagger", name: "Dagger", damage: 4, count: 2, type: "blade", range: "melee" },
        { id: "bow", name: "Bow", damage: 6, count: 3, type: "pierce", range: "ranged" },
      ],
      resistances: HUMAN_RESISTANCES,
      alignment: "lawful",
      cost: 14,
      spriteKey: "units/loyalists/bowman",
      traitConfig: HUMAN_TRAITS,
      maxXp: 39, // 2026-07-08 ユーザー指定
      advancesTo: ["longbowman"]
    },
    {
      id: "heavy_infantryman",
      name: "Heavy Infantry",
      level: 1,
      hp: 38,
      movement: { type: "walk", points: 4 },
      attacks: [
        { id: "mace", name: "Mace", damage: 11, count: 2, type: "impact", range: "melee" },
      ],
      resistances: {
        blade: 50, pierce: 40, impact: 10,
        fire: -10, cold: -10, arcane: 20
      },
      alignment: "lawful",
      cost: 19,
      maxXp: 40, // 2026-07-08 ユーザー指定(デフォルト式=Lv1×40と偶然一致するが明示)
      spriteKey: "units/loyalists/heavy_infantryman",
      traitConfig: HUMAN_TRAITS,
      advancesTo: ["shocktrooper"]
    },
    {
      id: "cavalryman",
      name: "Dragoon", // 2026-07-08 ユーザー指定: Lv1/Lv2で同名になったため統一改名(id不変)
      level: 1,
      hp: 34,
      movement: { type: "walk", points: 8 },
      attacks: [
        { id: "sword", name: "Sword", damage: 6, count: 3, type: "blade", range: "melee" },
      ],
      resistances: {
        blade: 30, pierce: -20, impact: 40,
        cold: 20, arcane: 20
      },
      alignment: "lawful",
      cost: 17,
      maxXp: 40, // 2026-07-08 ユーザー指定(デフォルト式=Lv1×40と偶然一致するが明示)
      spriteKey: "units/loyalists/cavalryman",
      traitConfig: HUMAN_TRAITS,
      defenseType: "cavalry", // 騎馬: 森・村・城での防御率が歩兵より低い
      advancesTo: ["dragoon"]
    },
    {
      id: "horseman",
      name: "Lancer",
      level: 1,
      hp: 38,
      movement: { type: "walk", points: 8 },
      attacks: [
        {
          id: "lance",
          name: "Lance",
          damage: 9,
          count: 2,
          type: "pierce",
          range: "melee",
          specials: ["charge"],
        },
      ],
      resistances: {
        blade: 20, pierce: -20, impact: 30,
        arcane: 20
       },
      alignment: "lawful",
      cost: 23,
      maxXp: 44, // 2026-07-08 ユーザー指定
      spriteKey: "units/loyalists/horseman",
      traitConfig: HUMAN_TRAITS,
      defenseType: "cavalry", // 騎馬: 森・村・城での防御率が歩兵より低い
      advancesTo: ["cuirassier"]
    },
    {
      id: "mage",
      name: "Mage",
      level: 1,
      hp: 24,
      movement: { type: "walk", points: 5 },
      attacks: [
        { id: "staff", name: "Staff", damage: 5, count: 1, type: "impact", range: "melee" },
        {
          id: "magic_missile",
          name: "Spark", // 2026-07-08 ユーザー指定(id不変。type: fireも維持 — 本家「王位継承者」の老魔術師も雷を炎属性扱い)
          damage: 7,
          count: 3,
          type: "fire",
          range: "ranged",
          specials: ["magical"],
        },
      ],
      resistances: HUMAN_RESISTANCES,
      alignment: "lawful",
      cost: 20,
      maxXp: 54, // 2026-07-08 ユーザー指定
      spriteKey: "units/loyalists/mage",
      traitConfig: HUMAN_TRAITS,
      advancesTo: ["white_mage"],
    },
    {
      id: "fencer",
      name: "Duelist",
      level: 1,
      hp: 28,
      movement: { type: "walk", points: 6 },
      attacks: [
        { id: "saber", name: "Saber", damage: 4, count: 4, type: "blade", range: "melee" },
      ],
      resistances: {
        "blade" : -30, "pierce" : -20, "impact" : -20,
        "cold" : 10, "arcane" : 20
      },
      abilities: ["skirmisher"],
      alignment: "lawful",
      cost: 16,
      maxXp: 42, // 2026-07-08 ユーザー指定
      spriteKey: "units/loyalists/fencer",
      traitConfig: HUMAN_TRAITS,
      advancesTo: ["duelist"], // 2026-07-08 ユーザー指定: 接続漏れでAMLAになっていたのを修正
    },
  ],
};
