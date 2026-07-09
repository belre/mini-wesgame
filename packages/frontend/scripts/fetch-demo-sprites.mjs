// スプライトアセットのダウンロードスクリプト。
// Wesnoth本家(GPLv2+)のアセットのためリポジトリにはコミットせず(gitignore)、
// 別環境でも毎回これで取得する: node packages/frontend/scripts/fetch-demo-sprites.mjs
//
// 対象: mini版の2陣営(loyalists/northerners) + 飛び道具 + 地形タイル。
// lib/sprites.ts の UNIT_SPRITES に定義したフレームはすべて取得する。
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE      = "https://raw.githubusercontent.com/wesnoth/wesnoth/master/data/core/images/units";
export const ROOT      = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sprites");
const LOYALISTS = `${BASE}/human-loyalists`;
const MAGI      = `${BASE}/human-magi`;
const MERFOLK   = `${BASE}/merfolk`;
const ORCS      = `${BASE}/orcs`;
const GOBLINS   = `${BASE}/goblins`;
const TROLLS    = `${BASE}/trolls`;
const NAGAS     = `${BASE}/nagas`;
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
  // ----------------------------------------------------------------
  // 飛び道具
  // ----------------------------------------------------------------
  {
    base: PROJ,
    out: join(ROOT, "projectiles"),
    files: [
      "spear-n.png",        // spearman javelin
      "missile-n.png",      // bowman/longbowman/lieutenant/dragoon/duelist crossbow
      // オークの火矢・投げナイフ・投げ網
      "missile-fire-n.png",
      "dagger-n.png",
      "web.png",
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
      // mageの杖先フレア({MAGIC_MISSILE_STAFF_FLARE})
      ...Array.from({ length: 7 }, (_, i) => `mage-preparation-halo${i + 1}.png`),
      // white_mageのlightbeam詠唱halo(頭上の光輪)
      ...Array.from({ length: 6 }, (_, i) => ({
        remote: `holy/halo${i + 1}.png`,
        local:  `holy-halo${i + 1}.png`,
      })),
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
