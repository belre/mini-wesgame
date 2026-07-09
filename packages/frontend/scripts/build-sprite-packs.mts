// スプライトパックのビルド(A-4 画像配信改善。単体実行: npx tsx scripts/build-sprite-packs.mts)。
//
// 陣営ごとに「その陣営の全ユニット定義が参照する画像」を1ファイルに連結し、
// public/packs/units-<factionId>.psp を出力する(形式は src/lib/assets/packFormat.ts)。
// 前提: fetch-demo-sprites.mjs 実行済み(public/sprites/ に個別PNGがあること)。
//
// - 生成物はGPLのWesnoth素材を含むためコミットしない(.gitignore: public/packs/)
// - CDNへのアップロードはユーザーが行う(docs/asset_delivery.md の手順参照)。
//   NEXT_PUBLIC_SPRITE_PACK_BASE を配置先に向ければランタイムが使い始める
// - 陣営間で共有される画像(共用の飛び道具・halo等)は各パックに重複して入る(v1の割り切り。
//   重複は数十KB規模で、共通パックを分けるAPIコール1回の方が高くつく場合もある。
//   最適化はSonnet引き継ぎ項目 — docs/asset_delivery.md)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allSpriteImages } from "../src/lib/anim/assets";
import { encodePack } from "../src/lib/assets/packFormat";
import { UNIT_SPRITES } from "../src/lib/content/units";

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(FRONTEND, "public", "packs");

await mkdir(OUT_DIR, { recursive: true });

// 陣営 = spriteKey の第2セグメント("units/<faction>/...")。
// FACTIONS.units(雇用ロスター)ではなく UNIT_SPRITES 全定義から拾うこと:
// 昇格先ユニット(dark_sorcerer等)やリーダー専用機はロスターに載っておらず、
// ロスター起点だとパックから漏れる(2026-07-08 実測: チュートリアルのCPUリーダーで
// 個別リクエストが35件漏れた)
const byFaction = new Map<string, Set<string>>();
for (const [spriteKey, def] of Object.entries(UNIT_SPRITES)) {
  const seg = spriteKey.split("/");
  if (seg[0] !== "units" || !seg[1]) throw new Error(`spriteKeyが units/<faction>/ 形式でない: ${spriteKey}`);
  const set = byFaction.get(seg[1]) ?? new Set<string>();
  for (const url of allSpriteImages(def)) set.add(url);
  byFaction.set(seg[1], set);
}

let totalFiles = 0;
let totalBytes = 0;
for (const [factionId, pathSet] of byFaction) {
  // Node実行時は ASSET_BASE="" なので定義URLは "/sprites/..." そのまま
  const paths = [...pathSet];
  const files = [];
  for (const path of paths) {
    if (!path.startsWith("/sprites/")) {
      throw new Error(`/sprites/配下でない参照はパック対象外: ${path}`);
    }
    files.push({ path, data: new Uint8Array(await readFile(join(FRONTEND, "public", path))) });
  }
  const pack = encodePack(files);
  const out = join(OUT_DIR, `units-${factionId}.psp`);
  await writeFile(out, pack);
  totalFiles += files.length;
  totalBytes += pack.byteLength;
  console.log(
    `units-${factionId}.psp: ${files.length}ファイル → 1リクエスト (${(pack.byteLength / 1024 / 1024).toFixed(2)}MB)`,
  );
}
console.log(
  `合計: ${totalFiles}リクエスト → ${byFaction.size}リクエスト (${(totalBytes / 1024 / 1024).toFixed(2)}MB)`,
);
