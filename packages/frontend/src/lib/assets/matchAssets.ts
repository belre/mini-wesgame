// 対戦アセット計画(Loading画面の土台): 「この対戦を表示するために何を
// ダウンロードすべきか」を定義表から導出する純関数(React/DOM非依存)。
//
// ここが配信レイヤーとLoading画面の間の抽象境界になる:
// - 計画の項目は「ユニットのスプライト一式」「地形タイル一式」という論理単位で、
//   CDN上の物理配置(個別PNG/将来のスプライトシート化)はここに現れない。
//   配信形態を変える場合(backlog A-4)もこのインターフェースは維持する
// - ダウンロードの実行と進捗管理は hooks/useMatchAssets.ts(ブラウザ層)が担う
import {
  getFaction,
  mapById,
  terrainAt,
  type MatchState,
} from "@parle-stroika/core-engine";
import { TERRAIN_SPRITES, UNIT_SPRITES } from "../content";

export type MatchAssetItem =
  // ユニット1種×チームカラー1色分のスプライト一式(standing/idle+攻撃系)
  | { kind: "unit"; spriteKey: string; owner: number; label: string }
  // 地形1種のタイルレイヤー一式
  | { kind: "terrain"; terrainId: string; label: string };

// 項目の同一性キー(重複排除・進捗記録用)
export function matchAssetKey(item: MatchAssetItem): string {
  return item.kind === "unit"
    ? `unit:${item.spriteKey}#${item.owner}`
    : `terrain:${item.terrainId}`;
}

// 対戦開始時に両陣営分をまとめてロードする方針(2026-07-06決定)なので、
// 盤上の現存ユニットではなく「両プレイヤーの陣営の全ユニット」を対象にする。
// これにより霧の中から現れた敵や対戦中の雇用・昇格でポップ(円→スプライト)が起きない。
// スプライト定義のないユニット・地形は円/色polygonフォールバックが仕様なので計画に含めない
export function planMatchAssets(
  state: Pick<MatchState, "players" | "mapId">,
): MatchAssetItem[] {
  const items: MatchAssetItem[] = [];
  const seen = new Set<string>();
  const push = (item: MatchAssetItem) => {
    const key = matchAssetKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  };

  state.players.forEach((player, owner) => {
    for (const unit of getFaction(player.factionId).units) {
      if (UNIT_SPRITES[unit.spriteKey]) {
        push({ kind: "unit", spriteKey: unit.spriteKey, owner, label: unit.name });
      }
    }
  });

  const map = mapById(state.mapId);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const terrain = terrainAt(map, { x, y });
      if (TERRAIN_SPRITES[terrain.id]) {
        push({ kind: "terrain", terrainId: terrain.id, label: terrain.name });
      }
    }
  }

  return items;
}

// この対戦で読むべきスプライトパック(A-4)のID列。パックは spriteKey の
// 第2セグメント("units/<dir>/...")単位で作られる(build-sprite-packs.mts)ため、
// プレイヤーの陣営IDではなく「ロスターが実際に参照するディレクトリ」の集合を返す
// (陣営間で共有されるユニット — 反乱軍のマーマン=units/loyalists/ 等 — を取り漏らさない。
// 昇格先は同一ディレクトリに置かれる運用なのでロスター起点で足りる)
export function planSpritePacks(state: Pick<MatchState, "players">): string[] {
  const dirs = new Set<string>();
  for (const player of state.players) {
    for (const unit of getFaction(player.factionId).units) {
      const seg = unit.spriteKey.split("/");
      if (seg[0] === "units" && seg[1] && UNIT_SPRITES[unit.spriteKey]) dirs.add(seg[1]);
    }
  }
  return [...dirs];
}
