// スプライトアセットのダウンロードスクリプト。
// Wesnoth本家(GPLv2+)のアセットのためリポジトリにはコミットせず(gitignore)、
// 別環境でも毎回これで取得する: node packages/frontend/scripts/fetch-demo-sprites.mjs
//
// 対象: 全陣営(loyalists/drakes/northerners/rebels/undead) + 飛び道具 + grassland 地形タイル。
// lib/sprites.ts の UNIT_SPRITES に定義したフレームはすべて取得する。
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE      = "https://raw.githubusercontent.com/wesnoth/wesnoth/master/data/core/images/units";
export const ROOT      = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sprites");
const LOYALISTS = `${BASE}/human-loyalists`;
const MAGI      = `${BASE}/human-magi`;
const MERFOLK   = `${BASE}/merfolk`;
const DRAKES    = `${BASE}/drakes`;
const SAURIANS  = `${BASE}/saurians`;
const ORCS      = `${BASE}/orcs`;
const GOBLINS   = `${BASE}/goblins`;
const TROLLS    = `${BASE}/trolls`;
const NAGAS     = `${BASE}/nagas`;
const OUTLAWS   = `${BASE}/human-outlaws`;
const ELVES     = `${BASE}/elves-wood`;
const WOSES     = `${BASE}/woses`;
const BATS      = `${BASE}/bats`;
const UNDEAD    = `${BASE}/undead`;
const UNDEAD_SK = `${BASE}/undead-skeletal`;
const UNDEAD_SP = `${BASE}/undead-spirit`;
const UNDEAD_NE = `${BASE}/undead-necromancers`;
const PROJ      = "https://raw.githubusercontent.com/wesnoth/wesnoth/master/data/core/images/projectiles";
const HALO      = "https://raw.githubusercontent.com/wesnoth/wesnoth/master/data/core/images/halo";
const TERRAIN   = "https://raw.githubusercontent.com/wesnoth/wesnoth/master/data/core/images/terrain";

// ファイル指定: string は remote=local 同名。{ remote, local } は名前が異なる場合
// サブディレクトリ入りのユニット(cavalry等)は remote に "subdir/file.png" 形式を使う

