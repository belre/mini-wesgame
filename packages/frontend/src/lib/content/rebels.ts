// 反乱軍陣営(エルフ・ウーズ・マーフォーク)のスプライト定義(コンテンツ)。
// WML転記元は各エントリーのコメント参照。追加手順は docs/sprite_guide.md
import type { UnitSpriteDef } from "../anim/model";
import { ASSET_BASE } from "./shared";

export const SPRITES: Record<string, UnitSpriteDef> = {
  "units/rebels/elvish_fighter": {
    base: `${ASSET_BASE}/sprites/elvish_fighter/fighter.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_fighter/fighter.png`, duration: 500 }],
    // image="fighter-idle-[1~6,5~10,9,11,12].png:[100*2,125,150,175,200*2,400,175,200,250,400,150*3]"
    // (本家cfgではコメントアウトされているがフレームは存在するため採用)
    idle: [
      [1, 100], [2, 100], [3, 125], [4, 150], [5, 175], [6, 200],
      [5, 200], [6, 400], [7, 175], [8, 200], [9, 250], [10, 400],
      [9, 150], [11, 150], [12, 150],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/elvish_fighter/fighter-idle-${n}.png`,
      duration: d,
    })),
    attacks: {
      sword: {
        startTime: -300,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/elvish_fighter/fighter-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      // bow: start_time=-445, fighter-bow:65 → bow-attack[1~4]:[75*2,100,130] → fighter-bow:65
      bow: {
        startTime: -445,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_fighter/fighter-bow.png`, duration: 65 },
          { image: `${ASSET_BASE}/sprites/elvish_fighter/fighter-bow-attack1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_fighter/fighter-bow-attack2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_fighter/fighter-bow-attack3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_fighter/fighter-bow-attack4.png`, duration: 130 },
          { image: `${ASSET_BASE}/sprites/elvish_fighter/fighter-bow.png`, duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_fighter/fighter-defend.png` },
  },
  "units/rebels/elvish_archer": {
    base: `${ASSET_BASE}/sprites/elvish_archer/archer.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_archer/archer.png`, duration: 500 }],
    // image="archer-idle-[1~6,3~6,3~6,2,1].png:100"
    idle: [1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 3, 4, 5, 6, 2, 1].map((n) => ({
      image: `${ASSET_BASE}/sprites/elvish_archer/archer-idle-${n}.png`,
      duration: 100,
    })),
    attacks: {
      sword: {
        startTime: -300,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/elvish_archer/archer-sword-${i + 1}.png`,
          duration: 100,
        })),
      },
      // bow: start_time=-445, archer-bow:65 → bow-attack[1~4]:[75*2,100,130] → archer-bow:65
      bow: {
        startTime: -445,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_archer/archer-bow.png`, duration: 65 },
          { image: `${ASSET_BASE}/sprites/elvish_archer/archer-bow-attack1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_archer/archer-bow-attack2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_archer/archer-bow-attack3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_archer/archer-bow-attack4.png`, duration: 130 },
          { image: `${ASSET_BASE}/sprites/elvish_archer/archer-bow.png`, duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_archer/archer-sword-defend.png` },
  },
  "units/rebels/elvish_scout": {
    base: `${ASSET_BASE}/sprites/elvish_scout/scout.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_scout/scout.png`, duration: 500 }],
    attacks: {
      sword: {
        startTime: -300,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/elvish_scout/scout-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      // bow: start_time=-400, scout-bow:60 → bow-attack[1~4]:[60,60,70,180] → scout-bow:80
      bow: {
        startTime: -400,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_scout/scout-bow.png`, duration: 60 },
          { image: `${ASSET_BASE}/sprites/elvish_scout/scout-bow-attack1.png`, duration: 60 },
          { image: `${ASSET_BASE}/sprites/elvish_scout/scout-bow-attack2.png`, duration: 60 },
          { image: `${ASSET_BASE}/sprites/elvish_scout/scout-bow-attack3.png`, duration: 70 },
          { image: `${ASSET_BASE}/sprites/elvish_scout/scout-bow-attack4.png`, duration: 180 },
          { image: `${ASSET_BASE}/sprites/elvish_scout/scout-bow.png`, duration: 80 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_scout/scout-defend1.png` },
  },
  "units/rebels/elvish_outrider": {
    base: `${ASSET_BASE}/sprites/elvish_outrider/outrider.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_outrider/outrider.png`, duration: 500 }],
    attacks: {
      sword: {
        startTime: -300,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider-melee-0.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider-melee-1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider-melee-2.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider-melee-3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider-melee-4.png`, duration: 100 },
        ],
      },
      // bow: start_time=-500, outrider.png:[100,250,100,100](本家に弓専用フレームなし)
      bow: {
        startTime: -500,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider.png`, duration: 250 },
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_outrider/outrider.png`, duration: 100 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_outrider/outrider-defend1.png` },
  },
  "units/rebels/elvish_captain": {
    base: `${ASSET_BASE}/sprites/elvish_captain/captain.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_captain/captain.png`, duration: 500 }],
    attacks: {
      sword: {
        startTime: -300,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_captain/captain-melee-1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_captain/captain-melee-2.png`, duration: 100 },
        ],
      },
      // bow: start_time=-445, captain-bow:65 → bow-attack[1~4]:[75*2,100,130] → captain-bow:65
      bow: {
        startTime: -445,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_captain/captain-bow.png`, duration: 65 },
          { image: `${ASSET_BASE}/sprites/elvish_captain/captain-bow-attack1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_captain/captain-bow-attack2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_captain/captain-bow-attack3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_captain/captain-bow-attack4.png`, duration: 130 },
          { image: `${ASSET_BASE}/sprites/elvish_captain/captain-bow.png`, duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_captain/captain-defend.png` },
  },
  "units/rebels/elvish_hero": {
    base: `${ASSET_BASE}/sprites/elvish_hero/hero.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_hero/hero.png`, duration: 500 }],
    // image="hero-idle-[1~4,4,4,4,4,4~11,10,9,8,7,6,5,4,4,4,4,4,4,3,2,1].png:275"
    idle: [
      1, 2, 3, 4, 4, 4, 4, 4, 4, 5, 6, 7, 8, 9, 10, 11,
      10, 9, 8, 7, 6, 5, 4, 4, 4, 4, 4, 4, 3, 2, 1,
    ].map((n) => ({
      image: `${ASSET_BASE}/sprites/elvish_hero/hero-idle-${n}.png`,
      duration: 275,
    })),
    attacks: {
      sword: {
        startTime: -300,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/elvish_hero/hero-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      // bow: start_time=-445, hero-bow:65 → bow-attack[1~4]:[75*2,100,130] → hero-bow:65
      bow: {
        startTime: -445,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_hero/hero-bow.png`, duration: 65 },
          { image: `${ASSET_BASE}/sprites/elvish_hero/hero-bow-attack1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_hero/hero-bow-attack2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_hero/hero-bow-attack3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_hero/hero-bow-attack4.png`, duration: 130 },
          { image: `${ASSET_BASE}/sprites/elvish_hero/hero-bow.png`, duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_hero/hero-defend.png` },
  },
  "units/rebels/elvish_marksman": {
    base: `${ASSET_BASE}/sprites/elvish_marksman/marksman.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_marksman/marksman.png`, duration: 500 }],
    attacks: {
      sword: {
        startTime: -300,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-sword-1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-sword-2.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-sword-3.png`, duration: 100 },
        ],
      },
      // bow(WML名はlongbow): start_time=-475, marksman-bow:75 → bow-attack[1~4]:[75*2,100,150] → marksman-bow:75
      bow: {
        startTime: -475,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-bow.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-bow-attack1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-bow-attack2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-bow-attack3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-bow-attack4.png`, duration: 150 },
          { image: `${ASSET_BASE}/sprites/elvish_marksman/marksman-bow.png`, duration: 75 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_marksman/marksman-sword-defend.png` },
  },
  "units/rebels/elvish_shaman": {
    base: `${ASSET_BASE}/sprites/elvish_shaman/shaman.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_shaman/shaman.png`, duration: 500 }],
    // image="shaman-idle-[1~6,6,5,4,3].png:200"
    idle: [1, 2, 3, 4, 5, 6, 6, 5, 4, 3].map((n) => ({
      image: `${ASSET_BASE}/sprites/elvish_shaman/shaman-idle-${n}.png`,
      duration: 200,
    })),
    attacks: {
      staff: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_shaman/shaman-attack.png`,  duration: 100 },
          { image: `${ASSET_BASE}/sprites/elvish_shaman/shaman-attack2.png`, duration: 100 },
        ],
      },
      // entangle: start_time=-450, shaman.png:225→attack2:225→shaman.png:[100,50]。
      // 蔦(projectiles/entangle)は対象ヘックス上に出現(offset=1.0固定)。詠唱haloは多層合成のため省略
      entangle: {
        startTime: -450,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_shaman/shaman.png`, duration: 225 },
          { image: `${ASSET_BASE}/sprites/elvish_shaman/shaman-attack2.png`, duration: 225 },
          { image: `${ASSET_BASE}/sprites/elvish_shaman/shaman.png`, duration: 150 },
        ],
        missile: {
          startTime: -200,
          duration: 150,
          image: `${ASSET_BASE}/sprites/projectiles/entangle.png`,
          offset: [{ from: 1, to: 1, duration: 150 }],
          rotate: false, // 対象に絡みつく蔦。向きを持たない
        },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_shaman/shaman-defend.png` },
  },
  "units/rebels/elvish_druid": {
    base: `${ASSET_BASE}/sprites/elvish_druid/druid.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_druid/druid.png`, duration: 500 }],
    attacks: {
      staff: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/elvish_druid/druid-attack.png`, duration: 100 },
        ],
      },
      // entangle(WML名はensnare): start_time=-300, druid-magic-[1~4,4~1]:75。
      // 蔦(entangle)は対象ヘックス上に出現(offset=1.0固定)。詠唱haloは多層合成のため省略
      entangle: {
        startTime: -300,
        frames: [1, 2, 3, 4, 4, 3, 2, 1].map((n) => ({
          image: `${ASSET_BASE}/sprites/elvish_druid/druid-magic-${n}.png`,
          duration: 75,
        })),
        missile: {
          startTime: -200,
          duration: 200,
          image: `${ASSET_BASE}/sprites/projectiles/entangle.png`,
          offset: [{ from: 1, to: 1, duration: 200 }],
          rotate: false,
        },
      },
      // thorns: 同じ詠唱フレームで棘(projectiles/thorns)が対象へ飛ぶ。missile -200/200
      thorns: {
        startTime: -300,
        frames: [1, 2, 3, 4, 4, 3, 2, 1].map((n) => ({
          image: `${ASSET_BASE}/sprites/elvish_druid/druid-magic-${n}.png`,
          duration: 75,
        })),
        missile: { startTime: -200, duration: 200, image: `${ASSET_BASE}/sprites/projectiles/thorns.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/elvish_druid/druid-defend-1.png` },
  },
  "units/rebels/elvish_sylph": {
    base: `${ASSET_BASE}/sprites/elvish_sylph/sylph.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/elvish_sylph/sylph.png`, duration: 500 }],
    attacks: {
      // staff(WML名faerie touch): start_time=-200, sylph.png:400(専用フレームなし)
      staff: {
        startTime: -200,
        frames: [{ image: `${ASSET_BASE}/sprites/elvish_sylph/sylph.png`, duration: 400 }],
      },
      // 本家のfaerie fireは「攻撃者の周囲にhalo(faerie-fire-halo[1~7]:75)が灯るだけ」で
      // 飛翔体がない(halo多層合成は未対応)。ここでは妖精の炎のフレームを飛び道具として
      // 対象へ飛ばすアレンジで表現する
      magic_solar_elfhame: {
        startTime: -450,
        frames: [{ image: `${ASSET_BASE}/sprites/elvish_sylph/sylph.png`, duration: 450 }],
        missile: {
          startTime: -450,
          duration: 450,
          size: 96, // 96x96のhalo画像を原寸で描画(上位魔法らしくヘックスより一回り大きい球)
          frames: Array.from({ length: 7 }, (_, i) => ({
            image: `${ASSET_BASE}/sprites/halo/faerie-fire-halo${i + 1}.png`,
            duration: 65,
          })),
        },
      },
    },
  },
  "units/rebels/mermaid_siren": {
    base: `${ASSET_BASE}/sprites/mermaid_siren/siren.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/mermaid_siren/siren.png`, duration: 500 }],
    attacks: {
      staff: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/mermaid_siren/siren-magic-1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/mermaid_siren/siren-magic-2.png`, duration: 100 },
        ],
      },
      // water spray(本ゲームではid=water_magic): start_time=-420,
      // siren-magic-[1,2,1]:[200,200,120], missile water-spray -165/165。杖先フレアhaloは省略
      water_magic: {
        startTime: -420,
        frames: [
          { image: `${ASSET_BASE}/sprites/mermaid_siren/siren-magic-1.png`, duration: 200 },
          { image: `${ASSET_BASE}/sprites/mermaid_siren/siren-magic-2.png`, duration: 200 },
          { image: `${ASSET_BASE}/sprites/mermaid_siren/siren-magic-1.png`, duration: 120 },
        ],
        missile: { startTime: -165, duration: 165, image: `${ASSET_BASE}/sprites/projectiles/water-spray.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/mermaid_siren/siren-defend1.png` },
  },
  "units/rebels/wose": {
    base: `${ASSET_BASE}/sprites/wose/wose.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/wose/wose.png`, duration: 500 }],
    // image="wose-idle-[1~7].png:[250,400*2,250*4]"
    idle: [
      [1, 250], [2, 400], [3, 400], [4, 250], [5, 250], [6, 250], [7, 250],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/wose/wose-idle-${n}.png`,
      duration: d,
    })),
    attacks: {
      crush: {
        startTime: -300,
        frames: [
          { image: `${ASSET_BASE}/sprites/wose/wose-attack-1.png`, duration: 150 },
          { image: `${ASSET_BASE}/sprites/wose/wose-attack-2.png`, duration: 150 },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/wose/wose-defend.png` },
  },
  "units/rebels/wose-ancient": {
    base: `${ASSET_BASE}/sprites/wose-ancient/wose-ancient.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/wose-ancient/wose-ancient.png`, duration: 500 }],
    attacks: {
      crush: {
        startTime: -300,
        frames: [
          { image: `${ASSET_BASE}/sprites/wose-ancient/wose-ancient-attack-1.png`, duration: 150 },
          { image: `${ASSET_BASE}/sprites/wose-ancient/wose-ancient-attack-2.png`, duration: 150 },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/wose-ancient/wose-ancient-defend.png` },
  },
  "units/loyalists/mermaid_initiate": {
    base: `${ASSET_BASE}/sprites/mermaid_initiate/initiate.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/mermaid_initiate/initiate.png`, duration: 500 }],
    attacks: {
      staff: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/mermaid_initiate/initiate-staff-attack-1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/mermaid_initiate/initiate-staff-attack-2.png`, duration: 100 },
        ],
      },
      // water spray(本ゲームではid=water_magic): start_time=-420,
      // initiate-magic-[1,2]:[70,230] → magic-2:50 → magic-1:80, missile water-spray -165/165
      water_magic: {
        startTime: -420,
        frames: [
          { image: `${ASSET_BASE}/sprites/mermaid_initiate/initiate-magic-1.png`, duration: 70 },
          { image: `${ASSET_BASE}/sprites/mermaid_initiate/initiate-magic-2.png`, duration: 230 },
          { image: `${ASSET_BASE}/sprites/mermaid_initiate/initiate-magic-2.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/mermaid_initiate/initiate-magic-1.png`, duration: 80 },
        ],
        missile: { startTime: -165, duration: 165, image: `${ASSET_BASE}/sprites/projectiles/water-spray.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/mermaid_initiate/initiate-defend-1.png` },
  },

};
