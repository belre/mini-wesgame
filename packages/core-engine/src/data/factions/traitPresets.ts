import type { TraitConfig } from "../../types";

// 種族ごとの特性プール(計: 13特性)。
// 排他ルール:
//   器用(dextrous) = 反乱軍のエルフのみ / 勇敢(fearless) = トロル専用(2026-07-08 ユーザー指定でグールから除外)
//   凡愚・鈍重・非力(dim/slow/weak) = ゴブリンのみ / アンデッド = アンデッドのみ
//   壮健(healthy) = ナルガン同盟のドワーフのみ
//   野生(feral) = データ未使用(かつてコウモリにforcedだったが、fly村防御40%<50%でno-opのため撤去。ルールは残置)
//   小物(no_zoc) = どのプールにも入らない。レベル0ユニットへ参照時に暗黙付与される
//   (traits.tsのeffectiveTraits。保存されず、昇級でlv1になれば自然に外れる=本家準拠)

export const HUMAN_TRAITS: TraitConfig = {
  pool: ["strong", "intelligent", "quick", "resilient"],
  picks: 2,
};

export const ELF_TRAITS: TraitConfig = {
  pool: ["strong", "intelligent", "quick", "resilient", "dextrous"],
  picks: 2,
};

export const MERMAN_TRAITS: TraitConfig = {
  pool: ["strong", "intelligent", "quick", "resilient"],
  picks: 2,
};

export const NAGA_TRAITS: TraitConfig = {
  pool: ["strong", "intelligent", "quick", "resilient"],
  picks: 2,
};


export const ORC_TRAITS: TraitConfig = {
  pool: ["strong", "intelligent", "quick", "resilient"],
  picks: 2,
};

// 勇敢は固定(2026-07-08 ユーザー指定。トロルは常に不利な時間帯補正を受けない)。
// 残り2枠を strong/quick/resilient から抽選
export const TROLL_TRAITS: TraitConfig = {
  forced: ["fearless"],
  pool: ["strong", "quick", "resilient"],
  picks: 2,
};

export const GOBLIN_TRAITS: TraitConfig = {
  pool: ["dim", "slow", "weak"],
  picks: 1,
};

export const DWARF_TRAITS: TraitConfig = {
  pool: ["strong", "intelligent", "quick", "resilient", "healthy"],
  picks: 2,
};

export const DRAKE_TRAITS: TraitConfig = {
  pool: ["strong", "intelligent", "quick", "resilient"],
  picks: 2,
};

export const UNDEAD_TRAITS: TraitConfig = {
  forced: ["undead"],
};

// 勇敢はトロル専用のため削除(2026-07-08 ユーザー指定)。アンデッド固定のみ
export const GHOUL_TRAITS: TraitConfig = {
  forced: ["undead"],
};

// コウモリ(vampire_bat/bloodbat)。野生(feral)は付けない:
// 効果は「村の防御率を50%に制限」だが、flyの村防御率は40%で50%を下回るため
// コウモリには一度も発動せず、バッジ表示だけが残るno-opだった(2026-07-06に外した)
export const BAT_TRAITS: TraitConfig = {
  pool: ["strong", "quick", "resilient"],
  picks: 1,
};
