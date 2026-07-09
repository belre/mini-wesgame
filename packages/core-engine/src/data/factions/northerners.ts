import type { Faction } from "../../types";
import { NAGA_TRAITS, ORC_TRAITS, TROLL_TRAITS, HUMAN_TRAITS } from "./traitPresets";
import {
  NAGA_DEFENSE_OVERRIDES_BASE,
  NAGA_MOVE_OVERRIDES,
  ORC_INFANTRY_DEFENSE_OVERRIDES,
  ORC_INFANTRY_MOVE_OVERRIDES,
  ORC_TROLL_DEFENSE_OVERRIDES,
  ORC_TROLL_MOVE_OVERRIDES,
  ORC_WOLF_DEFENSE_OVERRIDES,
  ORC_WOLF_MOVE_OVERRIDES,
} from "./terrainPresets";

// 北方連合(オーク)。フェーズ2以降で解放予定だがデータは先に揃える。
// 凡愚・鈍重・非力(dim/slow/weak)はゴブリンのみ、勇敢(fearless)はトロル(とグール)のみ。
export const NORTHERNERS: Faction = {
  id: "northerners",
  name: "Orcs",
  defaultLeaderUnitId: "orcish_warrior",
  assetPackUrl: "/assets/packs/northerners.json",
  recruitableUnitIds: [
    "orcish_grunt",
    "orcish_archer",
    "orcish_spy",
    "wolf_rider",
    "troll_whelp",
    "naga_fighter"
  ],
  availableLeaderUnitIds:[
    "orcish_warrior",
    "troll",
    "orcish_nightblade" // 2026-07-08 ユーザー指定: 隊長をアサシンから変更
  ],
  units: [
    {
      id: "orcish_nightblade",
      name: "Nightblade",
      level: 2,
      hp: 36,
      // 軽装(lightfoot。2026-07-08 defenseTypeとして正式導入。旧terrainOverrides方式から移行)
      movement: { type: "walk", points: 6 },
      defenseType: "lightfoot",
      attacks: [
        { id: "knife", name: "Knife", damage: 7, count: 3, type: "blade", range: "melee" }, // 2026-07-08 ユーザー指定(旧9x2。隊長就任にあわせ微強化)
        {
          id: "thrown_knife",
          name: "Thrown Knife",
          damage: 4, // 2026-07-08 ユーザー指定(旧6)
          count: 4, // 2026-07-08 ユーザー指定(旧3)
          type: "blade",
          range: "ranged",
          specials: ["poison_sting"],
        },
      ],
      // 2026-07-08 ユーザー指定: アサシン系統(この個体)は耐性が弱い、明示的に全0%
      resistances: { blade: 0, pierce: 0, impact: 0, fire: 0, cold: 0, arcane: 0 },
      alignment: "chaotic",
      cost: 33,
      spriteKey: "units/northerners/orcish_nightblade",
      traitConfig: ORC_TRAITS,
    },
    {
      id: "orcish_warrior",
      name: "Warrior", // 2026-07-08 ユーザー指定: 隊長候補のLv2が「兵卒」だと違和感があるため改名(id不変)
      level: 2,
      hp: 58,
      // オーク歩兵系(2026-07-08 ユーザー実測): 山岳適性+沼地がやや堅い
      movement: { type: "walk", points: 5, terrainOverrides: ORC_INFANTRY_MOVE_OVERRIDES },
      defenseOverrides: ORC_INFANTRY_DEFENSE_OVERRIDES,
      attacks: [
        { id: "greatsword", name: "Greatsword", damage: 10, count: 3, type: "blade", range: "melee" }, // 2026-07-08 ユーザー指定(旧9x3)
      ],
      resistances: {},
      alignment: "chaotic",
      cost: 26,
      spriteKey: "units/northerners/orcish_warrior",
      traitConfig: ORC_TRAITS,
    },
    {
      id: "orcish_crossbow",
      name: "Archer",
      level: 2,
      hp: 43,
      // オーク歩兵系(2026-07-08 ユーザー実測): 山岳適性+沼地がやや堅い
      movement: { type: "walk", points: 5, terrainOverrides: ORC_INFANTRY_MOVE_OVERRIDES },
      defenseOverrides: ORC_INFANTRY_DEFENSE_OVERRIDES,
      attacks: [
        { id: "dagger", name: "Dagger", damage: 4, count: 3, type: "blade", range: "melee" },
        { id: "bow", name: "Bow", damage: 8, count: 3, type: "pierce", range: "ranged" },
        { id: "fire_arrow", name: "Fire Arrow", damage: 10, count: 2, type: "fire", range: "ranged"}
      ],
      resistances: {},
      alignment: "chaotic",
      cost: 26,
      spriteKey: "units/northerners/orcish_crossbow",
      traitConfig: ORC_TRAITS,
    },
    {
      id: "orcish_pillager",
      name: "Wolf Rider",
      level: 2,
      hp: 47, // 2026-07-08 ユーザー指定(旧44。wolf_riderの+3に合わせる)
      // 狼系(2026-07-08 ユーザー実測): 山岳適性+丘が速い。村は路地で機動を失う。
      // 沼地・浅瀬は堅いがトーチカは足の速いユニットに不利(本家準拠)
      movement: { type: "walk", points: 9, terrainOverrides: ORC_WOLF_MOVE_OVERRIDES },
      defenseOverrides: ORC_WOLF_DEFENSE_OVERRIDES,
      attacks: [
        { id: "fangs", name: "Fangs", damage: 5, count: 3, type: "blade", range: "melee" },
        { id: "torch", name: "Torch", damage: 7, count: 3, type: "fire", range: "melee"},
        { 
          id: "net", 
          name: "Net", 
          damage: 6, 
          count: 2, 
          type: "impact", 
          range: "ranged",
          specials: ["slow"],
        }
      ],
      resistances: {},
      alignment: "chaotic",
      cost: 32,
      spriteKey: "units/northerners/orcish_pillager",
      traitConfig: ORC_TRAITS,
    },
    {
      id: "orcish_assassin",
      name: "Assassin", // 2026-07-08 ユーザー指定(id不変)
      level: 2,
      hp: 36,
      // 軽装(lightfoot。2026-07-08 ユーザー指定: orcish_spy系統の対象漏れを修正)
      movement: { type: "walk", points: 6 },
      defenseType: "lightfoot",
      attacks: [
        { id: "knife", name: "Knife", damage: 9, count: 2, type: "blade", range: "melee" },
        {
          id: "thrown_knife",
          name: "Thrown Knife",
          damage: 6,
          count: 3,
          type: "blade",
          range: "ranged",
          specials: ["poison_sting"],
        },
      ],
      // 2026-07-08 ユーザー指定: 軽装で物理防具が薄いため物理耐性が全て弱点
      resistances: { blade: -30, pierce: -20, impact: -20 },
      alignment: "chaotic",
      cost: 33,
      spriteKey: "units/northerners/orcish_slayer",
      traitConfig: ORC_TRAITS,
    },
    {
      id: "troll",
      name: "Troll",
      level: 2,
      hp: 55,
      // トロル系(2026-07-08 ユーザー実測): 山岳適性はあるが図体が大きく
      // 開けた地形・人工地形が苦手
      movement: { type: "walk", points: 5, terrainOverrides: ORC_TROLL_MOVE_OVERRIDES },
      defenseOverrides: ORC_TROLL_DEFENSE_OVERRIDES,
      abilities: ["regenerates"],
      attacks: [
        { id: "club", name: "Hammer", damage: 14, count: 2, type: "impact", range: "melee" }, // 2026-07-08 ユーザー指定(id不変。旧棍棒)
      ],
      // 2026-07-08 ユーザー指定: 分厚い体皮で斬撃・刺突に強いが秘術に弱い
      resistances: { blade: 20, pierce: 20, arcane: -10 },
      alignment: "chaotic",
      cost: 29, // 2026-07-08 ユーザー指定(旧26)
      spriteKey: "units/northerners/troll",
      traitConfig: TROLL_TRAITS,
    },
    {
      id: "naga_warrior",
      name: "Naga",
      level: 2,
      hp: 43,
      // ナーガ系(2026-07-08 ユーザー実測): 陸地も広く這い進める。岩場にも例外的に進入できる。
      // 草原・岩場防御はLv1より一段強い
      movement: { type: "swim", points: 7, terrainOverrides: NAGA_MOVE_OVERRIDES },
      defenseOverrides: { ...NAGA_DEFENSE_OVERRIDES_BASE, grassland: 40, mountains: 50 },
      attacks: [
        { id: "sword", name: "Sword", damage: 6, count: 5, type: "blade", range: "melee" }, // 2026-07-08 ユーザー指定(旧7x4→7x5は強すぎたため6x5に調整)
      ],
      resistances: {},
      alignment: "neutral",
      cost: 27,
      spriteKey: "units/northerners/naga_warrior",
      traitConfig: NAGA_TRAITS,
    },
    {
      id: "orcish_grunt",
      name: "Warrior", // 2026-07-08 ユーザー指定: 隊長候補のLv2が「兵卒」だと違和感があるため改名(id不変)
      level: 1,
      hp: 38,
      // オーク歩兵系(2026-07-08 ユーザー実測): 山岳適性+沼地がやや堅い
      movement: { type: "walk", points: 5, terrainOverrides: ORC_INFANTRY_MOVE_OVERRIDES },
      defenseOverrides: ORC_INFANTRY_DEFENSE_OVERRIDES,
      attacks: [
        { id: "sword", name: "Sword", damage: 9, count: 2, type: "blade", range: "melee" },
      ],
      resistances: {},
      alignment: "chaotic",
      cost: 12,
      maxXp: 42, // 2026-07-08 ユーザー指定
      spriteKey: "units/northerners/orcish_grunt",
      traitConfig: ORC_TRAITS,
      advancesTo: ["orcish_warrior"],
    },
    {
      id: "orcish_archer",
      name: "Archer",
      level: 1,
      hp: 32,
      // オーク歩兵系(2026-07-08 ユーザー実測): 山岳適性+沼地がやや堅い
      movement: { type: "walk", points: 5, terrainOverrides: ORC_INFANTRY_MOVE_OVERRIDES },
      defenseOverrides: ORC_INFANTRY_DEFENSE_OVERRIDES,
      attacks: [
        { id: "dagger", name: "Dagger", damage: 3, count: 2, type: "blade", range: "melee" },
        { id: "bow", name: "Bow", damage: 5, count: 3, type: "pierce", range: "ranged" },
        { id: "fire_arrow", name: "Fire Arrow", damage: 7, count: 2, type: "fire", range: "ranged"}
      ],
      resistances: {},
      alignment: "chaotic",
      cost: 14,
      maxXp: 30, // 2026-07-08 ユーザー指定
      spriteKey: "units/northerners/orcish_archer",
      traitConfig: ORC_TRAITS,
      advancesTo: ["orcish_crossbow"]
    },
    {
      id: "wolf_rider",
      name: "Wolf Rider",
      level: 1,
      hp: 35, // 2026-07-08 ユーザー指定(旧32。8x4の満弾32を耐えられる水準に微強化)
      // 狼系(2026-07-08 ユーザー実測): 山岳適性+丘が速い。村は路地で機動を失う。
      // 沼地・浅瀬は堅いがトーチカは足の速いユニットに不利(本家準拠)
      movement: { type: "walk", points: 8, terrainOverrides: ORC_WOLF_MOVE_OVERRIDES },
      defenseOverrides: ORC_WOLF_DEFENSE_OVERRIDES,
      attacks: [
        { id: "fangs", name: "Fangs", damage: 5, count: 3, type: "blade", range: "melee" },
      ],
      resistances: {},
      alignment: "chaotic",
      cost: 16,
      maxXp: 30, // 2026-07-08 ユーザー指定
      spriteKey: "units/northerners/wolf_rider",
      traitConfig: ORC_TRAITS,
      advancesTo: ["orcish_pillager"]
    },
    {
      id: "orcish_spy",
      name: "Assassin", // 2026-07-08 ユーザー指定(id不変)
      level: 1,
      hp: 26,
      // 軽装(lightfoot。2026-07-08 defenseTypeとして正式導入。旧terrainOverrides方式から移行)
      movement: { type: "walk", points: 6 },
      defenseType: "lightfoot",
      attacks: [
        { id: "knife", name: "Knife", damage: 7, count: 1, type: "blade", range: "melee" },
        {
          id: "thrown_knife",
          name: "Thrown Knife",
          damage: 3,
          count: 3,
          type: "blade",
          range: "ranged",
          specials: ["poison_sting"],
        },
      ],
      // 2026-07-08 ユーザー指定: 軽装で物理防具が薄いため物理耐性が全て弱点
      resistances: { blade: -30, pierce: -20, impact: -20 },
      alignment: "chaotic",
      cost: 17,
      maxXp: 34, // 2026-07-08 ユーザー指定
      spriteKey: "units/northerners/orcish_assassin",
      traitConfig: ORC_TRAITS,
      advancesTo: ["orcish_assassin"]
    },
    {
      id: "troll_whelp",
      name: "Troll",
      level: 1,
      hp: 42,
      // トロル系(2026-07-08 ユーザー実測): 山岳適性はあるが図体が大きく
      // 開けた地形・人工地形が苦手
      movement: { type: "walk", points: 4, terrainOverrides: ORC_TROLL_MOVE_OVERRIDES },
      defenseOverrides: ORC_TROLL_DEFENSE_OVERRIDES,
      abilities: ["regenerates"],
      attacks: [
        { id: "fist", name: "Club", damage: 7, count: 2, type: "impact", range: "melee" }, // 2026-07-08 ユーザー指定(id不変。旧拳)
      ],
      // 2026-07-08 ユーザー指定: 分厚い体皮で斬撃・刺突に強いが秘術に弱い
      resistances: { blade: 20, pierce: 20, arcane: -10 },
      alignment: "chaotic",
      cost: 13,
      maxXp: 36, // 2026-07-08 ユーザー指定
      spriteKey: "units/northerners/troll_grunt",
      traitConfig: TROLL_TRAITS, // 勇敢の可能性
      advancesTo: ["troll"],
    },
    {
      id: "naga_fighter",
      name: "Naga",
      level: 1,
      hp: 33,
      // ナーガ系(2026-07-08 ユーザー実測): 陸地も広く這い進める。岩場にも例外的に進入できる
      movement: { type: "swim", points: 7, terrainOverrides: NAGA_MOVE_OVERRIDES },
      defenseOverrides: { ...NAGA_DEFENSE_OVERRIDES_BASE, mountains: 40 },
      attacks: [
        { id: "sword", name: "Sword", damage: 4, count: 4, type: "blade", range: "melee" },
      ],
      resistances: {},
      alignment: "neutral",
      cost: 14,
      maxXp: 32, // 2026-07-08 ユーザー指定
      spriteKey: "units/northerners/naga_fighter",
      traitConfig: NAGA_TRAITS,
      advancesTo: ["naga_warrior"]
    }
  ],
};
