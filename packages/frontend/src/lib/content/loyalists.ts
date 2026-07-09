// 忠誠軍のスプライト定義(コンテンツ)。
// WML転記元は各エントリーのコメント参照。追加手順は docs/sprite_guide.md
import type { UnitSpriteDef } from "../anim/model";
import { spearman, bowman_, cavalryman_, fencer_, heavyInf, lieu, swordsman_, whiteMage, pikeman_, longbow, shocktpr, dragoon_, lancer_, duelist_, horseman_, mage_, halo_, mermanT_, merman_, projectile, MAGIC_MISSILE_ORB } from "./shared";

export const SPRITES: Record<string, UnitSpriteDef> = {
  "units/loyalists/spearman": {
    base: spearman("spearman.png"),
    // image="spearman-stand-s-[1~7,6,7~2].png:200"(Loyalist_Spearman.cfg)
    standing: [1, 2, 3, 4, 5, 6, 7, 6, 7, 6, 5, 4, 3, 2].map((i) => ({
      image: spearman(`spearman-stand-s-${i}.png`),
      duration: 200,
    })),
    // image="spearman-idle[1~4,3,2].png:[100*3,400,100*2]"
    idle: (
      [
        [1, 100],
        [2, 100],
        [3, 100],
        [4, 400],
        [3, 100],
        [2, 100],
      ] as const
    ).map(([i, d]) => ({ image: spearman(`spearman-idle${i}.png`), duration: d })),
    // キーはUnitDef.attacks[].id(英語の安定キー。data/factions側で定義)と完全一致させること。
    // 表示名(name。日本語)ではない — nameは表示専用でありローカライズ対象になりうるため、
    // アニメ選択の識別子としては使わない
    attacks: {
      // [attack_anim] direction=s(近接・spear): start_time=-325 / offset="0:180,0~0.5:145,0.5~0:200"
      // frames: se-1:100 → s-[2,3]:[100,75] → s-3~BLIT(swoosh-s):50 → s-[3,2]:[50,150]
      spear: {
        startTime: -325,
        offset: [
          { from: 0, to: 0, duration: 180 },
          { from: 0, to: 0.5, duration: 145 },
          { from: 0.5, to: 0, duration: 200 },
        ],
        frames: [
          { image: spearman("spearman-attack-se-1.png"), duration: 100 },
          { image: spearman("spearman-attack-s-2.png"), duration: 100 },
          { image: spearman("spearman-attack-s-3.png"), duration: 75 },
          {
            image: spearman("spearman-attack-s-3.png"),
            duration: 50,
            overlay: spearman("spearman-swoosh-s.png"),
          },
          { image: spearman("spearman-attack-s-3.png"), duration: 50 },
          { image: spearman("spearman-attack-s-2.png"), duration: 150 },
        ],
      },
      // [attack_anim] filter_attack name=javelin(遠隔): start_time=-250、offsetなし(踏み込まない)。
      // frames: ranged1:100 → ranged2:50(投擲音) → ranged2:50 → ranged3:100
      // missile_start_time=-150、duration=150(投げてから命中=t=0まで飛翔)
      javelin: {
        startTime: -250,
        frames: [
          { image: spearman("spearman-attack-ranged1.png"), duration: 100 },
          { image: spearman("spearman-attack-ranged2.png"), duration: 50 },
          { image: spearman("spearman-attack-ranged2.png"), duration: 50 },
          { image: spearman("spearman-attack-ranged3.png"), duration: 100 },
        ],
        missile: {
          startTime: -150,
          duration: 150,
          image: projectile("spear-n.png"),
        },
      },
    },
    // {DEFENSE_ANIM_FILTERED "spearman-defend-2.png" ...} の被弾リアクション
    defend: { reaction: spearman("spearman-defend-2.png") },
  },

  "units/loyalists/bowman": {
    base: bowman_("bowman.png"),
    standing: [{ image: bowman_("bowman.png"), duration: 500 }],
    attacks: {
      // bow: start_time=-445, bowman-bow.png:65 → bow-attack-[1~4,1]:[75,75,100,130,65], missile -150/150
      bow: {
        startTime: -445,
        frames: [
          { image: bowman_("bowman-bow.png"), duration: 65 },
          { image: bowman_("bowman-bow-attack-1.png"), duration: 75 },
          { image: bowman_("bowman-bow-attack-2.png"), duration: 75 },
          { image: bowman_("bowman-bow-attack-3.png"), duration: 100 },
          { image: bowman_("bowman-bow-attack-4.png"), duration: 130 },
          { image: bowman_("bowman-bow-attack-1.png"), duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: projectile("missile-n.png") },
      },
      // short_sword(id=dagger): start_time=-275, melee-defend-1:50 → melee-attack-[1~4]:100 → melee-defend-1:50
      dagger: {
        startTime: -275,
        frames: [
          { image: bowman_("bowman-melee-defend-1.png"), duration: 50 },
          { image: bowman_("bowman-melee-attack-1.png"), duration: 100 },
          { image: bowman_("bowman-melee-attack-2.png"), duration: 100 },
          { image: bowman_("bowman-melee-attack-3.png"), duration: 100 },
          { image: bowman_("bowman-melee-attack-4.png"), duration: 100 },
          { image: bowman_("bowman-melee-defend-1.png"), duration: 50 },
        ],
      },
    },
    defend: { reaction: bowman_("bowman-bow-defend.png") },
  },

  "units/loyalists/cavalryman": {
    base: cavalryman_("cavalryman.png"),
    // cavalryman.png:250 → breeze[1~3,2,1]:250 (Loyalist_Cavalryman.cfg [standing_anim])
    standing: [
      { image: cavalryman_("cavalryman.png"),       duration: 250 },
      { image: cavalryman_("cavalryman-breeze1.png"), duration: 250 },
      { image: cavalryman_("cavalryman-breeze2.png"), duration: 250 },
      { image: cavalryman_("cavalryman-breeze3.png"), duration: 250 },
      { image: cavalryman_("cavalryman-breeze2.png"), duration: 250 },
      { image: cavalryman_("cavalryman-breeze1.png"), duration: 250 },
    ],
    // bob[1~3,2,1]:[350,250,550,650,700] ([idle_anim])
    idle: [
      { image: cavalryman_("cavalryman-bob1.png"), duration: 350 },
      { image: cavalryman_("cavalryman-bob2.png"), duration: 250 },
      { image: cavalryman_("cavalryman-bob3.png"), duration: 550 },
      { image: cavalryman_("cavalryman-bob2.png"), duration: 650 },
      { image: cavalryman_("cavalryman-bob1.png"), duration: 700 },
    ],
    attacks: {
      // sword: start_time=-350, offset=0~-0.05:200,-0.05~0.6:150,0.6~0:325
      // attack1:80, attack[2~6]:[70,100,100,150,150], cavalryman.png:25
      sword: {
        startTime: -350,
        offset: [
          { from: 0,     to: -0.05, duration: 200 },
          { from: -0.05, to:  0.6,  duration: 150 },
          { from:  0.6,  to:  0,    duration: 325 },
        ],
        frames: [
          { image: cavalryman_("cavalryman-attack1.png"), duration: 80 },
          { image: cavalryman_("cavalryman-attack2.png"), duration: 70 },
          { image: cavalryman_("cavalryman-attack3.png"), duration: 100 },
          { image: cavalryman_("cavalryman-attack4.png"), duration: 100 },
          { image: cavalryman_("cavalryman-attack5.png"), duration: 150 },
          { image: cavalryman_("cavalryman-attack6.png"), duration: 150 },
          { image: cavalryman_("cavalryman.png"),         duration: 25 },
        ],
      },
    },
    defend: { reaction: cavalryman_("cavalryman-defend2.png") },
  },

  "units/loyalists/fencer": {
    base: fencer_("fencer.png"),
    // fencer-stand-[1~8]:[200,80*6,200] ([standing_anim])
    standing: [
      { image: fencer_("fencer-stand-1.png"), duration: 200 },
      ...Array.from({ length: 6 }, (_, i) => ({ image: fencer_(`fencer-stand-${i + 2}.png`), duration: 80 })),
      { image: fencer_("fencer-stand-8.png"), duration: 200 },
    ],
    // fencer-idle-[1~7,6~1]:100 ([idle_anim])
    idle: [1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1].map((i) => ({
      image: fencer_(`fencer-idle-${i}.png`),
      duration: 100,
    })),
    attacks: {
      // saber: start_time=-350, fencer-attack-[1~9,1]:50, offset per frame(50ms×10)
      saber: {
        startTime: -350,
        offset: [
          { from:  0,    to: -0.07, duration: 50 },
          { from: -0.07, to: -0.15, duration: 50 },
          { from: -0.15, to: -0.25, duration: 50 },
          { from: -0.25, to: -0.2,  duration: 50 },
          { from: -0.2,  to: -0.1,  duration: 50 },
          { from: -0.1,  to:  0.25, duration: 50 },
          { from:  0.25, to:  0.55, duration: 50 },
          { from:  0.55, to:  0.25, duration: 50 },
          { from:  0.25, to:  0.1,  duration: 50 },
          { from:  0.1,  to:  0,    duration: 50 },
        ],
        frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 1].map((i) => ({
          image: fencer_(`fencer-attack-${i}.png`),
          duration: 50,
        })),
      },
    },
    defend: { reaction: fencer_("fencer-defend-1-1.png") },
  },

  "units/loyalists/heavy_infantryman": {
    base: heavyInf("heavyinfantry.png"),
    standing: [{ image: heavyInf("heavyinfantry.png"), duration: 500 }],
    attacks: {
      // mace(flail in WML): start_time=-550, offset=0(踏み込みなし)
      // attack-[1~15]:[70*5,50*4,100,75,50*4], heavyinfantry.png:100
      mace: {
        startTime: -550,
        frames: [
          ...[70, 70, 70, 70, 70, 50, 50, 50, 50, 100, 75, 50, 50, 50, 50].map((d, i) => ({
            image: heavyInf(`heavyinfantry-attack-${i + 1}.png`),
            duration: d,
          })),
          { image: heavyInf("heavyinfantry.png"), duration: 100 },
        ],
      },
    },
    defend: { reaction: heavyInf("heavyinfantry-defend-2.png") },
  },

  "units/loyalists/lieutenant": {
    base: lieu("lieutenant.png"),
    standing: [{ image: lieu("lieutenant.png"), duration: 500 }],
    attacks: {
      // sword: start_time=-225, lieutenant.png:50, sword-[1~3]:[75,150,100]
      sword: {
        startTime: -225,
        frames: [
          { image: lieu("lieutenant.png"),                duration: 50 },
          { image: lieu("lieutenant-attack-sword-1.png"), duration: 75 },
          { image: lieu("lieutenant-attack-sword-2.png"), duration: 150 },
          { image: lieu("lieutenant-attack-sword-3.png"), duration: 100 },
        ],
      },
      // crossbow: start_time=-400, crossbow.png:100, attack[1~2]:150*2, crossbow.png:300, missile -150/150
      crossbow: {
        startTime: -400,
        frames: [
          { image: lieu("lieutenant-crossbow.png"),         duration: 100 },
          { image: lieu("lieutenant-crossbow-attack1.png"), duration: 150 },
          { image: lieu("lieutenant-crossbow-attack2.png"), duration: 150 },
          { image: lieu("lieutenant-crossbow.png"),         duration: 300 },
        ],
        missile: { startTime: -150, duration: 150, image: projectile("missile-n.png") },
      },
    },
    defend: { reaction: lieu("lieutenant-defend-2.png") },
  },

  "units/loyalists/swordsman": {
    base: swordsman_("swordsman.png"),
    standing: [{ image: swordsman_("swordsman.png"), duration: 500 }],
    // swordsman.png:900, bob-s-[1~3,2,1]:[180,120,600,250,350] ([idle_anim])
    idle: [
      { image: swordsman_("swordsman.png"),        duration: 900 },
      { image: swordsman_("swordsman-bob-s-1.png"), duration: 180 },
      { image: swordsman_("swordsman-bob-s-2.png"), duration: 120 },
      { image: swordsman_("swordsman-bob-s-3.png"), duration: 600 },
      { image: swordsman_("swordsman-bob-s-2.png"), duration: 250 },
      { image: swordsman_("swordsman-bob-s-1.png"), duration: 350 },
    ],
    attacks: {
      // sword: start_time=-600, offset=0:300,0~0.6:200,0.6:50,0.6~0:300
      // attack-se-[1~8]:100*8, swordsman.png:50
      sword: {
        startTime: -600,
        offset: [
          { from: 0,   to: 0,   duration: 300 },
          { from: 0,   to: 0.6, duration: 200 },
          { from: 0.6, to: 0.6, duration: 50  },
          { from: 0.6, to: 0,   duration: 300 },
        ],
        frames: [
          ...Array.from({ length: 8 }, (_, i) => ({
            image: swordsman_(`swordsman-attack-se-${i + 1}.png`),
            duration: 100,
          })),
          { image: swordsman_("swordsman.png"), duration: 50 },
        ],
      },
    },
    defend: { reaction: swordsman_("swordsman-defend-2.png") },
  },

  "units/loyalists/white_mage": {
    base: whiteMage("white-mage.png"),
    standing: [{ image: whiteMage("white-mage.png"), duration: 500 }],
    // white-mage-idle-[1~18]:120*18 ([idle_anim])
    idle: Array.from({ length: 18 }, (_, i) => ({
      image: whiteMage(`white-mage-idle-${i + 1}.png`),
      duration: 120,
    })),
    attacks: {
      // lightbeam(arcane ranged): start_time=-395, magic-[1,2]:75,
      // magic-3はhalo列(holy/halo[6,1,3,5,6]:[75*4,50])の350ms持続、magic-[2,1]:50。
      // 頭上の光輪はextraTracksで再現(magic-3の区間=-245msから350ms)
      lightbeam: {
        startTime: -395,
        frames: [
          { image: whiteMage("white-mage-magic-1.png"), duration: 75 },
          { image: whiteMage("white-mage-magic-2.png"), duration: 75 },
          { image: whiteMage("white-mage-magic-3.png"), duration: 350 },
          { image: whiteMage("white-mage-magic-2.png"), duration: 50 },
          { image: whiteMage("white-mage-magic-1.png"), duration: 50 },
        ],
        // {MISSILE_FRAME_LIGHT_BEAM}: 天から降りる光柱が防御側ヘックスに立つ(offset=1.0固定)
        // halo="halo/holy/light-beam-[1~7,6~1].png:[30*6,130,70*6]" start=-245
        missile: {
          startTime: -245,
          duration: 730,
          // 縦670pxの光柱画像。正方形boxにアスペクト維持で収めると
          // 輝点(高さ約47%)がほぼbox中心=防御側ユニットに重なる
          size: 200,
          offset: [{ from: 1, to: 1, duration: 730 }],
          frames: [
            [1, 30], [2, 30], [3, 30], [4, 30], [5, 30], [6, 30], [7, 130],
            [6, 70], [5, 70], [4, 70], [3, 70], [2, 70], [1, 70],
          ].map(([n, d]) => ({ image: halo_(`light-beam-${n}.png`), duration: d })),
        },
        extraTracks: [
          {
            startTime: -245,
            anchor: "unit",
            frames: [
              [6, 75], [1, 75], [3, 75], [5, 75], [6, 50],
            ].map(([n, d]) => ({ image: halo_(`holy-halo${n}.png`), duration: d })),
          },
        ],
      },
      // staff: start_time=-325, white-mage.png:25, melee-[1~6]:[100,100,150,100,100,100]
      staff: {
        startTime: -325,
        frames: [
          { image: whiteMage("white-mage.png"),          duration: 25 },
          { image: whiteMage("white-mage-melee-1.png"),  duration: 100 },
          { image: whiteMage("white-mage-melee-2.png"),  duration: 100 },
          { image: whiteMage("white-mage-melee-3.png"),  duration: 150 },
          { image: whiteMage("white-mage-melee-4.png"),  duration: 100 },
          { image: whiteMage("white-mage-melee-5.png"),  duration: 100 },
          { image: whiteMage("white-mage-melee-6.png"),  duration: 100 },
        ],
      },
    },
    defend: { reaction: whiteMage("white-mage-defend.png") },
  },

  "units/loyalists/pikeman": {
    base: pikeman_("pikeman.png"),
    standing: [{ image: pikeman_("pikeman.png"), duration: 500 }],
    attacks: {
      // spear(pike in WML): start_time=-250, se方向を使用
      // pikeman.png:100, attack-se:250, pikeman.png:75
      spear: {
        startTime: -250,
        frames: [
          { image: pikeman_("pikeman.png"),           duration: 100 },
          { image: pikeman_("pikeman-attack-se.png"), duration: 250 },
          { image: pikeman_("pikeman.png"),           duration: 75 },
        ],
      },
    },
    defend: { reaction: pikeman_("pikeman-defend.png") },
  },

  "units/loyalists/longbowman": {
    base: longbow("longbowman.png"),
    standing: [{ image: longbow("longbowman.png"), duration: 500 }],
    // idle: [1~4,3,4,3,4,3,4,1]:[1000,400,100,200,100,200,100,200,100,400,100]
    idle: [
      { image: longbow("longbowman-idle-1.png"), duration: 1000 },
      { image: longbow("longbowman-idle-2.png"), duration: 400 },
      { image: longbow("longbowman-idle-3.png"), duration: 100 },
      { image: longbow("longbowman-idle-4.png"), duration: 200 },
      { image: longbow("longbowman-idle-3.png"), duration: 100 },
      { image: longbow("longbowman-idle-4.png"), duration: 200 },
      { image: longbow("longbowman-idle-3.png"), duration: 100 },
      { image: longbow("longbowman-idle-4.png"), duration: 200 },
      { image: longbow("longbowman-idle-3.png"), duration: 100 },
      { image: longbow("longbowman-idle-4.png"), duration: 400 },
      { image: longbow("longbowman-idle-1.png"), duration: 100 },
    ],
    attacks: {
      // bow: start_time=-445, missile -150/150
      bow: {
        startTime: -445,
        frames: [
          { image: longbow("longbowman-bow.png"),            duration: 65 },
          { image: longbow("longbowman-bow-attack-1.png"),   duration: 75 },
          { image: longbow("longbowman-bow-attack-2.png"),   duration: 75 },
          { image: longbow("longbowman-bow-attack-3.png"),   duration: 100 },
          { image: longbow("longbowman-bow-attack-4.png"),   duration: 130 },
          { image: longbow("longbowman-bow-attack-1.png"),   duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: projectile("missile-n.png") },
      },
      // dagger(sword in WML): start_time=-275
      dagger: {
        startTime: -275,
        frames: [
          { image: longbow("longbowman-melee-defend-1.png"),   duration: 50 },
          { image: longbow("longbowman-melee-attack-1.png"),   duration: 100 },
          { image: longbow("longbowman-melee-attack-2.png"),   duration: 100 },
          { image: longbow("longbowman-melee-attack-3.png"),   duration: 100 },
          { image: longbow("longbowman-melee-attack-4.png"),   duration: 100 },
          { image: longbow("longbowman-melee-defend-1.png"),   duration: 50 },
        ],
      },
    },
    defend: { reaction: longbow("longbowman-bow-defend.png") },
  },

  "units/loyalists/shocktrooper": {
    base: shocktpr("shocktrooper.png"),
    standing: [{ image: shocktpr("shocktrooper.png"), duration: 500 }],
    attacks: {
      // mace(flail in WML): start_time=-260, attack-[1~6]:[85,100,125,50,50,50]
      mace: {
        startTime: -260,
        frames: [
          { image: shocktpr("shocktrooper-attack-1.png"), duration: 85 },
          { image: shocktpr("shocktrooper-attack-2.png"), duration: 100 },
          { image: shocktpr("shocktrooper-attack-3.png"), duration: 125 },
          { image: shocktpr("shocktrooper-attack-4.png"), duration: 50 },
          { image: shocktpr("shocktrooper-attack-5.png"), duration: 50 },
          { image: shocktpr("shocktrooper-attack-6.png"), duration: 50 },
        ],
      },
    },
    defend: { reaction: shocktpr("shocktrooper-defend-2.png") },
  },

  "units/loyalists/dragoon": {
    base: dragoon_("dragoon.png"),
    standing: [{ image: dragoon_("dragoon.png"), duration: 250 }],
    // dragoon.png:550, bob[1~3,2,1]:[350,400,400,650,700] ([idle_anim])
    idle: [
      { image: dragoon_("dragoon.png"),       duration: 550 },
      { image: dragoon_("dragoon-bob1.png"),  duration: 350 },
      { image: dragoon_("dragoon-bob2.png"),  duration: 400 },
      { image: dragoon_("dragoon-bob3.png"),  duration: 400 },
      { image: dragoon_("dragoon-bob2.png"),  duration: 650 },
      { image: dragoon_("dragoon-bob1.png"),  duration: 700 },
    ],
    attacks: {
      // crossbow: start_time=-700, xbow-[1~4,2~1]:[130,130,440,100,160,160], missile -150/150
      crossbow: {
        startTime: -700,
        frames: [
          { image: dragoon_("dragoon-xbow-1.png"), duration: 130 },
          { image: dragoon_("dragoon-xbow-2.png"), duration: 130 },
          { image: dragoon_("dragoon-xbow-3.png"), duration: 440 },
          { image: dragoon_("dragoon-xbow-4.png"), duration: 100 },
          { image: dragoon_("dragoon-xbow-2.png"), duration: 160 },
          { image: dragoon_("dragoon-xbow-1.png"), duration: 160 },
        ],
        missile: { startTime: -150, duration: 150, image: projectile("missile-n.png") },
      },
      // sword: start_time=-400, offset=0~-0.05:190,-0.05~0.7:210,0.7~0:340
      // melee[1~4]:70*4, melee[5~8]:[70,70,130,110], dragoon.png:80
      sword: {
        startTime: -400,
        offset: [
          { from:  0,    to: -0.05, duration: 190 },
          { from: -0.05, to:  0.7,  duration: 210 },
          { from:  0.7,  to:  0,    duration: 340 },
        ],
        frames: [
          ...Array.from({ length: 6 }, (_, i) => ({ image: dragoon_(`dragoon-melee${i + 1}.png`), duration: 70 })),
          { image: dragoon_("dragoon-melee7.png"), duration: 130 },
          { image: dragoon_("dragoon-melee8.png"), duration: 110 },
          { image: dragoon_("dragoon.png"),        duration: 80 },
        ],
      },
    },
    defend: { reaction: dragoon_("dragoon-defend2.png") },
  },

  "units/loyalists/lancer": {
    base: lancer_("lancer.png"),
    // breeze-[1~4,2,5]:[200,300,300,300,200,200] ([standing_anim])
    standing: [
      { image: lancer_("lancer-breeze-1.png"), duration: 200 },
      { image: lancer_("lancer-breeze-2.png"), duration: 300 },
      { image: lancer_("lancer-breeze-3.png"), duration: 300 },
      { image: lancer_("lancer-breeze-4.png"), duration: 300 },
      { image: lancer_("lancer-breeze-2.png"), duration: 200 },
      { image: lancer_("lancer-breeze-5.png"), duration: 200 },
    ],
    attacks: {
      // lance: start_time=-250, charge突撃(offset近似)
      // lancer-se-attack1:25 → attack1:[75,300,50,25]
      lance: {
        startTime: -250,
        offset: [
          { from: 0,   to: 0.5, duration: 250 },
          { from: 0.5, to: 0,   duration: 225 },
        ],
        frames: [25, 75, 300, 50, 25].map((d) => ({
          image: lancer_("lancer-se-attack1.png"),
          duration: d,
        })),
      },
      // charged_saber: cuirassier(同spriteKey)の攻撃id。専用フレームが無いためlanceと同一
      charged_saber: {
        startTime: -250,
        offset: [
          { from: 0,   to: 0.5, duration: 250 },
          { from: 0.5, to: 0,   duration: 225 },
        ],
        frames: [25, 75, 300, 50, 25].map((d) => ({
          image: lancer_("lancer-se-attack1.png"),
          duration: d,
        })),
      },
    },
    defend: { reaction: lancer_("lancer-se-defend1.png") },
  },

  "units/loyalists/duelist": {
    base: duelist_("duelist.png"),
    standing: [{ image: duelist_("duelist.png"), duration: 500 }],
    attacks: {
      // saber: start_time=-250, duelist.png:100, duelist-attack:200, duelist.png:100
      saber: {
        startTime: -250,
        frames: [
          { image: duelist_("duelist.png"),        duration: 100 },
          { image: duelist_("duelist-attack.png"), duration: 200 },
          { image: duelist_("duelist.png"),        duration: 100 },
        ],
      },
      // crossbow: start_time=-350, duelist-ranged:400, missile -150/150
      crossbow: {
        startTime: -350,
        frames: [{ image: duelist_("duelist-ranged.png"), duration: 400 }],
        missile: { startTime: -150, duration: 150, image: projectile("missile-n.png") },
      },
    },
    defend: { reaction: duelist_("duelist-defend.png") },
  },

  "units/loyalists/horseman": {
    base: horseman_("horseman.png"),
    // horseman-breeze-[1~4,2,5]:[200,300,300,300,200,200] (se方向)
    standing: [
      { image: horseman_("horseman-breeze-1.png"), duration: 200 },
      { image: horseman_("horseman-breeze-2.png"), duration: 300 },
      { image: horseman_("horseman-breeze-3.png"), duration: 300 },
      { image: horseman_("horseman-breeze-4.png"), duration: 300 },
      { image: horseman_("horseman-breeze-2.png"), duration: 200 },
      { image: horseman_("horseman-breeze-5.png"), duration: 200 },
    ],
    attacks: {
      // lance: start_time=-400, offset=0~0.3:300,0.3~0.45:210,0.45~0:420
      // horseman-se-attack[1~12]:[100*3,70*9]
      lance: {
        startTime: -400,
        offset: [
          { from: 0,    to: 0.3,  duration: 300 },
          { from: 0.3,  to: 0.45, duration: 210 },
          { from: 0.45, to: 0,    duration: 420 },
        ],
        frames: [
          ...Array.from({ length: 3 }, (_, i) => ({ image: horseman_(`horseman-se-attack${i + 1}.png`), duration: 100 })),
          ...Array.from({ length: 9 }, (_, i) => ({ image: horseman_(`horseman-se-attack${i + 4}.png`), duration: 70 })),
        ],
      },
    },
    defend: { reaction: horseman_("horseman-se-defend1.png") },
  },

  "units/loyalists/mage": {
    base: mage_("mage.png"),
    standing: [{ image: mage_("mage.png"), duration: 500 }],
    // mage-idle-[1~4,4*2,4~1]:150*10 ([idle_anim])
    idle: [1, 2, 3, 4, 4, 4, 4, 3, 2, 1].map((i) => ({
      image: mage_(`mage-idle-${i}.png`),
      duration: 150,
    })),
    attacks: {
      // magic_missile(missile in WML): start_time=-800, offset=0
      // magic[1,2,1]:[100,700,200]
      magic_missile: {
        startTime: -800,
        frames: [
          { image: mage_("mage-attack-magic1.png"), duration: 100 },
          { image: mage_("mage-attack-magic2.png"), duration: 700 },
          { image: mage_("mage-attack-magic1.png"), duration: 200 },
        ],
        // {MAGIC_MISSILE 11 -20}: 共通の光球(定義はMAGIC_MISSILE_ORB参照)
        missile: MAGIC_MISSILE_ORB,
        // {MAGIC_MISSILE_STAFF_FLARE -750 600 11 -20}: 詠唱中の杖先フレア
        extraTracks: [
          {
            startTime: -750,
            anchor: "unit",
            offsetX: [{ from: 11, to: 11, duration: 600 }],
            offsetY: [{ from: -20, to: -20, duration: 600 }],
            frames: Array.from({ length: 7 }, (_, i) => ({
              image: halo_(`mage-preparation-halo${i + 1}.png`),
              duration: i < 6 ? 86 : 84, // 600ms / 7フレーム
            })),
          },
        ],
      },
      // staff: start_time=-250, mage.png:50, staff[1~2]:[100,200], magic1:50, mage.png:50
      staff: {
        startTime: -250,
        frames: [
          { image: mage_("mage.png"),               duration: 50 },
          { image: mage_("mage-attack-staff1.png"), duration: 100 },
          { image: mage_("mage-attack-staff2.png"), duration: 200 },
          { image: mage_("mage-attack-magic1.png"), duration: 50 },
          { image: mage_("mage.png"),               duration: 50 },
        ],
      },
    },
    defend: { reaction: mage_("mage-defend.png") },
  },

  "units/loyalists/merman_triton": {
    base: mermanT_("triton.png"),
    standing: [{ image: mermanT_("triton.png"), duration: 500 }],
    attacks: {
      // trident: start_time=-200, base画像のみ(専用フレームなし)
      // triton.png:[75,175,100]
      trident: {
        startTime: -200,
        frames: [
          { image: mermanT_("triton.png"), duration: 75 },
          { image: mermanT_("triton.png"), duration: 175 },
          { image: mermanT_("triton.png"), duration: 100 },
        ],
      },
      // sword: 上位データ(merman_triton)の第2近接。専用フレームが無いためtridentと同一
      sword: {
        startTime: -200,
        frames: [
          { image: mermanT_("triton.png"), duration: 75 },
          { image: mermanT_("triton.png"), duration: 175 },
          { image: mermanT_("triton.png"), duration: 100 },
        ],
      },
    },
    defend: { reaction: mermanT_("triton-defend2.png") },
  },

  "units/loyalists/merman": {
    base: merman_("warrior.png"),
    standing: [{ image: merman_("warrior.png"), duration: 500 }],
    attacks: {
      // trident: start_time=-450, offset=0~0.3,0.3~0 (9フレーム×100ms=900ms)
      // warrior-attack-[1~9]:100 (Merfolk_Warrior.cfg)
      trident: {
        startTime: -450,
        offset: [
          { from: 0,   to: 0.3, duration: 450 },
          { from: 0.3, to: 0,   duration: 450 },
        ],
        frames: Array.from({ length: 9 }, (_, i) => ({
          image: merman_(`warrior-attack-${i + 1}.png`),
          duration: 100,
        })),
      },
    },
    defend: { reaction: merman_("warrior-defend-2.png") },
  },

};
