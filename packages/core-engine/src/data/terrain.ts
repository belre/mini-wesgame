import type { TerrainDef } from "../types";

export const IMPASSABLE = 99;

// 2026-07-08: 全地形を本家Wesnothのmovetypeデータに合わせて整理。
// walk≈smallfoot・fly≈fly(基本形)・swim≈swimmer(マーマン)・cavalry≈mounted・
// lightfoot≈elusivefootを「本家の内部値(被弾率) = 100 - このエンジンのdefenseBonus(外れやすさ)」で換算した。
// cavalry/lightfootは防御だけでなく移動コストも歩兵(walk)と別枠。
// cavalryはユーザーの現地調査(loyalists.csv)でmountedの実測値が確定したため反映
// (森・トーチカの防御は当初の機械的換算=0%から30%/20%に訂正)。
// lightfootは本家elusivefoot準拠(2026-07-08)。
//
// 2026-07-12: 本家units.cfgの[movetype]定義を直接照合し、岩場(mountains)のwalk
// 移動コストを本家smallfoot準拠(コスト3)に修正した。旧実装は「岩場は飛行・軽装のみ
// 通れる壁」という意図的な逸脱だったが、mini-wesgameは本家準拠を志向する方針のため
// 解消した(以前のコメントには「本家mountedもコスト3」とあったが誤りで、実際は
// mountedに岩場の項目自体が無い=本家でも進入不可。cavalryのIMPASSABLEは変更不要)。
// 意図的に本家から外れている箇所(このエンジン独自の設計判断):
//   - 障害物(obstacle)・場外(void): 本家に対応地形がない完全オリジナル。全タイプ進入不可のまま
export const TERRAINS: Record<string, TerrainDef> = {
  grassland: {
    id: "grassland",
    name: "Grassland",
    // 本家準拠(2026-07-08): swimmerは陸地にも「這い上がって」進入できる(高コスト・低防御)
    moveCost: { walk: 1, fly: 1, swim: 2, cavalry: 1, lightfoot: 1 },
    // 開けた地形: 歩兵はやや隠れられる。飛行は本家仕様で地形をほぼ無視(全地形フラット50%)。
    // 水棲は陸上で無防備。騎馬は開けた地形で歩兵と同等。軽装は歩兵よりやや堅い
    defenseBonus: { walk: 40, fly: 50, swim: 30, cavalry: 40, lightfoot: 60 },
  },
  forest: {
    id: "forest",
    name: "Forest",
    // 騎馬は木立でコスト3(歩兵の2より重い。本家mounted準拠 — 2026-07-08 ユーザー実測)
    moveCost: { walk: 2, fly: 1, swim: 4, cavalry: 3, lightfoot: 2 },
    // 樹木が歩兵にそこそこの遮蔽を提供。飛行は地形を無視(50%均一)。水棲は陸上で無防備。
    // 騎馬は木立に阻まれ大きく被弾しやすい(本家mounted準拠 — 2026-07-08 ユーザー実測)。
    // 軽装は木立を活かして歩兵よりさらに堅い(本家elusivefoot準拠)
    defenseBonus: { walk: 50, fly: 50, swim: 30, cavalry: 30, lightfoot: 70 },
  },
  sand: {
    id: "sand",
    name: "Sand",
    moveCost: { walk: 2, fly: 1, swim: 2, cavalry: 2, lightfoot: 2 },
    // 足場の悪い開けた地形: 歩兵は踏ん張りが利かず遮蔽もない。飛行は地形を無視(50%均一)。
    // 水棲は陸上で無防備。騎馬は砂に脚を取られ、開けた地形の利を失う。軽装は歩兵よりやや堅い
    defenseBonus: { walk: 30, fly: 50, swim: 30, cavalry: 30, lightfoot: 40 },
  },
  desert: {
    id: "desert",
    name: "Dunes",
    // 砂地と同性能の明るい砂丘地帯。見た目の識別(砂地=荒野系/砂漠=砂丘系)が主目的
    moveCost: { walk: 2, fly: 1, swim: 2, cavalry: 2, lightfoot: 2 },
    defenseBonus: { walk: 30, fly: 50, swim: 30, cavalry: 30, lightfoot: 40 },
  },
  hills: {
    id: "hills",
    name: "Hills",
    moveCost: { walk: 2, fly: 1, swim: 4, cavalry: 2, lightfoot: 2 },
    // 高低差が歩兵に有利。飛行は地形を無視(50%均一)。水棲は陸上で無防備(丘は特にコスト重め)。
    // 騎馬は傾斜地では歩兵より守りが弱い。軽装は身軽さを活かしてさらに堅い
    defenseBonus: { walk: 50, fly: 50, swim: 30, cavalry: 40, lightfoot: 70 },
  },
  mountains: {
    id: "mountains",
    name: "Rocky Ground",
    // 本家smallfoot/elusivefoot準拠でコスト3進入可(2026-07-12修正。旧実装は
    // walk進入不可の独自仕様だった)。cavalry/swimは本家mounted/swimmerに岩場の
    // 項目自体が無い=本家でも進入不可のためIMPASSABLEのまま(変更不要)
    moveCost: { walk: 3, fly: 1, swim: IMPASSABLE, cavalry: IMPASSABLE, lightfoot: 3 },
    defenseBonus: { walk: 60, fly: 50, swim: 20, cavalry: 50, lightfoot: 70 },
  },
  shallow_water: {
    id: "shallow_water",
    name: "Shallows",
    // 騎馬はコスト4(歩兵の3より重い。本家mounted準拠 — 2026-07-08 ユーザー実測)。
    // 軽装はコスト2(歩兵より身軽。本家elusivefoot準拠)
    moveCost: { walk: 3, fly: 1, swim: 1, cavalry: 4, lightfoot: 2 },
    // 水中は歩兵の機動を妨げ防御に不利。飛行は地形を無視(50%均一)。
    // 水棲は水流を巧みに使い守りを固める。騎馬も水中では機動を失う。軽装は歩兵より堅い
    defenseBonus: { walk: 20, fly: 50, swim: 60, cavalry: 20, lightfoot: 40 },
  },
  deep_water: {
    id: "deep_water",
    name: "Deep Water",
    moveCost: { walk: IMPASSABLE, fly: 1, swim: 1, cavalry: IMPASSABLE, lightfoot: IMPASSABLE },
    // 歩兵・騎馬・軽装は進入不可(値は参照されない)。飛行は地形を無視(50%均一)。
    // 水棲は深海でも安定した守り
    defenseBonus: { walk: 20, fly: 50, swim: 50, cavalry: 20, lightfoot: 40 },
  },
  obstacle: {
    id: "obstacle",
    name: "Obstacle",
    // 通行不能その1(2026-07-08): フィールド上の遮蔽物(石像等)。本家に対応地形なし。
    // 飛行も越えられない完全な壁(岩場=飛行・軽装のみ可、との差別化)。
    // defenseBonusは到達不能のため参照されない(型の完全性のみ)
    moveCost: { walk: IMPASSABLE, fly: IMPASSABLE, swim: IMPASSABLE, cavalry: IMPASSABLE, lightfoot: IMPASSABLE },
    defenseBonus: { walk: 40, fly: 40, swim: 20, cavalry: 40, lightfoot: 40 },
  },
  void: {
    id: "void",
    name: "Out of Bounds",
    // 通行不能その2(2026-07-08): マップの遊戯領域外(公式の「雲がけ」相当)。本家に対応地形なし。
    // 見た目は雲海で「ここはフィールドではない」を示す
    moveCost: { walk: IMPASSABLE, fly: IMPASSABLE, swim: IMPASSABLE, cavalry: IMPASSABLE, lightfoot: IMPASSABLE },
    defenseBonus: { walk: 40, fly: 40, swim: 20, cavalry: 40, lightfoot: 40 },
  },
  reef: {
    id: "reef",
    name: "Coast",
    // 本家「沿岸の暗礁」の相当。水棲の移動コストは本家reef=2に整理(2026-07-08。
    // 導入時の仮値1から訂正)。騎馬はコスト3(本家mounted準拠 — 2026-07-08 ユーザー実測)。
    // 軽装はコスト2(本家elusivefoot準拠)
    moveCost: { walk: 2, fly: 1, swim: 2, cavalry: 3, lightfoot: 2 },
    // 浅瀬より足場がよく、水棲は岩場を使って最高の守り。飛行は地形を無視(50%均一)。
    // 軽装の防御は本家elusivefoot準拠で50%(2026-07-08。duelist実測の40%から訂正)
    defenseBonus: { walk: 30, fly: 50, swim: 70, cavalry: 30, lightfoot: 50 },
  },
  cave: {
    id: "cave",
    name: "Cave",
    // 本家「洞窟」の相当。天井が低く飛行は本家fly通り移動3・防御20%まで悪化
    // (導入時の仮値から訂正)。水棲も本家通り進入可(移動3・防御20%。導入時は仮に進入不可としていた)。
    // 騎馬はコスト4(本家mounted準拠 — 2026-07-08 ユーザー実測)。軽装はコスト2で歩兵より速い
    moveCost: { walk: 2, fly: 3, swim: 3, cavalry: 4, lightfoot: 2 },
    defenseBonus: { walk: 40, fly: 20, swim: 20, cavalry: 20, lightfoot: 50 },
  },
  swamp: {
    id: "swamp",
    name: "Swamp",
    // 湿地(本家swamp_water準拠)。騎馬はコスト4(歩兵の3より重い。本家mounted準拠 —
    // 2026-07-08 ユーザー実測)。軽装はコスト2で歩兵より速い(本家elusivefoot準拠)
    moveCost: { walk: 3, fly: 1, swim: 1, cavalry: 4, lightfoot: 2 },
    // 歩兵は足を取られ遮蔽もない(防御20%に訂正)。飛行は地形を無視(50%均一)。水棲は自在に動き守りも堅い
    defenseBonus: { walk: 20, fly: 50, swim: 60, cavalry: 20, lightfoot: 40 },
  },
  tochka: {
    id: "tochka",
    name: "Pillbox",
    // 本家「キノコの山」(fungus)の代替。騎馬はコスト4(本家mounted準拠 — 2026-07-08 ユーザー実測)。
    // 軽装はコスト2で歩兵より速い(本家elusivefoot準拠)
    moveCost: { walk: 2, fly: 3, swim: 3, cavalry: 4, lightfoot: 2 },
    // 歩兵は掩体で堅く守られゆっくり進む(防御50%に訂正)。飛行は胞子雲で本家通り大きく悪化
    // (移動3・防御ほぼ0%)。水棲は本家通り進入可(移動3・防御20%。導入時は仮に進入不可としていた)。
    // 騎馬も大きく被弾しやすい(本家mounted準拠。当初の機械的換算=0%から2026-07-08 ユーザー実測で
    // 20%に訂正)。軽装は歩兵よりさらに堅い(本家elusivefoot準拠)
    defenseBonus: { walk: 50, fly: 0, swim: 20, cavalry: 20, lightfoot: 70 },
  },
  village: {
    id: "village",
    name: "Supply Point",
    moveCost: { walk: 1, fly: 1, swim: 1, cavalry: 1, lightfoot: 1 },
    // 建物が歩兵に強固な遮蔽を提供。飛行は地形を無視(50%均一)。
    // 水棲は建物をある程度活用できる。騎馬は狭い路地で機動を失う。軽装は歩兵よりさらに堅い
    defenseBonus: { walk: 60, fly: 50, swim: 40, cavalry: 40, lightfoot: 70 },
  },
  castle: {
    id: "castle",
    // フィクションパス2026-07-07: 城→陣地(idはcastleのまま。増援が展開される高防御区画)
    name: "Camp",
    moveCost: { walk: 1, fly: 1, swim: 1, cavalry: 1, lightfoot: 1 },
    // 石壁が歩兵を強く守る。飛行は地形を無視(50%均一)。
    // 水棲も城壁の恩恵を部分的に受ける。騎馬は城内の狭い通路で機動を失う。軽装は歩兵よりさらに堅い
    defenseBonus: { walk: 60, fly: 50, swim: 40, cavalry: 40, lightfoot: 70 },
  },
  keep: {
    id: "keep",
    // フィクションパス2026-07-07: 主城→フラッグ(旗が立つ象徴地点。リーダーがここに
    // 立つと増援要請=雇用できる。※勝利条件はフラッグ奪取ではなくリーダー撃破 —
    // チュートリアル/UIで明示すること)
    name: "Flag",
    moveCost: { walk: 1, fly: 1, swim: 1, cavalry: 1, lightfoot: 1 },
    // 城と同等の堅牢な防御。騎馬は城と同様に機動を制限される。軽装は歩兵よりさらに堅い
    defenseBonus: { walk: 60, fly: 50, swim: 40, cavalry: 40, lightfoot: 70 },
  },
};

// マップの tiles 文字列 → 地形IDの対応
export const TERRAIN_BY_CHAR: Record<string, string> = {
  g: "grassland",
  f: "forest",
  s: "sand",
  d: "desert",
  h: "hills",
  m: "mountains",
  w: "shallow_water",
  W: "deep_water",
  x: "obstacle",
  z: "void",
  r: "reef",
  u: "cave",
  n: "swamp",
  t: "tochka",
  v: "village",
  c: "castle",
  k: "keep",
};

export function terrainById(id: string): TerrainDef {
  const t = TERRAINS[id];
  if (!t) throw new Error(`unknown terrain: ${id}`);
  return t;
}
