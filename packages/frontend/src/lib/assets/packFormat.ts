// スプライトパックのバイナリ形式(A-4 画像配信改善。2026-07-08 初回実装)。
// 目的はリクエスト数の削減: 数百の個別PNGを「陣営単位の1ファイル」に連結し、
// CDNへのAPIコールを 対戦あたり数百 → 陣営数(+リトライ) に落とす。
// 画像バイト自体は既にPNG圧縮済みなので再圧縮はしない(転送圧縮はCDN/HTTP層に任せる)。
//
// レイアウト(PSP1):
//   [0..4)   magic "PSP1"
//   [4..8)   index長 N (uint32 LE)
//   [8..8+N) index JSON (utf8): { files: [{ path, offset, size }] }
//            path = 定義が参照するURL(ASSET_BASEなし。例 "/sprites/spearman/idle-1.png")
//            offset = ペイロード先頭(8+N)からの相対バイト位置
//   [8+N..)  ペイロード(全ファイルのバイト列を連結)
//
// encode/parse は純関数(DOM非依存)にして、ビルドスクリプト(Node)と
// ランタイム(ブラウザ)とテスト(vitest)で同じ実装を共有する

export interface PackEntry {
  path: string;
  offset: number;
  size: number;
}

const MAGIC = "PSP1";

export function encodePack(files: { path: string; data: Uint8Array }[]): Uint8Array {
  const entries: PackEntry[] = [];
  let offset = 0;
  for (const f of files) {
    entries.push({ path: f.path, offset, size: f.data.byteLength });
    offset += f.data.byteLength;
  }
  const index = new TextEncoder().encode(JSON.stringify({ files: entries }));
  const out = new Uint8Array(8 + index.byteLength + offset);
  out.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(out.buffer).setUint32(4, index.byteLength, true);
  out.set(index, 8);
  let pos = 8 + index.byteLength;
  for (const f of files) {
    out.set(f.data, pos);
    pos += f.data.byteLength;
  }
  return out;
}

// 戻り値の offset はバッファ先頭からの絶対位置に直して返す(呼び出し側がそのままslice可能)
export function parsePack(buf: ArrayBuffer): PackEntry[] {
  const view = new DataView(buf);
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
  if (magic !== MAGIC) throw new Error(`スプライトパックではない(magic=${magic})`);
  const indexLen = view.getUint32(4, true);
  const index = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buf, 8, indexLen)),
  ) as { files: PackEntry[] };
  const payloadStart = 8 + indexLen;
  return index.files.map((f) => ({ ...f, offset: payloadStart + f.offset }));
}
