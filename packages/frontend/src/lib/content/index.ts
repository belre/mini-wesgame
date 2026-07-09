// コンテンツパック本体: 陣営別のスプライト定義表を統合し、
// SpriteRegistry(定義解決インターフェース)の既定実装を提供する。
// 別バージョン・キャンペーンでは別のコンテンツパックを注入して差し替えられる
import type { SpriteRegistry, TerrainSpriteDef } from "../anim/model";
import { UNIT_SPRITES } from "./units";

// spriteKey → ユニットスプライト定義(実体は ./units.ts。Nodeスクリプトからの
// import経路を分けるための分離 — units.ts のコメント参照)
export { UNIT_SPRITES };

// terrain id(data/terrain.ts の TerrainDef.id) → 地形スプライト定義。
// ground = 傾きに追従する地面タイル(下から重ね描き)、objects = 立体物ビルボード
// (ジオラマPhase B。ユニットと同じ深度ソートに参加する。まだ全地形が ground のみ:
//  AI生成タイルセット(docs/design/diorama_pipeline.md)が揃い次第 objects を足す)。
// 未登録の地形id・アセット未取得時は従来の色polygonへフォールバック。
// Wesnothの地形タイルは隣接地形とのブレンド(自動タイリング)を持つものが多いが、
// grassland(単一の平坦なタイル)はブレンド不要なのでまずこれだけ試す
// 自作素材(AI生成パイプライン産。assets-pipeline/参照)はrepoにコミットされ、
// アプリ自身のpublic/から配信する(ASSET_BASEを付けない=CDN移行の判断はA-4で)。
// アンカー: assets-pipeline/anchors/grassland_v1.png(2026-07-06確定)
// mini-wesgame(2026-07-08 移植): 地形はWesnoth準拠のタイルを使用する。
// fetch-demo-sprites.mjs の terrain グループ(*-tile.png=エディタ用の単体ヘックス
// 代表画像。ブレンド不要で使える)をそのまま敷く。
// 森は本家と同じ「草の下地+森オーバーレイ」の2層。
// アートのない地形(岩場以外の新地形群)は色ポリゴンにフォールバックする(仕様)
import { ASSET_BASE } from "./shared";

const T = (n: string) => `${ASSET_BASE}/sprites/terrain/${n}`;
const WESNOTH_GRASS = T("grass-green.png");

export const TERRAIN_SPRITES: Record<string, TerrainSpriteDef> = {
  grassland: { ground: [WESNOTH_GRASS] },
  forest: { ground: [WESNOTH_GRASS, T("forest-tile.png")] },
  hills: { ground: [T("hills-tile.png")] },
  // 2026-07-10: mountains/basic.pngは地面を塗りつぶす絵ではなく本家準拠の
  // 立体物(峰オブジェクト)。岩がちな丘(hills-tile)の上に峰を立てる構図にする
  mountains: {
    ground: [T("hills-tile.png")],
    objects: [
      {
        srcs: [T("mountains-basic.png"), T("mountains-basic2.png"), T("mountains-basic3.png")],
        occludes: true,
        mirror: true,
        offset: { dx: 0, dy: 2 },
      },
    ],
  },
  sand: { ground: [T("sand-beach-tile.png")] },
  desert: { ground: [T("sand-desert-tile.png")] },
  shallow_water: { ground: [T("shallow-water-tile.png")] },
  deep_water: { ground: [T("deep-water-tile.png")] },
  // 2026-07-10: village/human.pngも同様に立体物(家屋オブジェクト)。草原の上に建物を置く構図
  village: {
    ground: [WESNOTH_GRASS],
    objects: [
      {
        srcs: [T("village-human.png"), T("village-human2.png"), T("village-human3.png"), T("village-human4.png")],
        occludes: true,
        offset: { dx: 0, dy: 0 },
      },
    ],
  },
  castle: { ground: [[T("castle-floor.png"), T("castle-floor2.png"), T("castle-floor3.png")]] },
  keep: { ground: [T("keep-floor.png")] },
  // swamp / reef / cave / tochka / obstacle / void は色ポリゴンフォールバック
};

// このプロジェクトの既定コンテンツパック(SpriteRegistry実装)
export const SPRITE_REGISTRY: SpriteRegistry = {
  getUnitSprite: (spriteKey) => UNIT_SPRITES[spriteKey],
  getTerrainSprite: (terrainId) => TERRAIN_SPRITES[terrainId],
};
