// ユニットの組み込み1枚絵(フォールバック用)の生成スクリプト。
// fetch-demo-sprites.mjs の末尾から呼ばれる(単体実行: npx tsx scripts/generate-unit-base-images.mts)。
//
// UNIT_SPRITES の各 base 画像(立ち絵の代表1枚)を src/generated/unit-base/ にコピーし、
// 静的importの索引(unitBaseImages.ts)を生成する。静的importなのでNext.jsのバンドルに
// 取り込まれ、アプリ自身(/_next/static/)から配信される — CDNやpublic/spritesの取得に
// 失敗したときのフォールバック(円文字の置き換え)がCDN障害時にも機能する。
// 生成物はGPLアセットを含むためコミットしない(.gitignore: src/generated/)
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { UNIT_SPRITES } from "../src/lib/content/units";

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPRITES = join(FRONTEND, "public", "sprites");
const OUT_DIR = join(FRONTEND, "src", "generated", "unit-base");
const OUT_MODULE = join(FRONTEND, "src", "generated", "unitBaseImages.ts");

await mkdir(OUT_DIR, { recursive: true });

const imports: string[] = [];
const entries: string[] = [];
let i = 0;
for (const [spriteKey, def] of Object.entries(UNIT_SPRITES)) {
  // def.base は "/sprites/<dir>/<file>.png"(Node実行時はASSET_BASE="")
  const rel = def.base.replace(/^\/sprites\//, "");
  if (rel === def.base) throw new Error(`baseが/sprites/配下でない: ${spriteKey} -> ${def.base}`);
  const safe = spriteKey.replaceAll("/", "_") + ".png";
  await copyFile(join(SPRITES, rel.replaceAll("/", "\\")), join(OUT_DIR, safe)).catch(
    async () => copyFile(join(SPRITES, rel), join(OUT_DIR, safe)),
  );
  imports.push(`import img${i} from "./unit-base/${safe}";`);
  entries.push(`  "${spriteKey}": img${i}.src,`);
  i++;
}

const moduleSource = `// 自動生成: scripts/generate-unit-base-images.mts(手で編集しない・コミットしない)
// spriteKey → 組み込み1枚絵(base立ち絵)のバンドルURL。
// 静的importによりNext.jsのバンドルに含まれ、アプリ自身から配信される
// (スプライトのプリロード失敗時のフォールバック用。lib/sprites.tsが参照)
${imports.join("\n")}

export const UNIT_BASE_IMAGES: Record<string, string> = {
${entries.join("\n")}
};
`;
await writeFile(OUT_MODULE, moduleSource);
console.log(`generated ${i} unit base images -> src/generated/`);
