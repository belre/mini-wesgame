import { hexDistance } from "../hex";
import type { GameMap, HexCoord, TerrainDef } from "../types";
import { TERRAIN_BY_CHAR, terrainById } from "./terrain";
import valleyCrossingJson from "./maps/valley_crossing.json";
import freelandsMiniJson from "./maps/freelands_mini.json";

// マップの実体は data/maps/*.json(純粋なデータ)。
// 現段階ではビルド時にバンドルして読む(クライアント/サーバーのバージョン一致を保証)。
// デプロイ時には同じJSONがS3の maps/ プレフィックスにアップロードされる(infra参照)。
// 将来S3から動的ロードに切り替える際の方針は docs/architecture.md を参照。
//
// タイル文字: 'k' = keep(主城)、'c' = castle(雇用配置先)。
// keep は走査順(上→下、左→右)でプレイヤー0、プレイヤー1に割り当てられる。

// JSONは手編集されうるデータのため、ロード時に整合性を検証する
function validateMap(map: GameMap): GameMap {
  if (map.tiles.length !== map.height) {
    throw new Error(`map ${map.id}: height ${map.height} != tiles rows ${map.tiles.length}`);
  }
  map.tiles.forEach((row, y) => {
    if (row.length !== map.width) {
      throw new Error(`map ${map.id}: row ${y} width ${row.length} != ${map.width}`);
    }
    for (const char of row) {
      if (!TERRAIN_BY_CHAR[char]) {
        throw new Error(`map ${map.id}: unknown tile char '${char}' at row ${y}`);
      }
    }
  });
  return map;
}

export const VALLEY_CROSSING: GameMap = validateMap(valleyCrossingJson as GameMap);
// 本家「The Freelands」の横幅縮小移植(2026-07-09。scripts/等の変換手順はコミットログ参照)
export const FREELANDS_MINI: GameMap = validateMap(freelandsMiniJson as GameMap);

export const MAPS: Record<string, GameMap> = {
  [VALLEY_CROSSING.id]: VALLEY_CROSSING,
  [FREELANDS_MINI.id]: FREELANDS_MINI,
};

export function mapById(id: string): GameMap {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

export function inBounds(map: GameMap, c: HexCoord): boolean {
  return c.x >= 0 && c.x < map.width && c.y >= 0 && c.y < map.height;
}

export function terrainAt(map: GameMap, c: HexCoord): TerrainDef {
  if (!inBounds(map, c)) throw new Error(`out of bounds: ${c.x},${c.y}`);
  const char = map.tiles[c.y][c.x];
  const id = TERRAIN_BY_CHAR[char];
  if (!id) throw new Error(`unknown tile char: ${char}`);
  return terrainById(id);
}

export interface MapMeta {
  keeps: HexCoord[]; // index = プレイヤーindex
  castlesByPlayer: HexCoord[][]; // 各プレイヤーの雇用配置先(最寄りのkeepで割当)
}

const metaCache = new Map<string, MapMeta>();

// タイル文字列を走査して keep / castle の座標を導出する。
// castle は最寄りの keep のプレイヤーに帰属する。
export function mapMeta(map: GameMap): MapMeta {
  const cached = metaCache.get(map.id);
  if (cached) return cached;

  const keeps: HexCoord[] = [];
  const castles: HexCoord[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const char = map.tiles[y][x];
      if (char === "k") keeps.push({ x, y });
      if (char === "c") castles.push({ x, y });
    }
  }
  if (keeps.length !== 2) {
    throw new Error(`map ${map.id} must have exactly 2 keeps, got ${keeps.length}`);
  }
  const castlesByPlayer: HexCoord[][] = [[], []];
  for (const c of castles) {
    const d0 = hexDistance(c, keeps[0]);
    const d1 = hexDistance(c, keeps[1]);
    castlesByPlayer[d0 <= d1 ? 0 : 1].push(c);
  }
  const meta = { keeps, castlesByPlayer };
  metaCache.set(map.id, meta);
  return meta;
}
