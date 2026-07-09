// コンテンツ共有部: アセットパス解決と、複数陣営で使い回すビルダー・飛び道具定義。
// コンテンツ層(content/)はReact/DOM非依存の純データ+純関数のみで構成する
// (Node上の整合性テストからも読み込めるようにするため)。
//
// 画像の参照元は NEXT_PUBLIC_ASSET_BASE で切り替える。未設定(dev既定)は相対パス
// "/sprites/..." = Next.jsのpublic/から配信。設定時(prod)はCDK出力のAssetBaseUrl(CloudFront)
import type { AnimTrack, AttackAnimDef, MissileDef } from "../anim/model";

export const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? "";

export const spearman   = (n: string) => `${ASSET_BASE}/sprites/spearman/${n}`;
export const bowman_    = (n: string) => `${ASSET_BASE}/sprites/bowman/${n}`;
export const cavalryman_= (n: string) => `${ASSET_BASE}/sprites/cavalryman/${n}`;
export const fencer_    = (n: string) => `${ASSET_BASE}/sprites/fencer/${n}`;
export const heavyInf   = (n: string) => `${ASSET_BASE}/sprites/heavy_infantryman/${n}`;
export const lieu       = (n: string) => `${ASSET_BASE}/sprites/lieutenant/${n}`;
export const swordsman_ = (n: string) => `${ASSET_BASE}/sprites/swordsman/${n}`;
export const whiteMage  = (n: string) => `${ASSET_BASE}/sprites/white_mage/${n}`;
export const pikeman_   = (n: string) => `${ASSET_BASE}/sprites/pikeman/${n}`;
export const longbow    = (n: string) => `${ASSET_BASE}/sprites/longbowman/${n}`;
export const shocktpr   = (n: string) => `${ASSET_BASE}/sprites/shocktrooper/${n}`;
export const dragoon_   = (n: string) => `${ASSET_BASE}/sprites/dragoon/${n}`;
export const lancer_    = (n: string) => `${ASSET_BASE}/sprites/lancer/${n}`;
export const duelist_   = (n: string) => `${ASSET_BASE}/sprites/duelist/${n}`;
export const horseman_  = (n: string) => `${ASSET_BASE}/sprites/horseman/${n}`;
export const mage_      = (n: string) => `${ASSET_BASE}/sprites/mage/${n}`;
export const silverM_   = (n: string) => `${ASSET_BASE}/sprites/silver_mage/${n}`;
export const halo_      = (n: string) => `${ASSET_BASE}/sprites/halo/${n}`;
export const merman_    = (n: string) => `${ASSET_BASE}/sprites/merman/${n}`;
export const mermanT_   = (n: string) => `${ASSET_BASE}/sprites/merman_triton/${n}`;
export const projectile = (name: string) => `${ASSET_BASE}/sprites/projectiles/${name}`;

// {DRAKE_FIRE_ANIM_S_DIAGONAL <name> ...}: 全ドレイク共通の火炎ブレス(se/sw方向用)。
// start_time=-900, base:20 → fire-inhale-[1~4,2]:100(吸気) → fire-se-[1~3,2,1]:100(放射)。
// missileは炎(projectiles/fire-breath-se-[1~5]:80)が攻撃側→防御側へ飛びt=0で命中。
// 盤面では防御側が右下(SE)に来るためse版を使う(真下を向くS版は不自然)。炎も回転しない
export const drakeFireBreath = (folder: string, name: string): AttackAnimDef => ({
  startTime: -900,
  frames: [
    { image: `${ASSET_BASE}/sprites/${folder}/${name}.png`, duration: 20 },
    ...[1, 2, 3, 4, 2].map((n) => ({
      image: `${ASSET_BASE}/sprites/${folder}/${name}-fire-inhale-${n}.png`,
      duration: 100,
    })),
    ...[1, 2, 3, 2, 1].map((n) => ({
      image: `${ASSET_BASE}/sprites/${folder}/${name}-fire-se-${n}.png`,
      duration: 100,
    })),
  ],
  missile: {
    startTime: -400,
    duration: 400,
    size: 70, // 100x140px前後の炎画像(halo)をヘックス相応に縮小
    frames: Array.from({ length: 5 }, (_, i) => ({
      image: projectile(`fire-breath-se-${i + 1}.png`),
      duration: 80,
    })),
  },
});

