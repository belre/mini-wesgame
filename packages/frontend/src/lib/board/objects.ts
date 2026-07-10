// 地形立体物の配置・深度・表示状態の純関数(React/DOM非依存)。
// HexGrid肥大化の分割+HexGrid/CutInStage間の組み立てロジック重複解消
// (2026-07-08リファクタ)。深度・オフセットの設計判断は skill: board-rendering §2
import {
  hexKey,
  hexNeighbors,
  inBounds,
  TERRAIN_BY_CHAR,
  type GameMap,
  type HexCoord,
} from "@parle-stroika/core-engine";
import type { TerrainObjectDef } from "../anim/model";
import { S } from "./geometry";

// 立体物画像の下端(接地線)のヘックス中心からの距離。中心と下頂点の中間あたり
export const OBJECT_BASELINE_RATIO = 0.55;

// 立体物バリアントの決定的選択。同じヘックス・同じオブジェクトなら常に同じ絵
// (描画のたびに変わらない)。乱数ではなく座標ハッシュを使う
export function variantIndex(x: number, y: number, salt: number, len: number): number {
  if (len <= 1) return 0;
  const h = ((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) >>> 0;
  return h % len;
}

// ハッシュ駆動の[-1,1]値(位置ゆらぎ用)。salt違いでdx/dyを独立に振る
export function hashUnit(x: number, y: number, salt: number): number {
  const h = ((x * 40503) ^ (y * 92837111) ^ (salt * 2654435761)) >>> 0;
  return ((h % 2001) / 1000) - 1;
}

// 立体物エントリのヘックス内配置。固定offset+決定的jitter。
// centerには「ビュー空間の中心」を渡すこと(盤面座標で足すと視点反転で
// dyの奥/手前が裏返る — 2026-07-08修正。焼き込み光源が回らない以上、
// 立体物の画面配置も画面基準が一貫して正しい)
export function objectAnchor(
  center: { cx: number; cy: number },
  obj: { offset?: { dx: number; dy: number }; jitter?: { dx: number; dy: number } },
  hexX: number,
  hexY: number,
  salt: number,
): { cx: number; cy: number } {
  const jx = obj.jitter ? obj.jitter.dx * hashUnit(hexX, hexY, salt * 2 + 1) : 0;
  const jy = obj.jitter ? obj.jitter.dy * hashUnit(hexX, hexY, salt * 2 + 2) : 0;
  return {
    cx: center.cx + ((obj.offset?.dx ?? 0) + jx) * S,
    cy: center.cy + ((obj.offset?.dy ?? 0) + jy) * S,
  };
}

// keepの陣営割当(表示用)。エンジンの初期化と同じ規則: 走査順(上→下、左→右)で
// 見つかった keep をプレイヤー0、1に割り当てる(data/maps.ts のコメント参照)。
// 旗の陣営色(TerrainObjectDef.ownerVariant)がこれを参照する
export function keepOwnerIndex(map: GameMap, c: HexCoord): number | undefined {
  let idx = 0;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (TERRAIN_BY_CHAR[map.tiles[y][x]] !== "keep") continue;
      if (x === c.x && y === c.y) return idx;
      idx++;
    }
  }
  return undefined;
}

// 立体物の不透明度。可読性フェード: 占有ユニットを隠す立体物(occludes)を
// fadeModeに従って薄く(always=常時 / never=しない)。抜きすぎない値(0.5)にして
// ユニットの視認と「森に隠れている」空気を両立する(2026-07-08 実地評価)。
// かつて存在した「操作性の救済」フェード(選択中に奥のハイライトを見せるため
// 岩・山を0.35まで薄くする機能)は本家Wesnothに準拠する形で撤去した
// (2026-07-10。クリック自体は立体物がpointerEvents:noneのため元々素通しで、
// 選択のたびに山が消えたように見える方が実害が大きいとユーザー判断)
const FADE_OCCUPIED = 0.5;

export function objectOpacity(
  obj: Pick<TerrainObjectDef, "occludes" | "fadeMode">,
  opts: { hexOccupied: boolean },
): number {
  const mode = obj.fadeMode ?? "always";
  if (obj.occludes && opts.hexOccupied && mode === "always") {
    return FADE_OCCUPIED;
  }
  return 1;
}

// 深度ソートに参加する立体物アイテム(ユニットと同じ列に混ぜて投影後yで並べる)
export interface TerrainObjectItem {
  kind: "object";
  key: string;
  hexKey: string;
  obj: TerrainObjectDef;
  oi: number;
  c: HexCoord;
  pp: { cx: number; cy: number; scale: number };
  y: number;
  ownerIndex?: number;
}

