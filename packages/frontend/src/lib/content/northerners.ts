// 北方陣営(オーク・ゴブリン・トロル・ナーガ+盗賊)のスプライト定義(コンテンツ)。
// WML転記元は各エントリーのコメント参照。追加手順は docs/sprite_guide.md
import type { UnitSpriteDef } from "../anim/model";
import { ASSET_BASE } from "./shared";

export const SPRITES: Record<string, UnitSpriteDef> = {
  "units/northerners/orcish_grunt": {
    base: `${ASSET_BASE}/sprites/orcish_grunt/grunt.png`,
    // image="grunt-stand-se-[1~5,4,3,2].png:[200*2,300,200*2,200*3]"
    standing: [
      { image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-stand-se-1.png`, duration: 200 },
      { image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-stand-se-2.png`, duration: 200 },
      { image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-stand-se-3.png`, duration: 300 },
      { image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-stand-se-4.png`, duration: 200 },
      { image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-stand-se-5.png`, duration: 200 },
      { image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-stand-se-4.png`, duration: 200 },
      { image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-stand-se-3.png`, duration: 200 },
      { image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-stand-se-2.png`, duration: 200 },
    ],
    attacks: {
      sword: {
        startTime: -250,
        frames: Array.from({ length: 5 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_grunt/grunt-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/orcish_grunt/grunt-defend-1.png` },
  },
  "units/northerners/orcish_warrior": {
    base: `${ASSET_BASE}/sprites/orcish_warrior/warrior.png`,
    // image="warrior-bob-[1~3,2].png:[400,280,450,280]"
    standing: [
      { image: `${ASSET_BASE}/sprites/orcish_warrior/warrior-bob-1.png`, duration: 400 },
      { image: `${ASSET_BASE}/sprites/orcish_warrior/warrior-bob-2.png`, duration: 280 },
      { image: `${ASSET_BASE}/sprites/orcish_warrior/warrior-bob-3.png`, duration: 450 },
      { image: `${ASSET_BASE}/sprites/orcish_warrior/warrior-bob-2.png`, duration: 280 },
    ],
    attacks: {
      greatsword: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_warrior/warrior-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/orcish_warrior/warrior-defend-1.png` },
  },
  "units/northerners/orcish_archer": {
    base: `${ASSET_BASE}/sprites/orcish_archer/archer.png`,
    // image="archer-bob-[1~6].png:[150*2,200,150*3]"
    standing: [1, 2, 3, 4, 5, 6].map((n, idx) => ({
      image: `${ASSET_BASE}/sprites/orcish_archer/archer-bob-${n}.png`,
      duration: idx === 2 ? 200 : 150,
    })),
    // image="archer-idle-[1~3,6,4,3,6,4~6,2,1].png:[100*3,200,100*2,200,100*2,200,100*2]"
    idle: [
      [1, 100], [2, 100], [3, 100], [6, 200], [4, 100], [3, 100],
      [6, 200], [4, 100], [5, 100], [6, 200], [2, 100], [1, 100],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/orcish_archer/archer-idle-${n}.png`,
      duration: d,
    })),
    attacks: {
      dagger: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_archer/archer-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      // bow: start_time=-445, archer-bow:65 → bow-attack-[1~4,1]:[75*2,100,130,65], missile -150/150
      bow: {
        startTime: -445,
        frames: [
          { image: `${ASSET_BASE}/sprites/orcish_archer/archer-bow.png`, duration: 65 },
          { image: `${ASSET_BASE}/sprites/orcish_archer/archer-bow-attack-1.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/orcish_archer/archer-bow-attack-2.png`, duration: 75 },
          { image: `${ASSET_BASE}/sprites/orcish_archer/archer-bow-attack-3.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/orcish_archer/archer-bow-attack-4.png`, duration: 130 },
          { image: `${ASSET_BASE}/sprites/orcish_archer/archer-bow-attack-1.png`, duration: 65 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/orcish_archer/archer-bow-defend.png` },
  },
  "units/northerners/orcish_crossbow": {
    base: `${ASSET_BASE}/sprites/orcish_crossbow/xbowman.png`,
    // image="xbowman.png:50" + image="xbowman-breeze-[1~5].png:[240*5]"
    standing: [
      { image: `${ASSET_BASE}/sprites/orcish_crossbow/xbowman.png`, duration: 50 },
      ...Array.from({ length: 5 }, (_, i) => ({
        image: `${ASSET_BASE}/sprites/orcish_crossbow/xbowman-breeze-${i + 1}.png`,
        duration: 240,
      })),
    ],
    attacks: {
      dagger: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_crossbow/xbowman-melee-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
      // crossbow(本ゲームではid=bow): start_time=-250, ranged-[1,2]:[200,100], xbowman:50
      bow: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/orcish_crossbow/xbowman-ranged-1.png`, duration: 200 },
          { image: `${ASSET_BASE}/sprites/orcish_crossbow/xbowman-ranged-2.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/orcish_crossbow/xbowman.png`, duration: 50 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/missile-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/orcish_crossbow/xbowman-melee-defend-1.png` },
  },
  "units/northerners/orcish_assassin": {
    base: `${ASSET_BASE}/sprites/orcish_assassin/assassin.png`,
    // image="assassin-heaving-[1~4,3,2].png:[400*6]"
    standing: [1, 2, 3, 4, 3, 2].map((n) => ({
      image: `${ASSET_BASE}/sprites/orcish_assassin/assassin-heaving-${n}.png`,
      duration: 400,
    })),
    // image="assassin-idle-[1~8,7,8,3,2,9].png:100"
    idle: [1, 2, 3, 4, 5, 6, 7, 8, 7, 8, 3, 2, 9].map((n) => ({
      image: `${ASSET_BASE}/sprites/orcish_assassin/assassin-idle-${n}.png`,
      duration: 100,
    })),
    attacks: {
      knife: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_assassin/assassin-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
      // throwing knives(本ゲームではid=thrown_knife): assassin-ranged[1,2]:100, missile dagger-n -150/150
      thrown_knife: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/orcish_assassin/assassin-ranged1.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/orcish_assassin/assassin-ranged2.png`, duration: 100 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/dagger-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/orcish_assassin/assassin-defend-1.png` },
  },
  "units/northerners/orcish_slayer": {
    base: `${ASSET_BASE}/sprites/orcish_slayer/slayer.png`,
    // image="slayer.png:200" + image="slayer-breeze-[1~3,2,1].png:[200*5]"
    standing: [
      { image: `${ASSET_BASE}/sprites/orcish_slayer/slayer.png`, duration: 200 },
      ...[1, 2, 3, 2, 1].map((n) => ({
        image: `${ASSET_BASE}/sprites/orcish_slayer/slayer-breeze-${n}.png`,
        duration: 200,
      })),
    ],
    attacks: {
      knife: {
        startTime: -250,
        frames: Array.from({ length: 6 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_slayer/slayer-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
      // throwing knives(本ゲームではid=thrown_knife): slayer-ranged[1,2]:[50,100], missile dagger-n -150/150
      thrown_knife: {
        startTime: -150,
        frames: [
          { image: `${ASSET_BASE}/sprites/orcish_slayer/slayer-ranged1.png`, duration: 50 },
          { image: `${ASSET_BASE}/sprites/orcish_slayer/slayer-ranged2.png`, duration: 100 },
        ],
        missile: { startTime: -150, duration: 150, image: `${ASSET_BASE}/sprites/projectiles/dagger-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/orcish_slayer/slayer-defend.png` },
  },
  "units/northerners/orcish_nightblade": {
    base: `${ASSET_BASE}/sprites/orcish_nightblade/nightblade.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/orcish_nightblade/nightblade.png`, duration: 500 }],
    attacks: {
      knife: {
        startTime: -250,
        frames: Array.from({ length: 6 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_nightblade/nightblade-attack-se-${i + 1}.png`,
          duration: 100,
        })),
      },
      // throwing knives(本ゲームではid=thrown_knife): throw-se-[1~9]:100, missile dagger-n -100/100
      thrown_knife: {
        startTime: -350,
        frames: Array.from({ length: 9 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_nightblade/nightblade-throw-se-${i + 1}.png`,
          duration: 100,
        })),
        missile: { startTime: -100, duration: 100, image: `${ASSET_BASE}/sprites/projectiles/dagger-n.png` },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/orcish_nightblade/nightblade-defend-se-1-1.png` },
  },
  "units/northerners/orcish_pillager": {
    base: `${ASSET_BASE}/sprites/orcish_pillager/pillager.png`,
    // 本家standingの多層構成をそのまま再現:
    // 胴体 pillager-base[1~4]:210 + 松明の炎 pillager-flame/a[1~14]:60 + グロー(840ms)
    // (胴体210ms・炎60msと周期が異なる独立レイヤー。standingOverlaysが別タイマーで回す)
    standing: Array.from({ length: 4 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-base${i + 1}.png`,
      duration: 210,
    })),
    standingOverlays: [
      {
        frames: Array.from({ length: 14 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/orcish_pillager/flame-a${i + 1}.png`,
          duration: 60,
        })),
      },
      {
        frames: [{ image: `${ASSET_BASE}/sprites/orcish_pillager/flame-glow.png`, duration: 840 }],
      },
    ],
    attacks: {
      fangs: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-attack.png`,  duration: 100 },
          { image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-attack2.png`, duration: 100 },
        ],
      },
      // torch(松明): start_time=-200, pillager-moving:100 → pillager-attack:150 → moving:100
      torch: {
        startTime: -200,
        frames: [
          { image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-moving.png`, duration: 100 },
          { image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-attack.png`, duration: 150 },
          { image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-moving.png`, duration: 100 },
        ],
      },
      // net(投げ網): start_time=-400, pillager-net[1,2,3]:[150,275,100], missile web.png -200/200
      net: {
        startTime: -400,
        frames: [
          { image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-net1.png`, duration: 150 },
          { image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-net2.png`, duration: 275 },
          { image: `${ASSET_BASE}/sprites/orcish_pillager/pillager-net3.png`, duration: 100 },
        ],
        missile: {
          startTime: -200,
          duration: 200,
          image: `${ASSET_BASE}/sprites/projectiles/web.png`,
          // 原寸72px(既定)でヘックス大に広がる
          rotate: false, // 放射状で向きを持たない
        },
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/orcish_pillager/pillager-defend-1.png` },
  },
  "units/northerners/wolf_rider": {
    base: `${ASSET_BASE}/sprites/wolf_rider/wolf-rider.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/wolf_rider/wolf-rider.png`, duration: 500 }],
    // image="wolf-rider-idle-[1~5,4,3~5,4~1].png:100"
    idle: [1, 2, 3, 4, 5, 4, 3, 4, 5, 4, 3, 2, 1].map((n) => ({
      image: `${ASSET_BASE}/sprites/wolf_rider/wolf-rider-idle-${n}.png`,
      duration: 100,
    })),
    attacks: {
      fangs: {
        startTime: -250,
        frames: [
          { image: `${ASSET_BASE}/sprites/wolf_rider/wolf-rider-attack.png`, duration: 100 },
        ],
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/wolf_rider/wolf-rider-defend-1.png` },
  },
  "units/northerners/troll": {
    base: `${ASSET_BASE}/sprites/troll/great-troll.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/troll/great-troll.png`, duration: 500 }],
    attacks: {
      club: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/troll/great-troll-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/troll/great-troll-defend1.png` },
  },
  "units/northerners/troll_whelp": {
    base: `${ASSET_BASE}/sprites/troll_whelp/whelp.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/troll_whelp/whelp.png`, duration: 500 }],
    // idle_anim(本家Whelp.cfg): whelp-idle-[1~7,6,7~1]:[100*6,150,175,150,100*6]。
    // great-troll(昇格後)には本家にidle素材が無いため、whelpだけの演出になる
    idle: [
      [1, 100], [2, 100], [3, 100], [4, 100], [5, 100], [6, 100], [7, 150],
      [6, 175], [7, 150], [6, 100], [5, 100], [4, 100], [3, 100], [2, 100], [1, 100],
    ].map(([n, d]) => ({
      image: `${ASSET_BASE}/sprites/troll_whelp/whelp-idle-${n}.png`,
      duration: d,
    })),
    attacks: {
      fist: {
        startTime: -250,
        frames: Array.from({ length: 3 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/troll_whelp/whelp-attack-${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/troll_whelp/whelp-defend.png` },
  },

};