export const ASSET_GROUPS = [
  // ----------------------------------------------------------------
  // スピアマン: lib/sprites.ts にアニメ定義あり → フレーム全取得
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "spearman"),
    files: [
      "spearman.png",
      ...Array.from({ length: 7 }, (_, i) => `spearman-stand-s-${i + 1}.png`),
      ...Array.from({ length: 4 }, (_, i) => `spearman-idle${i + 1}.png`),
      "spearman-attack-se-1.png",
      "spearman-attack-s-2.png",
      "spearman-attack-s-3.png",
      "spearman-swoosh-s.png",
      "spearman-defend.png",
      "spearman-defend-2.png",
      "spearman-attack-ranged1.png",
      "spearman-attack-ranged2.png",
      "spearman-attack-ranged3.png",
    ],
  },

  // ----------------------------------------------------------------
  // 弓兵 (bowman)
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "bowman"),
    files: [
      "bowman.png",
      "bowman-bow.png",
      ...Array.from({ length: 4 }, (_, i) => `bowman-bow-attack-${i + 1}.png`),
      "bowman-bow-defend.png",
      ...Array.from({ length: 4 }, (_, i) => `bowman-melee-attack-${i + 1}.png`),
      "bowman-melee-defend-1.png",
    ],
  },

  // ----------------------------------------------------------------
  // 重歩兵 (heavy_infantryman) — Wesnoth ではサブディレクトリなし
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "heavy_infantryman"),
    files: [
      { remote: "heavyinfantry.png",       local: "heavyinfantry.png" },
      ...Array.from({ length: 15 }, (_, i) => ({
        remote: `heavyinfantry-attack-${i + 1}.png`,
        local:  `heavyinfantry-attack-${i + 1}.png`,
      })),
      { remote: "heavyinfantry-defend-1.png", local: "heavyinfantry-defend-1.png" },
      { remote: "heavyinfantry-defend-2.png", local: "heavyinfantry-defend-2.png" },
    ],
  },

  // ----------------------------------------------------------------
  // 騎馬兵 (cavalryman) — Wesnoth では cavalryman/ サブディレクトリ
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "cavalryman"),
    files: [
      { remote: "cavalryman/cavalryman.png",      local: "cavalryman.png" },
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `cavalryman/cavalryman-breeze${i + 1}.png`,
        local:  `cavalryman-breeze${i + 1}.png`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `cavalryman/cavalryman-bob${i + 1}.png`,
        local:  `cavalryman-bob${i + 1}.png`,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `cavalryman/cavalryman-attack${i + 1}.png`,
        local:  `cavalryman-attack${i + 1}.png`,
      })),
      { remote: "cavalryman/cavalryman-defend2.png", local: "cavalryman-defend2.png" },
    ],
  },

  // ----------------------------------------------------------------
  // 騎兵 (horseman) — Wesnoth では horseman/ サブディレクトリ
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "horseman"),
    files: [
      { remote: "horseman/horseman.png",       local: "horseman.png" },
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `horseman/horseman-breeze-${i + 1}.png`,
        local:  `horseman-breeze-${i + 1}.png`,
      })),
      ...Array.from({ length: 12 }, (_, i) => ({
        remote: `horseman/horseman-se-attack${i + 1}.png`,
        local:  `horseman-se-attack${i + 1}.png`,
      })),
      { remote: "horseman/horseman-se-defend1.png", local: "horseman-se-defend1.png" },
    ],
  },

  // ----------------------------------------------------------------
  // 魔術師 (mage) — Wesnoth では human-magi/
  // ----------------------------------------------------------------
  {
    base: MAGI,
    out: join(ROOT, "mage"),
    files: [
      "mage.png",
      ...Array.from({ length: 4 }, (_, i) => `mage-idle-${i + 1}.png`),
      "mage-attack-magic1.png",
      "mage-attack-magic2.png",
      "mage-attack-staff1.png",
      "mage-attack-staff2.png",
      "mage-defend.png",
    ],
  },

  // ----------------------------------------------------------------
  // 剣術士 (fencer)
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "fencer"),
    files: [
      "fencer.png",
      ...Array.from({ length: 8 }, (_, i) => `fencer-stand-${i + 1}.png`),
      ...Array.from({ length: 7 }, (_, i) => `fencer-idle-${i + 1}.png`),
      ...Array.from({ length: 9 }, (_, i) => `fencer-attack-${i + 1}.png`),
      "fencer-defend-1-1.png",
      "fencer-defend-1-2.png",
    ],
  },

  // ----------------------------------------------------------------
  // 副官 (lieutenant)
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "lieutenant"),
    files: [
      "lieutenant.png",
      "lieutenant-attack-sword-1.png",
      "lieutenant-attack-sword-2.png",
      "lieutenant-attack-sword-3.png",
      "lieutenant-crossbow.png",
      "lieutenant-crossbow-attack1.png",
      "lieutenant-crossbow-attack2.png",
      "lieutenant-defend-2.png",
    ],
  },

  // ----------------------------------------------------------------
  // 剣士 (swordsman)
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "swordsman"),
    files: [
      "swordsman.png",
      ...Array.from({ length: 8 }, (_, i) => `swordsman-attack-se-${i + 1}.png`),
      "swordsman-bob-s-1.png",
      "swordsman-bob-s-2.png",
      "swordsman-bob-s-3.png",
      "swordsman-defend-2.png",
    ],
  },

  // ----------------------------------------------------------------
  // 白魔術師 (white_mage) — Wesnoth では human-magi/
  // ----------------------------------------------------------------
  {
    base: MAGI,
    out: join(ROOT, "white_mage"),
    files: [
      { remote: "white-mage.png",      local: "white-mage.png" },
      ...Array.from({ length: 18 }, (_, i) => ({
        remote: `white-mage-idle-${i + 1}.png`,
        local:  `white-mage-idle-${i + 1}.png`,
      })),
      { remote: "white-mage-magic-1.png", local: "white-mage-magic-1.png" },
      { remote: "white-mage-magic-2.png", local: "white-mage-magic-2.png" },
      { remote: "white-mage-magic-3.png", local: "white-mage-magic-3.png" },
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `white-mage-melee-${i + 1}.png`,
        local:  `white-mage-melee-${i + 1}.png`,
      })),
      { remote: "white-mage-defend.png", local: "white-mage-defend.png" },
    ],
  },

  // ----------------------------------------------------------------
  // 長槍兵 (pikeman)
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "pikeman"),
    files: [
      "pikeman.png",
      "pikeman-attack-se.png",
      "pikeman-defend.png",
    ],
  },

  // ----------------------------------------------------------------
  // 大弓兵 (longbowman)
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "longbowman"),
    files: [
      "longbowman.png",
      "longbowman-bow.png",
      ...Array.from({ length: 4 }, (_, i) => `longbowman-bow-attack-${i + 1}.png`),
      "longbowman-bow-defend.png",
      ...Array.from({ length: 4 }, (_, i) => `longbowman-melee-attack-${i + 1}.png`),
      "longbowman-melee-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `longbowman-idle-${i + 1}.png`),
    ],
  },

  // ----------------------------------------------------------------
  // 破砕兵 (shocktrooper)
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "shocktrooper"),
    files: [
      "shocktrooper.png",
      ...Array.from({ length: 6 }, (_, i) => `shocktrooper-attack-${i + 1}.png`),
      "shocktrooper-defend-2.png",
    ],
  },

  // ----------------------------------------------------------------
  // 竜騎兵 (dragoon) — Wesnoth では dragoon/ サブディレクトリ
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "dragoon"),
    files: [
      { remote: "dragoon/dragoon.png",      local: "dragoon.png" },
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `dragoon/dragoon-bob${i + 1}.png`,
        local:  `dragoon-bob${i + 1}.png`,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `dragoon/dragoon-xbow-${i + 1}.png`,
        local:  `dragoon-xbow-${i + 1}.png`,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        remote: `dragoon/dragoon-melee${i + 1}.png`,
        local:  `dragoon-melee${i + 1}.png`,
      })),
      { remote: "dragoon/dragoon-defend2.png", local: "dragoon-defend2.png" },
    ],
  },

  // ----------------------------------------------------------------
  // ランス騎兵 (lancer) — Wesnoth では lancer/ サブディレクトリ
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "lancer"),
    files: [
      { remote: "lancer/lancer.png",        local: "lancer.png" },
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `lancer/lancer-breeze-${i + 1}.png`,
        local:  `lancer-breeze-${i + 1}.png`,
      })),
      { remote: "lancer/lancer-se-attack1.png",  local: "lancer-se-attack1.png" },
      { remote: "lancer/lancer-se-defend1.png",  local: "lancer-se-defend1.png" },
    ],
  },

  // ----------------------------------------------------------------
  // 決闘者 (duelist)
  // ----------------------------------------------------------------
  {
    base: LOYALISTS,
    out: join(ROOT, "duelist"),
    files: [
      "duelist.png",
      "duelist-attack.png",
      "duelist-ranged.png",
      "duelist-defend.png",
    ],
  },

  // ----------------------------------------------------------------
  // マーマンの戦士 (merman_fighter) — merfolk/ warrior系統を使用
  // ----------------------------------------------------------------
  {
    base: MERFOLK,
    out: join(ROOT, "merman"),
    files: [
      { remote: "warrior.png",          local: "warrior.png" },
      ...Array.from({ length: 9 }, (_, i) => ({
        remote: `warrior-attack-${i + 1}.png`,
        local:  `warrior-attack-${i + 1}.png`,
      })),
      { remote: "warrior-defend-2.png", local: "warrior-defend-2.png" },
    ],
  },

  // ----------------------------------------------------------------
  // トリトンの戦士 (merman_triton) — merfolk/
  // ----------------------------------------------------------------
  {
    base: MERFOLK,
    out: join(ROOT, "merman_triton"),
    files: [
      { remote: "triton.png",         local: "triton.png" },
      { remote: "triton-defend1.png", local: "triton-defend1.png" },
      { remote: "triton-defend2.png", local: "triton-defend2.png" },
    ],
  },

  // ================================================================
  // DRAKES (ドレイク陣営)
  // ================================================================
  {
    base: DRAKES,
    out: join(ROOT, "drake_fighter"),
    files: [
      "fighter.png", "fighter-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `fighter-melee-${i + 1}.png`),
      ...Array.from({ length: 4 }, (_, i) => `fighter-fire-inhale-${i + 1}.png`),
      ...Array.from({ length: 3 }, (_, i) => `fighter-fire-se-${i + 1}.png`),
    ],
  },
  {
    base: DRAKES,
    out: join(ROOT, "drake_warrior"),
    files: [
      "warrior.png", "warrior-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `warrior-melee-${i + 1}.png`),
      ...Array.from({ length: 4 }, (_, i) => `warrior-fire-inhale-${i + 1}.png`),
      ...Array.from({ length: 3 }, (_, i) => `warrior-fire-se-${i + 1}.png`),
    ],
  },
  {
    base: DRAKES,
    out: join(ROOT, "drake_flare"),
    files: [
      "flare.png", "flare-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `flare-melee-${i + 1}.png`),
      ...Array.from({ length: 4 }, (_, i) => `flare-fire-inhale-${i + 1}.png`),
      ...Array.from({ length: 3 }, (_, i) => `flare-fire-se-${i + 1}.png`),
    ],
  },
  {
    base: DRAKES,
    out: join(ROOT, "drake_burner"),
    files: [
      "burner.png", "burner-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `burner-melee-${i + 1}.png`),
      ...Array.from({ length: 4 }, (_, i) => `burner-fire-inhale-${i + 1}.png`),
      ...Array.from({ length: 3 }, (_, i) => `burner-fire-se-${i + 1}.png`),
    ],
  },
  {
    base: DRAKES,
    out: join(ROOT, "drake_glider"),
    files: [
      "glider.png", "glider-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `glider-kick-${i + 1}.png`),
      ...Array.from({ length: 4 }, (_, i) => `glider-fire-inhale-${i + 1}.png`),
      ...Array.from({ length: 3 }, (_, i) => `glider-fire-se-${i + 1}.png`),
    ],
  },
  {
    base: DRAKES,
    out: join(ROOT, "drake_hurricane"),
    files: [
      "hurricane.png", "hurricane-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `hurricane-kick-${i + 1}.png`),
      // standing(飛行): hurricane-fly-[1~5,4]:100 + fly-[3,2]-upstroke:100
      ...Array.from({ length: 5 }, (_, i) => `hurricane-fly-${i + 1}.png`),
      "hurricane-fly-2-upstroke.png", "hurricane-fly-3-upstroke.png",
      ...Array.from({ length: 4 }, (_, i) => `hurricane-fire-inhale-${i + 1}.png`),
      ...Array.from({ length: 3 }, (_, i) => `hurricane-fire-se-${i + 1}.png`),
    ],
  },
  {
    base: DRAKES,
    out: join(ROOT, "drake_clasher"),
    files: [
      "clasher.png", "clasher-blade-defend-1.png",
      ...Array.from({ length: 5 }, (_, i) => `clasher-blade-${i + 1}.png`),
      ...Array.from({ length: 6 }, (_, i) => `clasher-spear-se-${i + 1}.png`),
    ],
  },
  {
    base: DRAKES,
    out: join(ROOT, "drake_arbiter"),
    files: [
      "arbiter.png", "arbiter-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `arbiter-blade-se-${i + 1}.png`),
    ],
  },
  {
    base: DRAKES,
    out: join(ROOT, "inferno_drake"),
    files: [
      "inferno.png", "inferno-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `inferno-melee-${i + 1}.png`),
      ...Array.from({ length: 4 }, (_, i) => `inferno-fire-inhale-${i + 1}.png`),
      ...Array.from({ length: 3 }, (_, i) => `inferno-fire-se-${i + 1}.png`),
    ],
  },
  // Saurians — それぞれ saurians/<name>/ サブディレクトリ
  {
    base: SAURIANS,
    out: join(ROOT, "saurian_skirmisher"),
    files: [
      { remote: "skirmisher/skirmisher.png",          local: "skirmisher.png" },
      { remote: "skirmisher/skirmisher-se-defend1.png", local: "skirmisher-se-defend1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `skirmisher/skirmisher-se-melee${i + 1}.png`,
        local:  `skirmisher-se-melee${i + 1}.png`,
      })),
      // standing: se-bob[1~6]:200 / idle: idle-[1~13]
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `skirmisher/skirmisher-se-bob${i + 1}.png`,
        local:  `skirmisher-se-bob${i + 1}.png`,
      })),
      ...Array.from({ length: 13 }, (_, i) => ({
        remote: `skirmisher/skirmisher-idle-${i + 1}.png`,
        local:  `skirmisher-idle-${i + 1}.png`,
      })),
    ],
  },
  {
    base: SAURIANS,
    out: join(ROOT, "saurian_ambusher"),
    files: [
      { remote: "flanker/flanker.png",          local: "flanker.png" },
      { remote: "flanker/flanker-se-defend1.png", local: "flanker-se-defend1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `flanker/flanker-se-melee${i + 1}.png`,
        local:  `flanker-se-melee${i + 1}.png`,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `flanker/flanker-se-bob${i + 1}.png`,
        local:  `flanker-se-bob${i + 1}.png`,
      })),
    ],
  },
  {
    base: SAURIANS,
    out: join(ROOT, "saurian_augur"),
    files: [
      { remote: "augur/augur.png",          local: "augur.png" },
      { remote: "augur/augur-se-defend1.png", local: "augur-se-defend1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `augur/augur-se-melee${i + 1}.png`,
        local:  `augur-se-melee${i + 1}.png`,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `augur/augur-se-bob${i + 1}.png`,
        local:  `augur-se-bob${i + 1}.png`,
      })),
      // curse: {MAGIC_ARMRAISE_DIRECTIONAL_2_FRAME}の腕上げ
      { remote: "augur/augur-se-magic1.png", local: "augur-se-magic1.png" },
      { remote: "augur/augur-se-magic2.png", local: "augur-se-magic2.png" },
    ],
  },
  {
    base: SAURIANS,
    out: join(ROOT, "saurian_soothsayer"),
    files: [
      { remote: "soothsayer/soothsayer.png",          local: "soothsayer.png" },
      { remote: "soothsayer/soothsayer-se-defend1.png", local: "soothsayer-se-defend1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `soothsayer/soothsayer-se-melee${i + 1}.png`,
        local:  `soothsayer-se-melee${i + 1}.png`,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `soothsayer/soothsayer-se-bob${i + 1}.png`,
        local:  `soothsayer-se-bob${i + 1}.png`,
      })),
      { remote: "soothsayer/soothsayer-se-magic1.png", local: "soothsayer-se-magic1.png" },
      { remote: "soothsayer/soothsayer-se-magic2.png", local: "soothsayer-se-magic2.png" },
    ],
  },

  // ================================================================
  // NORTHERNERS (北方陣営)
  // ================================================================
  {
    base: ORCS,
    out: join(ROOT, "orcish_grunt"),
    files: [
      "grunt.png", "grunt-defend-1.png",
      ...Array.from({ length: 5 }, (_, i) => `grunt-attack-${i + 1}.png`),
      // standing: grunt-stand-se-[1~5,4,3,2]
      ...Array.from({ length: 5 }, (_, i) => `grunt-stand-se-${i + 1}.png`),
    ],
  },
  {
    base: ORCS,
    out: join(ROOT, "orcish_warrior"),
    files: [
      "warrior.png", "warrior-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `warrior-attack-${i + 1}.png`),
      // standing: warrior-bob-[1~3,2]
      ...Array.from({ length: 3 }, (_, i) => `warrior-bob-${i + 1}.png`),
    ],
  },
  {
    base: ORCS,
    out: join(ROOT, "orcish_crossbow"),
    files: [
      { remote: "xbowman.png",        local: "xbowman.png" },
      { remote: "xbowman-defend.png", local: "xbowman-defend.png" },
      { remote: "xbowman-melee.png",  local: "xbowman-melee.png" },
      { remote: "xbowman-melee-defend-1.png", local: "xbowman-melee-defend-1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `xbowman-melee-attack-${i + 1}.png`,
        local:  `xbowman-melee-attack-${i + 1}.png`,
      })),
      // standing: xbowman.png:50 + xbowman-breeze-[1~5]:240
      ...Array.from({ length: 5 }, (_, i) => `xbowman-breeze-${i + 1}.png`),
      // bow/fire_arrow: クロスボウ発射フレーム
      "xbowman-ranged-1.png", "xbowman-ranged-2.png",
    ],
  },
  // orcish_archer: 近接フレームを追加
  {
    base: ORCS,
    out: join(ROOT, "orcish_archer"),
    files: [
      "archer.png",
      ...Array.from({ length: 4 }, (_, i) => `archer-melee-${i + 1}.png`),
      // bow/fire_arrow: 弓フレーム + 被弾リアクション
      "archer-bow.png", "archer-bow-defend.png",
      ...Array.from({ length: 4 }, (_, i) => `archer-bow-attack-${i + 1}.png`),
      // standing: archer-bob-[1~6] / idle: archer-idle-[1~6]
      ...Array.from({ length: 6 }, (_, i) => `archer-bob-${i + 1}.png`),
      ...Array.from({ length: 6 }, (_, i) => `archer-idle-${i + 1}.png`),
    ],
  },
  {
    base: ORCS,
    out: join(ROOT, "orcish_assassin"),
    files: [
      "assassin.png", "assassin-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `assassin-attack-${i + 1}.png`),
      // thrown_knife: 投げナイフフレーム
      "assassin-ranged1.png", "assassin-ranged2.png",
      // standing: assassin-heaving-[1~4,3,2] / idle: assassin-idle-[1~9]
      ...Array.from({ length: 4 }, (_, i) => `assassin-heaving-${i + 1}.png`),
      ...Array.from({ length: 9 }, (_, i) => `assassin-idle-${i + 1}.png`),
    ],
  },
  {
    base: ORCS,
    out: join(ROOT, "orcish_slayer"),
    files: [
      "slayer.png", "slayer-defend.png",
      ...Array.from({ length: 6 }, (_, i) => `slayer-attack-${i + 1}.png`),
      // standing: slayer.png:200 + slayer-breeze-[1~3,2,1]:200
      ...Array.from({ length: 3 }, (_, i) => `slayer-breeze-${i + 1}.png`),
      // thrown_knife: 投げナイフフレーム
      "slayer-ranged1.png", "slayer-ranged2.png",
    ],
  },
  {
    base: ORCS,
    out: join(ROOT, "orcish_nightblade"),
    files: [
      "nightblade.png", "nightblade-defend-se-1-1.png",
      ...Array.from({ length: 6 }, (_, i) => `nightblade-attack-se-${i + 1}.png`),
      // thrown_knife: 投げナイフフレーム
      ...Array.from({ length: 9 }, (_, i) => `nightblade-throw-se-${i + 1}.png`),
    ],
  },
  // pillager と wolf_rider は goblins/ ディレクトリ
  {
    base: GOBLINS,
    out: join(ROOT, "orcish_pillager"),
    files: [
      { remote: "pillager.png",          local: "pillager.png" },
      { remote: "pillager-attack.png",   local: "pillager-attack.png" },
      { remote: "pillager-attack2.png",  local: "pillager-attack2.png" },
      { remote: "pillager-defend-1.png", local: "pillager-defend-1.png" },
      { remote: "pillager-moving.png",   local: "pillager-moving.png" }, // torch攻撃
      // net: 投げ網フレーム
      { remote: "pillager-net1.png", local: "pillager-net1.png" },
      { remote: "pillager-net2.png", local: "pillager-net2.png" },
      { remote: "pillager-net3.png", local: "pillager-net3.png" },
      // standing多層: 胴体(base[1~4]:210) + 松明の炎(pillager-flame/a[1~14]:60) + グロー
      ...Array.from({ length: 14 }, (_, i) => ({
        remote: `pillager-flame/a${i + 1}.png`,
        local:  `flame-a${i + 1}.png`,
      })),
      { remote: "pillager-flame/glow.png", local: "flame-glow.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `pillager-base${i + 1}.png`,
        local:  `pillager-base${i + 1}.png`,
      })),
    ],
  },
  {
    base: GOBLINS,
    out: join(ROOT, "wolf_rider"),
    files: [
      { remote: "wolf-rider.png",          local: "wolf-rider.png" },
      { remote: "wolf-rider-attack.png",   local: "wolf-rider-attack.png" },
      { remote: "wolf-rider-defend-1.png", local: "wolf-rider-defend-1.png" },
      // idle: wolf-rider-idle-[1~5,4,3~5,4~1]:100
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `wolf-rider-idle-${i + 1}.png`,
        local:  `wolf-rider-idle-${i + 1}.png`,
      })),
    ],
  },
  {
    base: TROLLS,
    out: join(ROOT, "troll"),
    files: [
      { remote: "great-troll.png",          local: "great-troll.png" },
      { remote: "great-troll-defend1.png",  local: "great-troll-defend1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `great-troll-attack-${i + 1}.png`,
        local:  `great-troll-attack-${i + 1}.png`,
      })),
    ],
  },
  {
    base: TROLLS,
    out: join(ROOT, "troll_grunt"),
    files: [
      "grunt.png", "grunt-defend.png",
      ...Array.from({ length: 4 }, (_, i) => `grunt-attack-${i + 1}.png`),
    ],
  },
  // naga は nagas/fighter/ サブディレクトリ
  {
    base: NAGAS,
    out: join(ROOT, "naga_fighter"),
    files: [
      { remote: "fighter/fighter.png",          local: "fighter.png" },
      { remote: "fighter/fighter-defend-1.png", local: "fighter-defend-1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `fighter/fighter-melee-${i + 1}.png`,
        local:  `fighter-melee-${i + 1}.png`,
      })),
      // idle: fighter-idle-[1~8,...]
      ...Array.from({ length: 8 }, (_, i) => ({
        remote: `fighter/fighter-idle-${i + 1}.png`,
        local:  `fighter-idle-${i + 1}.png`,
      })),
    ],
  },
  {
    base: NAGAS,
    out: join(ROOT, "naga_warrior"),
    files: [
      { remote: "fighter/warrior.png",          local: "warrior.png" },
      { remote: "fighter/warrior-defend-1.png", local: "warrior-defend-1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `fighter/warrior-melee-${i + 1}.png`,
        local:  `warrior-melee-${i + 1}.png`,
      })),
    ],
  },
  // rogue/thief は human-outlaws/
  {
    base: OUTLAWS,
    out: join(ROOT, "rogue"),
    files: ["rogue.png", "rogue-defend-1.png"],
  },
  {
    base: OUTLAWS,
    out: join(ROOT, "thief"),
    files: [
      "thief.png", "thief-attack.png", "thief-defend.png",
      // idle: thief-idle-[1~7]:[100*4,200,150,500]
      ...Array.from({ length: 7 }, (_, i) => `thief-idle-${i + 1}.png`),
    ],
  },

  // ================================================================
  // REBELS (反乱軍陣営)
  // ================================================================
  // elvish_fighter は elves-wood/fighter/ サブディレクトリ(idleフレームだけ直下にある)
  {
    base: ELVES,
    out: join(ROOT, "elvish_fighter"),
    files: [
      { remote: "fighter/fighter.png",        local: "fighter.png" },
      { remote: "fighter/fighter-defend.png",  local: "fighter-defend.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `fighter/fighter-melee-${i + 1}.png`,
        local:  `fighter-melee-${i + 1}.png`,
      })),
      // bow: 弓フレーム
      { remote: "fighter/fighter-bow.png", local: "fighter-bow.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `fighter/fighter-bow-attack${i + 1}.png`,
        local:  `fighter-bow-attack${i + 1}.png`,
      })),
      // idle: fighter-idle-[1~12] (elves-wood/ 直下)
      ...Array.from({ length: 12 }, (_, i) => ({
        remote: `fighter-idle-${i + 1}.png`,
        local:  `fighter-idle-${i + 1}.png`,
      })),
    ],
  },
  {
    base: ELVES,
    out: join(ROOT, "elvish_archer"),
    files: [
      "archer.png", "archer-bow-defend.png", "archer-sword-defend.png",
      ...Array.from({ length: 4 }, (_, i) => `archer-sword-${i + 1}.png`),
      // idle: archer-idle-[1~6,3~6,3~6,2,1]:100
      ...Array.from({ length: 6 }, (_, i) => `archer-idle-${i + 1}.png`),
      // bow: 弓フレーム
      "archer-bow.png",
      ...Array.from({ length: 4 }, (_, i) => `archer-bow-attack${i + 1}.png`),
    ],
  },
  // elvish_scout / elvish_outrider は elves-wood/scout|outrider/ サブディレクトリ
  {
    base: ELVES,
    out: join(ROOT, "elvish_scout"),
    files: [
      { remote: "scout/scout.png",         local: "scout.png" },
      { remote: "scout/scout-defend1.png", local: "scout-defend1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `scout/scout-melee-${i + 1}.png`,
        local:  `scout-melee-${i + 1}.png`,
      })),
      // bow: 弓フレーム
      { remote: "scout/scout-bow.png", local: "scout-bow.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `scout/scout-bow-attack${i + 1}.png`,
        local:  `scout-bow-attack${i + 1}.png`,
      })),
    ],
  },
  {
    base: ELVES,
    out: join(ROOT, "elvish_outrider"),
    files: [
      { remote: "outrider/outrider.png",         local: "outrider.png" },
      { remote: "outrider/outrider-defend1.png", local: "outrider-defend1.png" },
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `outrider/outrider-melee-${i}.png`,
        local:  `outrider-melee-${i}.png`,
      })),
    ],
  },
  {
    base: ELVES,
    out: join(ROOT, "elvish_captain"),
    files: [
      "captain.png", "captain-defend.png",
      "captain-melee-1.png", "captain-melee-2.png",
      // bow: 弓フレーム
      "captain-bow.png",
      ...Array.from({ length: 4 }, (_, i) => `captain-bow-attack${i + 1}.png`),
    ],
  },
  {
    base: ELVES,
    out: join(ROOT, "elvish_hero"),
    files: [
      "hero.png", "hero-defend.png",
      ...Array.from({ length: 4 }, (_, i) => `hero-melee-${i + 1}.png`),
      // bow: 弓フレーム
      "hero-bow.png",
      ...Array.from({ length: 4 }, (_, i) => `hero-bow-attack${i + 1}.png`),
      // idle: hero-idle-[1~11]:275
      ...Array.from({ length: 11 }, (_, i) => `hero-idle-${i + 1}.png`),
    ],
  },
  {
    base: ELVES,
    out: join(ROOT, "elvish_marksman"),
    files: [
      "marksman.png", "marksman-bow-defend.png", "marksman-sword-defend.png",
      "marksman-sword-1.png", "marksman-sword-2.png", "marksman-sword-3.png",
      // bow(WML名はlongbow): 弓フレーム
      "marksman-bow.png",
      ...Array.from({ length: 4 }, (_, i) => `marksman-bow-attack${i + 1}.png`),
    ],
  },
  {
    base: ELVES,
    out: join(ROOT, "elvish_shaman"),
    files: [
      "shaman.png", "shaman-defend.png", "shaman-attack.png", "shaman-attack2.png",
      // idle: shaman-idle-[1~6,6,5,4,3]:200
      ...Array.from({ length: 6 }, (_, i) => `shaman-idle-${i + 1}.png`),
    ],
  },
  {
    base: ELVES,
    out: join(ROOT, "elvish_druid"),
    files: [
      "druid.png", "druid-defend-1.png", "druid-attack.png",
      // entangle/thorns: 魔法詠唱フレーム
      ...Array.from({ length: 4 }, (_, i) => `druid-magic-${i + 1}.png`),
    ],
  },
  {
    base: ELVES,
    out: join(ROOT, "elvish_sylph"),
    files: ["sylph.png"],
  },
  {
    base: MERFOLK,
    out: join(ROOT, "mermaid_siren"),
    files: ["siren.png", "siren-defend1.png", "siren-magic-1.png", "siren-magic-2.png"],
  },
  // mermaid_initiate は loyalists spriteKey だが rebels の mermaid_witch が使う
  {
    base: MERFOLK,
    out: join(ROOT, "mermaid_initiate"),
    files: [
      "initiate.png", "initiate-defend-1.png",
      "initiate-staff-attack-1.png", "initiate-staff-attack-2.png",
      // water_magic: 詠唱フレーム
      "initiate-magic-1.png", "initiate-magic-2.png",
    ],
  },
  // silver_mage は human-magi/ — rebels の elvish_magician が使う
  {
    base: MAGI,
    out: join(ROOT, "silver_mage"),
    files: [
      { remote: "silver-mage+female.png",        local: "silver-mage+female.png" },
      { remote: "silver-mage+female-defend.png", local: "silver-mage+female-defend.png" },
      // staff / magic_fayflicker: 攻撃フレーム
      { remote: "silver-mage+female-attack-staff1.png", local: "silver-mage+female-attack-staff1.png" },
      { remote: "silver-mage+female-attack-staff2.png", local: "silver-mage+female-attack-staff2.png" },
      { remote: "silver-mage+female-attack-magic1.png", local: "silver-mage+female-attack-magic1.png" },
      { remote: "silver-mage+female-attack-magic2.png", local: "silver-mage+female-attack-magic2.png" },
    ],
  },
  {
    base: WOSES,
    out: join(ROOT, "wose"),
    files: [
      "wose.png", "wose-defend.png", "wose-attack-1.png", "wose-attack-2.png",
      // idle: wose-idle-[1~7]:[250,400*2,250*4]
      ...Array.from({ length: 7 }, (_, i) => `wose-idle-${i + 1}.png`),
    ],
  },
  {
    base: WOSES,
    out: join(ROOT, "wose-ancient"),
    files: [
      { remote: "wose-ancient.png",          local: "wose-ancient.png" },
      { remote: "wose-ancient-defend.png",   local: "wose-ancient-defend.png" },
      { remote: "wose-ancient-attack-1.png", local: "wose-ancient-attack-1.png" },
      { remote: "wose-ancient-attack-2.png", local: "wose-ancient-attack-2.png" },
    ],
  },

  // ================================================================
  // UNDEAD (アンデッド陣営)
  // ================================================================
  {
    base: UNDEAD,
    out: join(ROOT, "ghoul"),
    files: [
      "ghoul.png", "ghoul-defend-1.png",
      ...Array.from({ length: 3 }, (_, i) => `ghoul-attack-${i + 1}.png`),
      // idle: ghoul-idle-[1~3,3*2,3~5]:200
      ...Array.from({ length: 5 }, (_, i) => `ghoul-idle-${i + 1}.png`),
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "necrophage"),
    files: [
      "necrophage.png", "necrophage-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `necrophage-attack-${i + 1}.png`),
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "walking_corpse"),
    files: [
      { remote: "zombie.png",          local: "zombie.png" },
      { remote: "zombie-defend.png",   local: "zombie-defend.png" },
      { remote: "zombie-attack.png",   local: "zombie-attack.png" },
      // standing: zombie-standing-[1~7,2]
      ...Array.from({ length: 7 }, (_, i) => ({
        remote: `zombie-standing-${i + 1}.png`,
        local:  `zombie-standing-${i + 1}.png`,
      })),
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "soulness"),
    files: [
      { remote: "soulless.png",          local: "soulless.png" },
      { remote: "soulless-defend.png",   local: "soulless-defend.png" },
      { remote: "soulless-attack.png",   local: "soulless-attack.png" },
      // standing: soulless-standing-[1~7,2]
      ...Array.from({ length: 7 }, (_, i) => ({
        remote: `soulless-standing-${i + 1}.png`,
        local:  `soulless-standing-${i + 1}.png`,
      })),
    ],
  },
  // 疫病の死体フォーム(zombie_*)。本家Corpse_Walking.cfgのvariation。
  // drake/saurian/swimmer/troll/wolf/wose は単純ループ(基本形1枚のみ)、
  // mountedは基本形と同じ7フレームのstanding、batはvampire_bat/dread_batと同じ羽ばたきパターン
  {
    base: UNDEAD,
    out: join(ROOT, "zombie_drake"),
    files: [
      { remote: "zombie-drake.png",        local: "zombie-drake.png" },
      { remote: "zombie-drake-defend.png", local: "zombie-drake-defend.png" },
      { remote: "zombie-drake-attack.png", local: "zombie-drake-attack.png" },
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "zombie_saurian"),
    files: [
      { remote: "zombie-saurian.png",        local: "zombie-saurian.png" },
      { remote: "zombie-saurian-defend.png", local: "zombie-saurian-defend.png" },
      { remote: "zombie-saurian-attack.png", local: "zombie-saurian-attack.png" },
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "zombie_swimmer"),
    files: [
      { remote: "zombie-swimmer.png",        local: "zombie-swimmer.png" },
      { remote: "zombie-swimmer-defend.png", local: "zombie-swimmer-defend.png" },
      { remote: "zombie-swimmer-attack.png", local: "zombie-swimmer-attack.png" },
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "zombie_troll"),
    files: [
      { remote: "zombie-troll.png",        local: "zombie-troll.png" },
      { remote: "zombie-troll-defend.png", local: "zombie-troll-defend.png" },
      { remote: "zombie-troll-attack.png", local: "zombie-troll-attack.png" },
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "zombie_wolf"),
    files: [
      { remote: "zombie-wolf.png",        local: "zombie-wolf.png" },
      { remote: "zombie-wolf-defend.png", local: "zombie-wolf-defend.png" },
      { remote: "zombie-wolf-attack.png", local: "zombie-wolf-attack.png" },
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "zombie_wose"),
    files: [
      { remote: "zombie-wose.png",        local: "zombie-wose.png" },
      { remote: "zombie-wose-defend.png", local: "zombie-wose-defend.png" },
      { remote: "zombie-wose-attack.png", local: "zombie-wose-attack.png" },
    ],
  },
  {
    base: UNDEAD,
    out: join(ROOT, "zombie_mounted"),
    files: [
      { remote: "zombie-mounted.png",        local: "zombie-mounted.png" },
      { remote: "zombie-mounted-defend.png", local: "zombie-mounted-defend.png" },
      { remote: "zombie-mounted-attack.png", local: "zombie-mounted-attack.png" },
      // standing: zombie-mounted-standing-[1~7,2]
      ...Array.from({ length: 7 }, (_, i) => ({
        remote: `zombie-mounted-standing-${i + 1}.png`,
        local:  `zombie-mounted-standing-${i + 1}.png`,
      })),
    ],
  },
  // zombie_bat は attack/defend静止画を持たず、羽ばたきse/neフレームのみで全て表現(本家仕様)
  {
    base: UNDEAD,
    out: join(ROOT, "zombie_bat"),
    files: [
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `zombie-bat-se-${i + 1}.png`,
        local:  `zombie-bat-se-${i + 1}.png`,
      })),
    ],
  },
  // skeleton は undead-skeletal/skeleton/ サブディレクトリ
  {
    base: UNDEAD_SK,
    out: join(ROOT, "skeleton"),
    files: [
      { remote: "skeleton/skeleton.png",            local: "skeleton.png" },
      { remote: "skeleton/skeleton-se-defend1.png", local: "skeleton-se-defend1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `skeleton/skeleton-se-melee${i + 1}.png`,
        local:  `skeleton-se-melee${i + 1}.png`,
      })),
      // standing: se-bob[1~8]:200 / idle: idle-[1~3]
      ...Array.from({ length: 8 }, (_, i) => ({
        remote: `skeleton/skeleton-se-bob${i + 1}.png`,
        local:  `skeleton-se-bob${i + 1}.png`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `skeleton/skeleton-idle-${i + 1}.png`,
        local:  `skeleton-idle-${i + 1}.png`,
      })),
    ],
  },
  // skeleton_archer は undead-skeletal/archer/ サブディレクトリ
  {
    base: UNDEAD_SK,
    out: join(ROOT, "skeleton_archer"),
    files: [
      { remote: "archer/archer.png",        local: "archer.png" },
      { remote: "archer/archer-defend.png", local: "archer-defend.png" },
      { remote: "archer/archer-attack.png", local: "archer-attack.png" },
      // bow: 弓フレーム
      { remote: "archer/archer-bow.png", local: "archer-bow.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `archer/archer-bow-attack-${i + 1}.png`,
        local:  `archer-bow-attack-${i + 1}.png`,
      })),
      // standing: archer-bob-[1~8]:200 / idle: archer-idle-[1~14]
      ...Array.from({ length: 8 }, (_, i) => ({
        remote: `archer/archer-bob-${i + 1}.png`,
        local:  `archer-bob-${i + 1}.png`,
      })),
      ...Array.from({ length: 14 }, (_, i) => ({
        remote: `archer/archer-idle-${i + 1}.png`,
        local:  `archer-idle-${i + 1}.png`,
      })),
    ],
  },
  {
    base: UNDEAD_SK,
    out: join(ROOT, "skeleton_banebow"),
    files: [
      "banebow.png", "banebow-bow-defend.png", "banebow-melee-defend-1.png",
      ...Array.from({ length: 4 }, (_, i) => `banebow-melee-attack-${i + 1}.png`),
      // bow: 弓フレーム
      "banebow-bow.png",
      ...Array.from({ length: 4 }, (_, i) => `banebow-bow-attack-${i + 1}.png`),
    ],
  },
  {
    base: UNDEAD_SK,
    out: join(ROOT, "deathblade"),
    files: [
      "deathblade.png", "deathblade-defend-1.png",
      "deathblade-attack1.png", "deathblade-attack2.png", "deathblade-attack3.png",
      // idle: deathblade-idle-[1~5,4,5,4,2,1]:100
      ...Array.from({ length: 5 }, (_, i) => `deathblade-idle-${i + 1}.png`),
    ],
  },
  {
    base: UNDEAD_SK,
    out: join(ROOT, "deathknight"),
    files: ["deathknight.png", "deathknight-defend-1.png"],
  },
  // dark_adapt = necromancer adept
  {
    base: UNDEAD_NE,
    out: join(ROOT, "dark_adapt"),
    files: [
      { remote: "adept.png",        local: "adept.png" },
      { remote: "adept-defend-1.png", local: "adept-defend-1.png" },
      // cold_storm/shadow_wave: 詠唱フレーム
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `adept-magic-${i + 1}.png`,
        local:  `adept-magic-${i + 1}.png`,
      })),
      // idle: adept-idle-[1~11]:125
      ...Array.from({ length: 11 }, (_, i) => ({
        remote: `adept-idle-${i + 1}.png`,
        local:  `adept-idle-${i + 1}.png`,
      })),
    ],
  },
  {
    base: UNDEAD_NE,
    out: join(ROOT, "dark_sorcerer"),
    files: [
      { remote: "dark-sorcerer.png",                 local: "dark-sorcerer.png" },
      { remote: "dark-sorcerer-defend.png",          local: "dark-sorcerer-defend.png" },
      { remote: "dark-sorcerer-attack-staff-1.png",  local: "dark-sorcerer-attack-staff-1.png" },
      { remote: "dark-sorcerer-attack-staff-2.png",  local: "dark-sorcerer-attack-staff-2.png" },
      // cold_wave: 詠唱フレーム
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `dark-sorcerer-magic-${i + 1}.png`,
        local:  `dark-sorcerer-magic-${i + 1}.png`,
      })),
    ],
  },
  {
    base: UNDEAD_NE,
    out: join(ROOT, "lich"),
    files: [
      { remote: "lich.png",        local: "lich.png" },
      { remote: "lich-defend.png", local: "lich-defend.png" },
      { remote: "lich-melee-1.png", local: "lich-melee-1.png" },
      { remote: "lich-melee-2.png", local: "lich-melee-2.png" },
      // cold_wave: 詠唱フレーム
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `lich-magic-${i + 1}.png`,
        local:  `lich-magic-${i + 1}.png`,
      })),
      // idle: lichとlich-idle-[1~3]の交互列
      { remote: "lich-idle-1.png", local: "lich-idle-1.png" },
      { remote: "lich-idle-2.png", local: "lich-idle-2.png" },
      { remote: "lich-idle-3.png", local: "lich-idle-3.png" },
    ],
  },
  // ghost は undead-spirit/ — ghost-base.png が静止画
  {
    base: UNDEAD_SP,
    out: join(ROOT, "ghost"),
    files: [
      { remote: "ghost-base.png", local: "ghost-base.png" },
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `ghost-s-attack-${i + 1}.png`,
        local:  `ghost-s-attack-${i + 1}.png`,
      })),
      // standing: ghost-s-[2,1~3,...]:250
      ...Array.from({ length: 3 }, (_, i) => ({
        remote: `ghost-s-${i + 1}.png`,
        local:  `ghost-s-${i + 1}.png`,
      })),
    ],
  },
  // wraith は undead-spirit/ — wraith-s.png が静止画
  {
    base: UNDEAD_SP,
    out: join(ROOT, "wraith"),
    files: [
      { remote: "wraith-s.png",          local: "wraith-s.png" },
      { remote: "wraith-s-defend-1.png", local: "wraith-s-defend-1.png" },
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `wraith-s-attack-${i + 1}.png`,
        local:  `wraith-s-attack-${i + 1}.png`,
      })),
      // standing: wraith-s-[1~4]:200
      ...Array.from({ length: 4 }, (_, i) => ({
        remote: `wraith-s-${i + 1}.png`,
        local:  `wraith-s-${i + 1}.png`,
      })),
    ],
  },
  // vampire_bat / dread_bat は bats/ — *-ne-*.png が flying フレーム(静止画なし)
  {
    base: BATS,
    out: join(ROOT, "vampire_bat"),
    files: [
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `bat-ne-${i + 1}.png`,
        local:  `bat-ne-${i + 1}.png`,
      })),
      // standing(南向き羽ばたき): bat-se-[3~1,2~5,4]
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `bat-se-${i + 1}.png`,
        local:  `bat-se-${i + 1}.png`,
      })),
    ],
  },
  {
    base: BATS,
    out: join(ROOT, "dread_bat"),
    files: [
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `dreadbat-ne-${i + 1}.png`,
        local:  `dreadbat-ne-${i + 1}.png`,
      })),
      // standing(南向き羽ばたき): dreadbat-se-[3~1,2~5,4]
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `dreadbat-se-${i + 1}.png`,
        local:  `dreadbat-se-${i + 1}.png`,
      })),
    ],
  },

  // ----------------------------------------------------------------
  // 飛び道具
  // ----------------------------------------------------------------
  {
    base: PROJ,
    out: join(ROOT, "projectiles"),
    files: [
      "spear-n.png",        // spearman javelin
      "missile-n.png",      // bowman/longbowman/lieutenant/dragoon/duelist crossbow
      // drakeのfire_breath: {DRAKE_FIRE_ANIM_S_DIAGONAL}の炎(南東向き)
      ...Array.from({ length: 5 }, (_, i) => `fire-breath-se-${i + 1}.png`),
      // saurianのcurse: {MISSILE_FRAME_ICE}の氷弾+着弾スプラッシュ
      "whitemissile-n.png",
      // オークの火矢・投げナイフ・投げ網
      "missile-fire-n.png",
      "dagger-n.png",
      "web.png",
      // エルフ魔法: 絡みつく蔦(対象上に出現)・棘・人魚の水流
      "entangle.png",
      "thorns.png",
      "water-spray.png",
      // アンデッド: 骨矢・冷気弾・影の弾・うめき声の波
      "bone-n.png",
      ...Array.from({ length: 7 }, (_, i) => `icemissile-n-${i + 1}.png`),
      "darkmissile-n.png",
      ...Array.from({ length: 6 }, (_, i) => `wailprojectile-s-${i + 1}.png`),
      ...Array.from({ length: 8 }, (_, i) => `whitemissile-impact-${i + 1}.png`),
    ],
  },
  // halo(魔法弾の光球など)
  {
    base: HALO,
    out: join(ROOT, "halo"),
    files: [
      // mageのmagic_missile: {MAGIC_MISSILE}の光球
      ...Array.from({ length: 5 }, (_, i) => `mage-halo${i + 1}.png`),
      // white_mageのlightbeam: {MISSILE_FRAME_LIGHT_BEAM}の天から降りる光柱
      ...Array.from({ length: 7 }, (_, i) => ({
        remote: `holy/light-beam-${i + 1}.png`,
        local:  `light-beam-${i + 1}.png`,
      })),
      // sylphの魔法: 妖精の炎
      ...Array.from({ length: 7 }, (_, i) => ({
        remote: `elven/faerie-fire-halo${i + 1}.png`,
        local:  `faerie-fire-halo${i + 1}.png`,
      })),
      // shadow_wave: 対象上の闇のバースト / adeptの詠唱halo
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `undead/dark-magic-${i + 1}.png`,
        local:  `dark-magic-${i + 1}.png`,
      })),
      // dark_sorcerer/lichの詠唱halo
      ...Array.from({ length: 5 }, (_, i) => ({
        remote: `undead/black-magic-${i + 1}.png`,
        local:  `black-magic-${i + 1}.png`,
      })),
      // mage/silver_mageの杖先フレア({MAGIC_MISSILE_STAFF_FLARE})
      ...Array.from({ length: 7 }, (_, i) => `mage-preparation-halo${i + 1}.png`),
      // white_mageのlightbeam詠唱halo(頭上の光輪)
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `holy/halo${i + 1}.png`,
        local:  `holy-halo${i + 1}.png`,
      })),
      // サウリアンの詠唱halo({HALO_FRAME_SAURIAN})
      ...Array.from({ length: 7 }, (_, i) => `saurian-magic-halo-${i + 1}.png`),
    ],
  },

  // ----------------------------------------------------------------
  // 地形タイル
  // ----------------------------------------------------------------
  // 地形タイル: *-tile.png はエディタ用の単体ヘックス代表画像(ブレンド不要で使える)
  {
    base: TERRAIN,
    out: join(ROOT, "terrain"),
    files: [
      { remote: "grass/green.png",                      local: "grass-green.png" },
      { remote: "forest/deciduous-summer-tile.png",     local: "forest-tile.png" },
      { remote: "hills/regular.png",                    local: "hills-tile.png" },
      { remote: "mountains/basic-tile.png",             local: "mountains-tile.png" },
      { remote: "water/coast-tile.png",                 local: "shallow-water-tile.png" },
      { remote: "water/ocean-tile.png",                 local: "deep-water-tile.png" },
      { remote: "village/human-tile.png",               local: "village-tile.png" },
      { remote: "castle/castle-tile.png",               local: "castle-tile.png" },
      { remote: "castle/keep-tile.png",                 local: "keep-tile.png" },
      { remote: "sand/beach.png",                       local: "sand-beach-tile.png" },
      { remote: "sand/desert.png",                      local: "sand-desert-tile.png" },
    ],
  },
];

// 直接実行されたときだけダウンロードする(テストからはASSET_GROUPSのimportのみ)
const isMain =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  for (const group of ASSET_GROUPS) {
    await mkdir(group.out, { recursive: true });
    for (const f of group.files) {
      const remote = typeof f === "string" ? f : f.remote;
      const local  = typeof f === "string" ? f : f.local;
      const res = await fetch(`${group.base}/${remote}`);
      if (!res.ok) throw new Error(`${remote}: HTTP ${res.status}`);
      await writeFile(join(group.out, local), Buffer.from(await res.arrayBuffer()));
      console.log(`fetched ${local}`);
    }
  }
  console.log(`done -> ${ROOT}`);
  // 組み込み1枚絵(フォールバック用。src/generated/)の生成も続けて行う。
  // フロントのビルド・typecheckはこの生成物に依存するため、取得とセットで実行する
  const { execSync } = await import("node:child_process");
  execSync("npx tsx scripts/generate-unit-base-images.mts", {
    stdio: "inherit",
    cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
  });
}
