// スプライトパック形式(A-4)のラウンドトリップ検証。
// encode(Node/ビルドスクリプト)と parse(ブラウザ/ランタイム)が同じ実装を
// 共有しているので、往復一致がとれていれば配信形式の互換が保たれる
import { describe, expect, it } from "vitest";
import { encodePack, parsePack } from "../src/lib/assets/packFormat";

describe("スプライトパック形式(PSP1)", () => {
  it("encode → parse で全ファイルがバイト一致で復元できる", () => {
    const files = [
      { path: "/sprites/spearman/idle-1.png", data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) },
      { path: "/sprites/projectiles/fire.png", data: new Uint8Array([255]) },
      { path: "/sprites/halo/日本語パス.png", data: new Uint8Array([]) }, // 空ファイル・非ASCIIも壊れない
    ];
    const buf = encodePack(files);
    const entries = parsePack(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    expect(entries.map((e) => e.path)).toEqual(files.map((f) => f.path));
    entries.forEach((e, i) => {
      expect(new Uint8Array(buf.buffer, e.offset, e.size)).toEqual(files[i].data);
    });
  });

  it("magic不一致は明示的に落ちる", () => {
    expect(() => parsePack(new Uint8Array([0, 1, 2, 3, 0, 0, 0, 0]).buffer)).toThrow(/magic/);
  });
});
