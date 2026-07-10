// itch.io向けパッケージ作成の後処理。単体実行: node scripts/prepare-itch-build.mjs
// (npm run build:itch から呼ばれる。事前に ITCH_BUILD=1 next build 済みであること)
//
// itch.ioはHTML zipの中身をドメイン直下ではなく不定のサブパスに展開して配信するため、
// Next.jsの既定である絶対パス("/_next/...")は404になる。ITCH_BUILD=1でビルドすると
// next.config.tsのassetPrefixが"./"になり全参照が相対パスになるが、それだけでは
// ネストしたページ(dev/cutin.html・tutorial/basic_battle.html等、out/直下から見て
// 1階層下)で「そのファイル自身のディレクトリ」基準の相対解決になってしまい、
// _next/がさらに1つ上の階層にあることを表現できない。
// そこで各HTMLの<head>に、そのファイルの深さぶんの<base href="../..."> を注入し、
// 相対パス解決の基準を「out/のルート」に統一する(深さ0の直下ページはbase不要)。
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "out");

async function walkHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkHtmlFiles(full)));
    } else if (entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

const files = await walkHtmlFiles(OUT_DIR);
let injected = 0;
for (const file of files) {
  const depth = relative(OUT_DIR, dirname(file)).split(sep).filter(Boolean).length;
  if (depth === 0) continue; // 直下のページはassetPrefix("./")のままで正しく解決される
  const base = "../".repeat(depth);
  const html = await readFile(file, "utf8");
  if (html.includes("<base ")) continue; // 二重注入防止(再実行時)
  const updated = html.replace("<head>", `<head><base href="${base}">`);
  if (updated === html) {
    throw new Error(`<head>が見つからない: ${file}`);
  }
  await writeFile(file, updated);
  injected++;
}
console.log(`<base href>を${injected}件のHTMLへ注入しました(out/直下からの深さ分だけ相対解決の基準をずらす)`);
