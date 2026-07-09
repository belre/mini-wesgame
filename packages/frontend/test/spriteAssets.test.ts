// スプライト定義とアセット取得スクリプトの整合性テスト。
//
// UNIT_SPRITES/TERRAIN_SPRITES(コンテンツ層)が参照する全画像が、
// fetch-demo-sprites.mjs のダウンロード対象に含まれることを検証する。
// かつて両者は手動で二重管理されており、乖離すると「定義はあるのに画像が無い →
// プリロード失敗でユニットが円のまま/非表示」という発見しづらいバグになった
// (実例: walking_corpse の zombie-attack.png 取得漏れでゾンビが盤面から消えた)。
//
// 逆方向(取得しているが定義から参照されていない)は意図的に許容する
// (pillager-base のような将来用の先行取得があるため)。
//
// 自作素材(/terrain-diorama/。AI生成パイプライン産でrepoにコミット済み)は
// fetch対象ではないため、public/ 配下にファイルが実在することを検証する。
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_GROUPS } from "../scripts/fetch-demo-sprites.mjs";
import { allSpriteImages } from "../src/lib/anim/assets";
import { TERRAIN_SPRITES, UNIT_SPRITES } from "../src/lib/content";

interface FetchFile {
  remote?: string;
  local?: string;
}

// fetchスクリプトが書き出すローカルパス("<dir>/<file>.png")の集合
function fetchedPaths(): Set<string> {
  const set = new Set<string>();
  for (const group of ASSET_GROUPS as { out: string; files: (string | FetchFile)[] }[]) {
    const dir = basename(group.out);
    for (const f of group.files) {
      const local = typeof f === "string" ? f : f.local!;
      set.add(`${dir}/${local}`);
    }
  }
  return set;
}

// 定義が参照する画像URL("/sprites/<dir>/<file>.png"。テスト環境ではASSET_BASE="")を
// "<dir>/<file>.png" に正規化する
function referencedPaths(): Map<string, string[]> {
  const refs = new Map<string, string[]>(); // path -> 参照元spriteKeyの一覧
  const add = (url: string, source: string) => {
    // バンドル済み自作アセット(src/assets/。静的import): vitest(vite)では
    // ファイルパス由来のURLに変換される。実在チェック(参照切れはビルドでも落ちるが、
    // テストの方がエラーが読みやすい)
    const bundled = url.match(/assets\/terrain-diorama\/([^?]+)/);
    if (bundled) {
      expect(
        existsSync(join(import.meta.dirname, "../src/assets/terrain-diorama", bundled[1])),
        `バンドル対象アセットが存在しない: ${url} (${source})`,
      ).toBe(true);
      return;
    }
    // コミット済み自作アセット(public/。候補・温存): ファイルの実在を検証する
    const own = url.match(/^\/terrain-diorama\/(.+)$/);
    if (own) {
      expect(
        existsSync(join(import.meta.dirname, "../public/terrain-diorama", own[1])),
        `コミット済みアセットが存在しない: ${url} (${source})`,
      ).toBe(true);
      return;
    }
    const m = url.match(/^\/sprites\/(.+)$/);
    expect(m, `画像URLが/sprites/でも/terrain-diorama/でも始まらない: ${url} (${source})`).not.toBeNull();
    const path = m![1];
    refs.set(path, [...(refs.get(path) ?? []), source]);
  };
  for (const [key, def] of Object.entries(UNIT_SPRITES)) {
    for (const url of allSpriteImages(def)) add(url, key);
  }
  for (const [terrainId, def] of Object.entries(TERRAIN_SPRITES)) {
    const groundUrls = def.ground.flatMap((l) => (typeof l === "string" ? [l] : l));
    const urls = [...groundUrls, ...(def.objects?.flatMap((o) => o.srcs) ?? [])];
    for (const url of urls) add(url, `terrain:${terrainId}`);
  }
  return refs;
}

describe("スプライト定義とfetchスクリプトの整合性", () => {
  it("定義が参照する全画像がダウンロード対象に含まれる", () => {
    const fetched = fetchedPaths();
    const missing: string[] = [];
    for (const [path, sources] of referencedPaths()) {
      if (!fetched.has(path)) {
        missing.push(`${path} (参照元: ${[...new Set(sources)].join(", ")})`);
      }
    }
    expect(missing, `fetch-demo-sprites.mjsに取得エントリーがない画像:\n${missing.join("\n")}`).toEqual([]);
  });
});
