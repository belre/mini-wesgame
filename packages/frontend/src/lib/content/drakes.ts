// ドレイク陣営(サウリアン含む)のスプライト定義(コンテンツ)。
// WML転記元は各エントリーのコメント参照。追加手順は docs/sprite_guide.md
import type { UnitSpriteDef } from "../anim/model";
import { ASSET_BASE, drakeFireBreath, saurianCurse } from "./shared";

export const SPRITES: Record<string, UnitSpriteDef> = {
  "units/drakes/drake_fighter": {
    base: `${ASSET_BASE}/sprites/drake_fighter/fighter.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/drake_fighter/fighter.png`, duration: 500 }],
    attacks: {
      war_blade: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_fighter/fighter-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      fire_breath: drakeFireBreath("drake_fighter", "fighter"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/drake_fighter/fighter-defend-1.png` },
  },
  "units/drakes/drake_warrior": {
    base: `${ASSET_BASE}/sprites/drake_warrior/warrior.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/drake_warrior/warrior.png`, duration: 500 }],
    attacks: {
      war_blade: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_warrior/warrior-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      fire_breath: drakeFireBreath("drake_warrior", "warrior"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/drake_warrior/warrior-defend-1.png` },
  },
  "units/drakes/drake_flare": {
    base: `${ASSET_BASE}/sprites/drake_flare/flare.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/drake_flare/flare.png`, duration: 500 }],
    attacks: {
      war_blade: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_flare/flare-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      fire_breath: drakeFireBreath("drake_flare", "flare"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/drake_flare/flare-defend-1.png` },
  },
  "units/drakes/drake_burner": {
    base: `${ASSET_BASE}/sprites/drake_burner/burner.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/drake_burner/burner.png`, duration: 500 }],
    attacks: {
      claws: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_burner/burner-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      fire_breath: drakeFireBreath("drake_burner", "burner"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/drake_burner/burner-defend-1.png` },
  },
  "units/drakes/drake_glider": {
    base: `${ASSET_BASE}/sprites/drake_glider/glider.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/drake_glider/glider.png`, duration: 500 }],
    attacks: {
      tackle: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_glider/glider-kick-${i + 1}.png`,
          duration: 100,
        })),
      },
      fire_breath: drakeFireBreath("drake_glider", "glider"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/drake_glider/glider-defend-1.png` },
  },
  "units/drakes/drake_hurricane": {
    base: `${ASSET_BASE}/sprites/drake_hurricane/hurricane.png`,
    // image="hurricane-fly-[1~5,4].png:100,hurricane-fly-[3,2]-upstroke.png:100" (飛行ユニットの浮遊)
    standing: [
      ...[1, 2, 3, 4, 5, 4].map((n) => ({
        image: `${ASSET_BASE}/sprites/drake_hurricane/hurricane-fly-${n}.png`,
        duration: 100,
      })),
      { image: `${ASSET_BASE}/sprites/drake_hurricane/hurricane-fly-3-upstroke.png`, duration: 100 },
      { image: `${ASSET_BASE}/sprites/drake_hurricane/hurricane-fly-2-upstroke.png`, duration: 100 },
    ],
    attacks: {
      tackle: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_hurricane/hurricane-kick-${i + 1}.png`,
          duration: 100,
        })),
      },
      fire_breath: drakeFireBreath("drake_hurricane", "hurricane"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/drake_hurricane/hurricane-defend-1.png` },
  },
  "units/drakes/drake_clasher": {
    base: `${ASSET_BASE}/sprites/drake_clasher/clasher.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/drake_clasher/clasher.png`, duration: 500 }],
    attacks: {
      war_nail: {
        startTime: -250,
        frames: Array.from({ length: 5 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_clasher/clasher-blade-${i + 1}.png`,
          duration: 100,
        })),
      },
      // spear: start_time=-300, clasher-spear-se-[1~6]:100
      spear: {
        startTime: -300,
        frames: Array.from({ length: 6 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_clasher/clasher-spear-se-${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/drake_clasher/clasher-blade-defend-1.png` },
  },
  "units/drakes/drake_arbiter": {
    base: `${ASSET_BASE}/sprites/drake_arbiter/arbiter.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/drake_arbiter/arbiter.png`, duration: 500 }],
    attacks: {
      war_nail: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/drake_arbiter/arbiter-blade-se-${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/drake_arbiter/arbiter-defend-1.png` },
  },
  "units/drakes/inferno_drake": {
    base: `${ASSET_BASE}/sprites/inferno_drake/inferno.png`,
    standing: [{ image: `${ASSET_BASE}/sprites/inferno_drake/inferno.png`, duration: 500 }],
    attacks: {
      claws: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/inferno_drake/inferno-melee-${i + 1}.png`,
          duration: 100,
        })),
      },
      fire_breath: drakeFireBreath("inferno_drake", "inferno"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/inferno_drake/inferno-defend-1.png` },
  },
  "units/drakes/saurian_skirmisher": {
    base: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher.png`,
    // {STANDING_ANIM_DIRECTIONAL_6_FRAME} → se-bob[1~6].png:200
    standing: Array.from({ length: 6 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher-se-bob${i + 1}.png`,
      duration: 200,
    })),
    // image="skirmisher-idle-[1~7,6,5,6,8~13].png:200,skirmisher-idle-[12,13,12,13].png:[225*2,250*2]"
    idle: [
      ...[1, 2, 3, 4, 5, 6, 7, 6, 5, 6, 8, 9, 10, 11, 12, 13].map((n) => ({
        image: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher-idle-${n}.png`,
        duration: 200,
      })),
      { image: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher-idle-12.png`, duration: 225 },
      { image: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher-idle-13.png`, duration: 225 },
      { image: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher-idle-12.png`, duration: 250 },
      { image: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher-idle-13.png`, duration: 250 },
    ],
    attacks: {
      spear: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher-se-melee${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/saurian_skirmisher/skirmisher-se-defend1.png` },
  },
  "units/drakes/saurian_ambusher": {
    base: `${ASSET_BASE}/sprites/saurian_ambusher/flanker.png`,
    // {STANDING_ANIM_DIRECTIONAL_6_FRAME} → se-bob[1~6].png:200
    standing: Array.from({ length: 6 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/saurian_ambusher/flanker-se-bob${i + 1}.png`,
      duration: 200,
    })),
    attacks: {
      spear: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/saurian_ambusher/flanker-se-melee${i + 1}.png`,
          duration: 100,
        })),
      },
    },
    defend: { reaction: `${ASSET_BASE}/sprites/saurian_ambusher/flanker-se-defend1.png` },
  },
  "units/drakes/saurian_augur": {
    base: `${ASSET_BASE}/sprites/saurian_augur/augur.png`,
    // {STANDING_ANIM_DIRECTIONAL_6_FRAME} → se-bob[1~6].png:200
    standing: Array.from({ length: 6 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/saurian_augur/augur-se-bob${i + 1}.png`,
      duration: 200,
    })),
    attacks: {
      staff: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/saurian_augur/augur-se-melee${i + 1}.png`,
          duration: 100,
        })),
      },
      curse: saurianCurse("saurian_augur", "augur"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/saurian_augur/augur-se-defend1.png` },
  },
  "units/drakes/saurian_soothsayer": {
    base: `${ASSET_BASE}/sprites/saurian_soothsayer/soothsayer.png`,
    // {STANDING_ANIM_DIRECTIONAL_6_FRAME} → se-bob[1~6].png:200
    standing: Array.from({ length: 6 }, (_, i) => ({
      image: `${ASSET_BASE}/sprites/saurian_soothsayer/soothsayer-se-bob${i + 1}.png`,
      duration: 200,
    })),
    attacks: {
      staff: {
        startTime: -250,
        frames: Array.from({ length: 4 }, (_, i) => ({
          image: `${ASSET_BASE}/sprites/saurian_soothsayer/soothsayer-se-melee${i + 1}.png`,
          duration: 100,
        })),
      },
      curse: saurianCurse("saurian_soothsayer", "soothsayer"),
    },
    defend: { reaction: `${ASSET_BASE}/sprites/saurian_soothsayer/soothsayer-se-defend1.png` },
  },

};