// サウリアンのcurse: {MAGIC_ARMRAISE_DIRECTIONAL_2_FRAME}(腕上げ se-magic[1,2,1]:100) +
// {MISSILE_FRAME_ICE}(氷弾0→0.8で飛翔200ms → 着弾スプラッシュ8フレーム400ms) +
// {HALO_FRAME_SAURIAN}(ユニットを包む魔法陣halo。saurian-magic-halo-[1~7]:60)
export const saurianCurse = (folder: string, name: string): AttackAnimDef => ({
  startTime: -300,
  frames: [1, 2, 1].map((n) => ({
    image: `${ASSET_BASE}/sprites/${folder}/${name}-se-magic${n}.png`,
    duration: 100,
  })),
  extraTracks: [
    {
      startTime: -300,
      anchor: "unit",
      frames: Array.from({ length: 7 }, (_, i) => ({
        image: halo_(`saurian-magic-halo-${i + 1}.png`),
        duration: 60,
      })),
    },
  ],
  missile: {
    startTime: -200,
    duration: 600,
    size: 50,
    rotate: true, // whitemissile-nは北向きに描かれた弾なので進行方向へ回す
    frames: [
      { image: projectile("whitemissile-n.png"), duration: 200 },
      ...Array.from({ length: 8 }, (_, i) => ({
        image: projectile(`whitemissile-impact-${i + 1}.png`),
        duration: 50,
      })),
    ],
    // offset=0.0~0.8(飛翔) → 0.8,0.92,...,1.04(着弾で微前進)を2区間で近似
    offset: [
      { from: 0, to: 0.8, duration: 200 },
      { from: 0.8, to: 1, duration: 400 },
    ],
  },
});

// {MAGIC_MISSILE}: 魔術師系共通の魔法弾(光球)。杖先から一度後方へ引き込まれ、
// 前方へ放り込まれてt=0で命中する。mage / silver_mage(elvish_magician)が共用。
//   offset=0.001~-0.083,-0.083~-0.25,-0.25~-0.5 (400ms) / -0.5~-0.25,-0.25~0.25,0.25~1.0 (350ms)
//   halo_y=-20~-54 (400ms) / -54~-45,-45~-27,-27~0 (350ms)
// 杖先フレア({MAGIC_MISSILE_STAFF_FLARE})と残像トレイル3層は多層合成のため省略
export const MAGIC_MISSILE_ORB: MissileDef = {
  startTime: -750,
  duration: 750,
  size: 50, // mage-haloの原寸(50x50px)で描画
  frames: [1, 2, 3, 4, 5].map((n) => ({ image: halo_(`mage-halo${n}.png`), duration: 75 })),
  offset: [
    { from: 0, to: -0.083, duration: 133 },
    { from: -0.083, to: -0.25, duration: 133 },
    { from: -0.25, to: -0.5, duration: 134 },
    { from: -0.5, to: -0.25, duration: 117 },
    { from: -0.25, to: 0.25, duration: 117 },
    { from: 0.25, to: 1, duration: 116 },
  ],
  offsetY: [
    { from: -20, to: -54, duration: 400 },
    { from: -54, to: -45, duration: 117 },
    { from: -45, to: -27, duration: 117 },
    { from: -27, to: 0, duration: 116 },
  ],
};

// {MISSILE_FRAME_CHILL_WAVE}: 黒魔術師系の冷気弾。
// icemissile-n-[1~7]:40で0~0.9まで飛び(120ms)、0.9で滞留して消える(160ms)
export const CHILL_WAVE_MISSILE: MissileDef = {
  startTime: -120,
  duration: 280,
  rotate: true, // 北向きに描かれた弾なので進行方向へ回す
  frames: Array.from({ length: 7 }, (_, i) => ({
    image: projectile(`icemissile-n-${i + 1}.png`),
    duration: 40,
  })),
  offset: [
    { from: 0, to: 0.9, duration: 120 },
    { from: 0.9, to: 0.9, duration: 160 },
  ],
};

// {MISSILE_FRAME_SHADOW_WAVE}: 黒魔術師系の影の波動。本家どおりの2層構成:
// 影の弾(darkmissile)が対象へ飛び(missile)、対象上で闇のバースト(dark-magic halo)が
// 弾ける(SHADOW_WAVE_TRACKS)。adept/dark_sorcerer/lichが共用
export const SHADOW_WAVE_MISSILE: MissileDef = {
  startTime: -350,
  duration: 350,
  image: projectile("darkmissile-n.png"), // 北向きの弾(進行方向へ回転)
  offset: [
    { from: 0.1, to: 1, duration: 150 },
    { from: 1, to: 1, duration: 200 },
  ],
};

export const SHADOW_WAVE_TRACKS: AnimTrack[] = [
  {
    // 対象ヘックス上の闇のバースト: dark-magic[6~1]:50、offset=1.0固定
    startTime: -50,
    anchor: "path",
    offset: [{ from: 1, to: 1, duration: 300 }],
    frames: [6, 5, 4, 3, 2, 1].map((n) => ({ image: halo_(`dark-magic-${n}.png`), duration: 50 })),
  },
];

// {MISSILE_FRAME_WAIL}: ゴースト系のうめき声の波。s向きの波形が対象へ飛ぶ
// (南向き画像のため回転しない。ユニットスプライトの南向き固定と同じ方針)
export const WAIL_MISSILE: MissileDef = {
  startTime: -300,
  duration: 420,
  rotate: false,
  frames: [
    [1, 70], [2, 70], [3, 160], [4, 40], [5, 40], [6, 40],
  ].map(([n, d]) => ({ image: projectile(`wailprojectile-s-${n}.png`), duration: d })),
};

// spriteKey(core-engineのUnitDefが持つ参照キー)→ スプライト定義
