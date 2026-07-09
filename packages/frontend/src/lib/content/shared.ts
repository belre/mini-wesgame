// コンテンツ共有部: アセットパス解決と、複数陣営で使い回すビルダー・飛び道具定義。
// コンテンツ層(content/)はReact/DOM非依存の純データ+純関数のみで構成する
// (Node上の整合性テストからも読み込めるようにするため)。
//
// 画像の参照元は NEXT_PUBLIC_ASSET_BASE で切り替える。未設定(dev既定)は相対パス
// "/sprites/..." = Next.jsのpublic/から配信。設定時(prod)はCDK出力のAssetBaseUrl(CloudFront)
import type { MissileDef } from "../anim/model";

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
export const halo_      = (n: string) => `${ASSET_BASE}/sprites/halo/${n}`;
export const merman_    = (n: string) => `${ASSET_BASE}/sprites/merman/${n}`;
export const mermanT_   = (n: string) => `${ASSET_BASE}/sprites/merman_triton/${n}`;
export const projectile = (name: string) => `${ASSET_BASE}/sprites/projectiles/${name}`;

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

// spriteKey(core-engineのUnitDefが持つ参照キー)→ スプライト定義