// ビュー空間のアンカー1点をそのまま足元位置(pp)にする(平面固定・scale常に1)。
// villageの占領旗などbuildTerrainObjectItemsを通らない動的オブジェクトも使う
export function projectObjectAnchor(
  viewCenter: { cx: number; cy: number },
  obj: TerrainObjectDef,
  c: HexCoord,
  oi: number,
): { cx: number; cy: number; scale: number } {
  return { ...objectAnchor(viewCenter, obj, c.x, c.y, oi), scale: 1 };
}

// 地形立体物アイテムの組み立て(HexGridとCutInStageの共通実装。
// かつて両者にコピペされ差分事故の温床だったため一本化 — 2026-07-08)
export function buildTerrainObjectItems(opts: {
  map: GameMap;
  cells: readonly HexCoord[];
  // ビュー変換済みの中心(視点反転を吸収する)。投影原点はレンダラーごとに違う
  // (HexGrid=盤面中央 / CutInStage=戦闘の中点)
  viewCenter: (c: HexCoord) => { cx: number; cy: number };
  // 立体物定義の解決(devプレビューの上書き→コンテンツパックの順は呼び出し側が握る)
  getObjects: (c: HexCoord, terrainId: string) => readonly TerrainObjectDef[] | undefined;
}): TerrainObjectItem[] {
  return opts.cells.flatMap((c) => {
    const terrainId = TERRAIN_BY_CHAR[opts.map.tiles[c.y][c.x]];
    const objects = opts.getObjects(c, terrainId);
    if (!objects?.length) return [];
    const key = hexKey(c);
    // 陣営色バリアント(旗)用の帰属解決。ownerVariantを使うエントリがある地形のみ計算
    const ownerIndex = objects.some((o) => o.ownerVariant)
      ? keepOwnerIndex(opts.map, c)
      : undefined;
    return objects.map((obj, oi) => {
      // clusterPull: 同地形の隣の重心へ寄せた点をアンカーの基準にする(片寄せ)
      const base = opts.viewCenter(c);
      const pullVec = obj.clusterPull
        ? clusterPullVec(opts.map, c, terrainId, opts.viewCenter, obj.clusterPull)
        : { dx: 0, dy: 0 };
      const pp = projectObjectAnchor(
        { cx: base.cx + pullVec.dx, cy: base.cy + pullVec.dy },
        obj, c, oi,
      );
      return {
        kind: "object" as const,
        key: `${key}#${oi}`,
        hexKey: key,
        obj,
        oi,
        c,
        pp,
        y: pp.cy,
        ownerIndex,
      };
    });
  });
}

// 縁ロジック(2026-07-08 本番昇格): ヘックスの文脈で立体物セットを選ぶ。
// - interior(全ての盤内隣接が同地形) → interiorObjects(密な絵)
// - isolated(同地形の隣がゼロ)      → interiorObjects(孤立ヘックスこそ強い絵で
//   「森なのか平地なのか」を一目にする)
// - boundary(同地形と異地形が混在)  → objects(片寄せ等の端表現)
export function pickTerrainObjects(
  def: { objects?: readonly TerrainObjectDef[]; interiorObjects?: readonly TerrainObjectDef[] },
  map: GameMap,
  c: HexCoord,
  terrainId: string,
): readonly TerrainObjectDef[] | undefined {
  if (!def.interiorObjects) return def.objects;
  const neighbors = hexNeighbors(c).filter((n) => inBounds(map, n));
  const same = neighbors.filter((n) => TERRAIN_BY_CHAR[map.tiles[n.y][n.x]] === terrainId).length;
  const boundary = same > 0 && same < neighbors.length;
  return boundary ? def.objects : def.interiorObjects;
}

// clusterPull の方向計算: 同地形の隣接ヘックスの重心方向(ビュー空間)。
// 単位ベクトル×pull×S を返す。同地形の隣がなければゼロ(中央のまま)
export function clusterPullVec(
  map: GameMap,
  c: HexCoord,
  terrainId: string,
  viewCenter: (c: HexCoord) => { cx: number; cy: number },
  pull: number,
): { dx: number; dy: number } {
  const vc = viewCenter(c);
  let dx = 0;
  let dy = 0;
  for (const n of hexNeighbors(c)) {
    if (!inBounds(map, n) || TERRAIN_BY_CHAR[map.tiles[n.y][n.x]] !== terrainId) continue;
    const q = viewCenter(n);
    dx += q.cx - vc.cx;
    dy += q.cy - vc.cy;
  }
  const len = Math.hypot(dx, dy);
  if (len < 1) return { dx: 0, dy: 0 };
  return { dx: (dx / len) * pull * S, dy: (dy / len) * pull * S };
}
