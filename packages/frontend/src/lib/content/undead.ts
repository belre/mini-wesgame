// アンデッド陣営のスプライト定義(コンテンツ)。
// WML転記元は各エントリーのコメント参照。追加手順は docs/sprite_guide.md
import type { UnitSpriteDef } from "../anim/model";
import {
  ASSET_BASE,
  CHILL_WAVE_MISSILE,
  SHADOW_WAVE_MISSILE,
  SHADOW_WAVE_TRACKS,
  WAIL_MISSILE,
  halo_,
} from "./shared";

export const SPRITES: Record<string, UnitSpriteDef> = {
  "units/undead/skeleton": {
    base: `${ASSET_BASE}/sprites/skeleton/skeleton.png`,
    // {STANDING_ANIM_DIRECTIONAL_8_FRAME} → se-bob[1~8].png:200
    standing: Array.from({ length: 8 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/skeleton/skeleton-se-bob${i + 1}.png`,
      duration: 200,
    })),
    // image="skeleton-idle-[1~3,2,3,2,3,2,3,2].png:100"
    idle: [1, 2, 3, 2, 3, 2, 3, 2, 3, 2].map((n) => ({
      image: `${ASSET_BASE}/sprites/skeleton/skeleton-idle-${n}.png`,
      duration: 100,
    })),
    attacks: {
      axe: {
        startTime: -300,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/skeleton/skeleton-se-melee${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/skeleton/skeleton-se-defend1.png` },
  },
  "units/undead/deathblade": {
    base: `${ASSET_BASE}/sprites/deathblade/deathblade.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/deathblade/deathblade.png`, duration: 500 }],
    // image="deathblade-idle-[1~5,4,5,4,2,1].png:100"
    idle: [1, 2, 3, 4, 5, 4, 5, 4, 2, 1].map((n) => ({
      image: `${ASSET_BASE}/sprites/deathblade/deathblade-idle-${n}.png`,
      duration: 100,
    })),
    attacks: {
      axe: {
        startTime: -300,
        frames: [
          { image: `${ASSET_BASE}/sprites/deathblade/deathblade-attack1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/deathblade/deathblade-attack2.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/deathblade/deathblade-attack3.png`, duration: 100 },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/deathblade/deathblade-defend-1.png` },
  },
  "units/undead/skeleton_archer": {
    base: `${ASSET_BASE}/sprites/skeleton_archer/archer.png`,
    // image="archer-bob-[1~8].png:200"
    standing: Array.from({ length: 8 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/skeleton_archer/archer-bob-${i + 1}.png`,
      duration: 200,
    })),
    // image="archer-idle-[1~14].png:[100*5,200,100*5,200,100*2]"
    idle: [
      [1, 100], [2, 100], [3, 100], [4, 100], [5, 100], [6, 200],
      [7, 100], [8, 100], [9, 100], [10, 100], [11, 100], [12, 200],
      [13, 100], [14, 100],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/skeleton_archer/archer-idle-${n}.png`,
      duration: d,
    })),
    attacks: {
      bone_fist: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/skeleton_archer/archer-attack.png`, duration: 100 },
        ],
      },
      // bow: start_time=-445, archer-bow:65 → bow-attack-[1~4]:[75*2,100,130] → archer-bow:65
      bow: {
        startTime: -445,
        frames: [
          { image: `${ASSET_BASE}/sprites/skeleton_archer/archer-bow.png`, duration: 65 },
          { image: `${ASSET_BASE}/sprites/skeleton_archer/archer-bow-attack-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/skeleton_archer/archer-bow-attack-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/skeleton_archer/archer-bow-attack-3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/skeleton_archer/archer-bow-attack-4.png`, duration: 130 },
          { image: `${ASSET_BASE}/sprites/skeleton_archer/archer-bow.png`, duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/skeleton_archer/archer-defend.png` },
  },
  "units/undead/skeleton_banebow": {
    base: `${ASSET_BASE}/sprites/skeleton_banebow/banebow.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/skeleton_banebow/banebow.png`, duration: 500 }],
    attacks: {
      dagger: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/skeleton_banebow/banebow-melee-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
      // bow: start_time=-445, banebow-bow:65 → bow-attack-[1~4]:[75*2,100,130] → banebow-bow:65。
      // 矢は骨(projectiles/bone-n)
      bow: {
        startTime: -445,
        frames: [
          { image: `${ASSET_BASE}/sprites/skeleton_banebow/banebow-bow.png`, duration: 65 },
          { image: `${ASSET_BASE}/sprites/skeleton_banebow/banebow-bow-attack-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/skeleton_banebow/banebow-bow-attack-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/skeleton_banebow/banebow-bow-attack-3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/skeleton_banebow/banebow-bow-attack-4.png`, duration: 130 },
          { image: `${ASSET_BASE}/sprites/skeleton_banebow/banebow-bow.png`, duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/bone-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/skeleton_banebow/banebow-melee-defend-1.png` },
  },
  "units/undead/dark_adapt": {
    base: `${ASSET_BASE}/sprites/dark_adapt/adept.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/dark_adapt/adept.png`, duration: 500 }],
    // image="adept-idle-[1~11].png:[125*11]"
    idle: Array.from({ length: 11 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/dark_adapt/adept-idle-${i + 1}.png`,
      duration: 125,
    })),
    attacks: {
      // chill wave(本ゲームではid=cold_storm): start_time=-450,
      // adept:25 → magic-[1~3]:[35,75,15+300(halo分)] → magic-[2,1]:50 → adept:60。詠唱haloは省略
      cold_storm: {
        startTime: -450,
        frames: [
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept.png`, duration: 25 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-1.png`, duration: 35 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-3.png`, duration: 315 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-2.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-1.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept.png`, duration: 60 },
        ],
        missile: CHILL_WAVE_MISSILE,
        // 詠唱halo: dark-magic[1~6]:50(magic-3フレームの区間に重なる)
        extraTracks: [
          {
            startTime: -315,
            anchor: "unit",
            frames: Array.from({ length: 6 }, (_, i) => ({
              image: halo_(`dark-magic-${i + 1}.png`),
              duration: 50,
            })),
          },
        ],
      },
      // shadow wave: start_time=-700(missileはSHADOW_WAVE_MISSILE参照)
      shadow_wave: {
        startTime: -700,
        frames: [
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept.png`, duration: 25 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-1.png`, duration: 35 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-3.png`, duration: 665 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-2.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept-magic-1.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/dark_adapt/adept.png`, duration: 50 },
        ],
        missile: SHADOW_WAVE_MISSILE,
        extraTracks: [
          ...SHADOW_WAVE_TRACKS,
          // 詠唱halo: dark-magic[1~6]:50(magic-3フレームの区間に重なる)
          {
            startTime: -565,
            anchor: "unit",
            frames: Array.from({ length: 6 }, (_, i) => ({
              image: halo_(`dark-magic-${i + 1}.png`),
              duration: 50,
            })),
          },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/dark_adapt/adept-defend-1.png` },
  },
  "units/undead/dark_sorcerer": {
    base: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer.png`, duration: 500 }],
    attacks: {
      staff: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-attack-staff-1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-attack-staff-2.png`, duration: 100 },
        ],
      },
      // chill wave(本ゲームではid=cold_wave): start_time=-355,
      // magic-[1,2]:75 → magic-3:350(halo分) → magic-[2,1]:50。詠唱haloは省略
      cold_wave: {
        startTime: -355,
        frames: [
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-3.png`, duration: 350 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-2.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-1.png`, duration: 50 },
        ],
        missile: CHILL_WAVE_MISSILE,
        // 詠唱halo: black-magic[1~5]:[75*4,50](magic-3フレームの区間に重なる)
        extraTracks: [
          {
            startTime: -205,
            anchor: "unit",
            frames: [
              [1, 75], [2, 75], [3, 75], [4, 75], [5, 50],
            ].map(([n, d]) => ({ image: halo_(`black-magic-${n}.png`), duration: d })),
          },
        ],
      },
      // shadow wave: start_time=-675, magic-[1,2]:75 → magic-3:350(halo分)+200 → magic-[2,1]:50
      // → base:50。詠唱haloは省略、missileはSHADOW_WAVE_MISSILE参照
      shadow_wave: {
        startTime: -675,
        frames: [
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-3.png`, duration: 550 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-2.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-magic-1.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer.png`, duration: 50 },
        ],
        missile: SHADOW_WAVE_MISSILE,
        extraTracks: [
          ...SHADOW_WAVE_TRACKS,
          // 詠唱halo(magic-3フレームの区間に重なる)
          {
            startTime: -525,
            anchor: "unit",
            frames: [
              [1, 75], [2, 75], [3, 75], [4, 75], [5, 50],
            ].map(([n, d]) => ({ image: halo_(`black-magic-${n}.png`), duration: d })),
          },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/dark_sorcerer/dark-sorcerer-defend.png` },
  },
  "units/undead/lich": {
    base: `${ASSET_BASE}/sprites/lich/lich.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/lich/lich.png`, duration: 500 }],
    // image="[lich,lich-idle-1,lich,lich-idle-2,...].png" duration=2310 (21フレーム→各110ms)
    idle: ["", "-idle-1", "", "-idle-2", "", "-idle-2", "", "-idle-3", "", "-idle-3", "",
           "-idle-3", "", "-idle-2", "", "-idle-1", "", "-idle-2", "", "-idle-2", ""].map((s) => ({
      image: `${ASSET_BASE}/sprites/lich/lich${s}.png`,
      duration: 110,
    })),
    attacks: {
      staff: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/lich/lich-melee-1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/lich/lich-melee-2.png`, duration: 100 },
        ],
      },
      // chill tempest(本ゲームではid=cold_wave): start_time=-355,
      // lich-magic-[1,2]:75 → magic-3:350(halo分) → magic-[2,1]:50。
      // 本家missileは氷弾2本が螺旋を描いて飛ぶが、1本(60pxスケール・滞留320ms)に簡略化
      cold_wave: {
        startTime: -355,
        frames: [
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-3.png`, duration: 350 },
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-2.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-1.png`, duration: 50 },
        ],
        missile: {
          startTime: -120,
          duration: 560,
          size: 60, // 本家は~SCALE(60,60)
          rotate: true,
          frames: Array.from({ length: 7 }, (_, i) => ({
            image: `${ASSET_BASE}/sprites/projectiles/icemissile-n-${i + 1}.png`,
            duration: 80,
          })),
          offset: [
            { from: 0, to: 0.9, duration: 240 },
            { from: 0.9, to: 0.9, duration: 320 },
          ],
        },
        // 詠唱halo: black-magic[1~5]:[75*4,50](magic-3フレームの区間に重なる)
        extraTracks: [
          {
            startTime: -205,
            anchor: "unit",
            frames: [
              [1, 75], [2, 75], [3, 75], [4, 75], [5, 50],
            ].map(([n, d]) => ({ image: halo_(`black-magic-${n}.png`), duration: d })),
          },
        ],
      },
      // shadow wave: start_time=-675, lich-magic-[1,2]:75 → magic-3:350(halo分)+200
      // → magic-[2,1]:50 → base:50。詠唱haloは省略、missileはSHADOW_WAVE_MISSILE参照
      shadow_wave: {
        startTime: -675,
        frames: [
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-3.png`, duration: 550 },
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-2.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/lich/lich-magic-1.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/lich/lich.png`, duration: 50 },
        ],
        missile: SHADOW_WAVE_MISSILE,
        extraTracks: [
          ...SHADOW_WAVE_TRACKS,
          // 詠唱halo(magic-3フレームの区間に重なる)
          {
            startTime: -525,
            anchor: "unit",
            frames: [
              [1, 75], [2, 75], [3, 75], [4, 75], [5, 50],
            ].map(([n, d]) => ({ image: halo_(`black-magic-${n}.png`), duration: d })),
          },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/lich/lich-defend.png` },
  },
  "units/undead/ghoul": {
    base: `${ASSET_BASE}/sprites/ghoul/ghoul.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/ghoul/ghoul.png`, duration: 500 }],
    // image="ghoul-idle-[1~3,3*2,3~5].png:200"
    idle: [1, 2, 3, 3, 3, 3, 4, 5].map((n) => ({
      image: `${ASSET_BASE}/sprites/ghoul/ghoul-idle-${n}.png`,
      duration: 200,
    })),
    attacks: {
      claws: {
        startTime: -250,
        frames: Array.from({ length: 3 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/ghoul/ghoul-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/ghoul/ghoul-defend-1.png` },
  },
  "units/undead/necrophage": {
    base: `${ASSET_BASE}/sprites/necrophage/necrophage.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/necrophage/necrophage.png`, duration: 500 }],
    attacks: {
      claws: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/necrophage/necrophage-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/necrophage/necrophage-defend-1.png` },
  },
  "units/undead/ghost": {
    base: `${ASSET_BASE}/sprites/ghost/ghost-base.png`,
    // image="ghost-s-[2,1~3,2,1~3,...].png:250" (ループなので[2,1,2,3]と等価)
    standing: [2, 1, 2, 3].map((n) => ({
      image: `${ASSET_BASE}/sprites/ghost/ghost-s-${n}.png`,
      duration: 250,
    })),
    attacks: {
      touch: {
        startTime: -250,
        frames: Array.from({ length: 3 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/ghost/ghost-s-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
      // wail: start_time=-200, ghost-s-2:25 → s-attack-[1,2,1]:[75,150,75] → ghost-s-2:25。
      // うめき声の波({MISSILE_FRAME_WAIL})が対象へ飛ぶ
      wail: {
        startTime: -200,
        frames: [
          { image: `${ASSET_BASE}/sprites/ghost/ghost-s-2.png`, duration: 25 },
          { image: `${ASSET_BASE}/sprites/ghost/ghost-s-attack-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/ghost/ghost-s-attack-2.png`, duration: 150 },
          { image: `${ASSET_BASE}/sprites/ghost/ghost-s-attack-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/ghost/ghost-s-2.png`, duration: 25 },
        ],
        missile: WAIL_MISSILE,
      },
    },
  },
  "units/undead/wraith": {
    base: `${ASSET_BASE}/sprites/wraith/wraith-s.png`,
    // image="wraith-s-[1~4,1~4,...].png:200" (ループなので[1~4]と等価)
    standing: Array.from({ length: 4 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/wraith/wraith-s-${i + 1}.png`,
      duration: 200,
    })),
    attacks: {
      deathsword: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/wraith/wraith-s-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
      // scream: 本家のwraithは遠隔攻撃を持たない(本ゲーム独自)ため、
      // ghostのwail定義を流用したアレンジ(攻撃フレーム+うめき声の波)
      scream: {
        startTime: -200,
        frames: [
          { image: `${ASSET_BASE}/sprites/wraith/wraith-s.png`, duration: 25 },
          { image: `${ASSET_BASE}/sprites/wraith/wraith-s-attack-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/wraith/wraith-s-attack-2.png`, duration: 150 },
          { image: `${ASSET_BASE}/sprites/wraith/wraith-s-attack-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/wraith/wraith-s.png`, duration: 25 },
        ],
        missile: WAIL_MISSILE,
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/wraith/wraith-s-defend-1.png` },
  },
  "units/undead/vampire_bat": {
    base: `${ASSET_BASE}/sprites/vampire_bat/bat-se-3.png`,
    // fangs: start_time=-200, bat-se-[3,2,1,2,3,4,3,2,3](羽ばたきながら噛みつく)
    attacks: {
      fangs: {
        startTime: -200,
        frames: [
          [3, 30], [2, 30], [1, 30], [2, 30], [3, 30], [4, 70], [3, 50], [2, 50], [3, 40],
        ].map(([n, d]) => ({
          image: `${ASSET_BASE}/sprites/vampire_bat/bat-se-${n}.png`,
          duration: d,
        })),
      },
    },
    // image="bat-se-[3~1,2~5,4].png:[50,60,80,60,50,60,80,60]" (常時羽ばたき)
    standing: [
      [3, 50], [2, 60], [1, 80], [2, 60], [3, 50], [4, 60], [5, 80], [4, 60],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/vampire_bat/bat-se-${n}.png`,
      duration: d,
    })),
  },
  "units/undead/dread_bat": {
    base: `${ASSET_BASE}/sprites/dread_bat/dreadbat-se-3.png`,
    // fangs: start_time=-200, dreadbat-se-[3,2,1,2,3,4,3,2,3](羽ばたきながら噛みつく)
    attacks: {
      fangs: {
        startTime: -200,
        frames: [
          [3, 30], [2, 30], [1, 30], [2, 30], [3, 30], [4, 70], [3, 50], [2, 50], [3, 40],
        ].map(([n, d]) => ({
          image: `${ASSET_BASE}/sprites/dread_bat/dreadbat-se-${n}.png`,
          duration: d,
        })),
      },
    },
    // image="dreadbat-se-[3~1,2~5,4].png:[50,60,80,60,50,60,80,60]" (常時羽ばたき)
    standing: [
      [3, 50], [2, 60], [1, 80], [2, 60], [3, 50], [4, 60], [5, 80], [4, 60],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/dread_bat/dreadbat-se-${n}.png`,
      duration: d,
    })),
  },
  "units/undead/walking_corpse": {
    base: `${ASSET_BASE}/sprites/walking_corpse/zombie.png`,
    // image="zombie-standing-[1~7,2].png:[580,980,600,430,350*2,420,720]"
    standing: [
      [1, 580], [2, 980], [3, 600], [4, 430], [5, 350], [6, 350], [7, 420], [2, 720],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/walking_corpse/zombie-standing-${n}.png`,
      duration: d,
    })),
    attacks: {
      touch: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/walking_corpse/zombie-attack.png`, duration: 100 },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/walking_corpse/zombie-defend.png` },
  },
  // 疫病の死体フォーム(zombie_*)。本家Corpse_Walking.cfgのvariationのうち
  // drake/saurian/swimmer/troll/wolf/wose の6種は単純ループ(基本形の1枚絵を
  // {BASE_NAME}.png:150で回すだけ。本家CFGの[standing_anim]で除外リストに
  // 入っている=専用のstanding連番を持たないため)。攻撃・防御も基本形と同じ
  // 単一フレームパターン(walking_corpseの流儀に合わせる)
  "units/undead/zombie_drake": {
    base: `${ASSET_BASE}/sprites/zombie_drake/zombie-drake.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/zombie_drake/zombie-drake.png`, duration: 150 }],
    attacks: {
      touch: {
        startTime: -250,
        frames: [{ image: `${ASSET_BASE}/sprites/zombie_drake/zombie-drake-attack.png`, duration: 100 }],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/zombie_drake/zombie-drake-defend.png` },
  },
  "units/undead/zombie_saurian": {
    base: `${ASSET_BASE}/sprites/zombie_saurian/zombie-saurian.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/zombie_saurian/zombie-saurian.png`, duration: 150 }],
    attacks: {
      touch: {
        startTime: -250,
        frames: [{ image: `${ASSET_BASE}/sprites/zombie_saurian/zombie-saurian-attack.png`, duration: 100 }],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/zombie_saurian/zombie-saurian-defend.png` },
  },
  "units/undead/zombie_swimmer": {
    base: `${ASSET_BASE}/sprites/zombie_swimmer/zombie-swimmer.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/zombie_swimmer/zombie-swimmer.png`, duration: 150 }],
    attacks: {
      touch: {
        startTime: -250,
        frames: [{ image: `${ASSET_BASE}/sprites/zombie_swimmer/zombie-swimmer-attack.png`, duration: 100 }],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/zombie_swimmer/zombie-swimmer-defend.png` },
  },
  "units/undead/zombie_troll": {
    base: `${ASSET_BASE}/sprites/zombie_troll/zombie-troll.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/zombie_troll/zombie-troll.png`, duration: 150 }],
    attacks: {
      touch: {
        startTime: -250,
        frames: [{ image: `${ASSET_BASE}/sprites/zombie_troll/zombie-troll-attack.png`, duration: 100 }],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/zombie_troll/zombie-troll-defend.png` },
  },
  "units/undead/zombie_wolf": {
    base: `${ASSET_BASE}/sprites/zombie_wolf/zombie-wolf.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/zombie_wolf/zombie-wolf.png`, duration: 150 }],
    attacks: {
      touch: {
        startTime: -250,
        frames: [{ image: `${ASSET_BASE}/sprites/zombie_wolf/zombie-wolf-attack.png`, duration: 100 }],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/zombie_wolf/zombie-wolf-defend.png` },
  },
  "units/undead/zombie_wose": {
    base: `${ASSET_BASE}/sprites/zombie_wose/zombie-wose.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/zombie_wose/zombie-wose.png`, duration: 150 }],
    attacks: {
      touch: {
        startTime: -250,
        frames: [{ image: `${ASSET_BASE}/sprites/zombie_wose/zombie-wose-attack.png`, duration: 100 }],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/zombie_wose/zombie-wose-defend.png` },
  },
  // mountedのみ本家で基本形と同じ7フレームstandingを持つ(CFGの除外リストに"mounted"だけ入っていない)
  "units/undead/zombie_mounted": {
    base: `${ASSET_BASE}/sprites/zombie_mounted/zombie-mounted.png`,
    // image="zombie-mounted-standing-[1~7,2].png:[580,980,600,430,350*2,420,720]"(基本形と同じ配分)
    standing: [
      [1, 580], [2, 980], [3, 600], [4, 430], [5, 350], [6, 350], [7, 420], [2, 720],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/zombie_mounted/zombie-mounted-standing-${n}.png`,
      duration: d,
    })),
    attacks: {
      touch: {
        startTime: -250,
        frames: [{ image: `${ASSET_BASE}/sprites/zombie_mounted/zombie-mounted-attack.png`, duration: 100 }],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/zombie_mounted/zombie-mounted-defend.png` },
  },
  // batのみ攻撃・防御専用の静止画を持たず、vampire_bat/dread_batと同じ羽ばたきse-[1~5]で
  // standing・attackとも表現する(本家CFGがbat variationの[attack_anim]/[defend]を
  // まるごと上書きしてこの流儀にしているため)
  "units/undead/zombie_bat": {
    base: `${ASSET_BASE}/sprites/zombie_bat/zombie-bat-se-3.png`,
    attacks: {
      touch: {
        startTime: -200,
        frames: [
          [3, 30], [2, 30], [1, 30], [2, 30], [3, 30], [4, 70], [3, 50], [2, 50], [3, 40],
        ].map(([n, d]) => ({
          image: `${ASSET_BASE}/sprites/zombie_bat/zombie-bat-se-${n}.png`,
          duration: d,
        })),
      },
    },
    standing: [
      [3, 50], [2, 60], [1, 80], [2, 60], [3, 50], [4, 60], [5, 80], [4, 60],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/zombie_bat/zombie-bat-se-${n}.png`,
      duration: d,
    })),
  },
  "units/undead/soulness": {
    base: `${ASSET_BASE}/sprites/soulness/soulless.png`,
    // image="soulless-standing-[1~7,2].png:[1900,980,600,530,450,780,420,720]"
    standing: [
      [1, 1900], [2, 980], [3, 600], [4, 530], [5, 450], [6, 780], [7, 420], [2, 720],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/soulness/soulless-standing-${n}.png`,
      duration: d,
    })),
    attacks: {
      touch: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/soulness/soulless-attack.png`, duration: 100 },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/soulness/soulless-defend.png` },
  },
};
