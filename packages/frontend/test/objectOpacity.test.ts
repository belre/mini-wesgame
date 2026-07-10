// 立体物の不透明度規則(lib/board/objects.ts objectOpacity)の仕様固定。
// 可読性フェードの優先順と、fadeModeの実地検証で決まった意味(always/never)を回帰から守る。
// mini-wesgame(2026-07-09): 傾き表示を廃止したため、fadeMode: "tilted" は無くなった。
// 2026-07-10: 「操作性の救済」フェード(revealBehind。選択中に奥の岩・山を0.35まで
// 薄くする機能)は本家Wesnoth準拠のため撤去し、テストからも削除した。
import { describe, expect, it } from "vitest";
import { objectOpacity } from "../src/lib/board/objects";

describe("objectOpacity", () => {
  it("可読性フェード: occludes+占有+always は薄くなる(0.5)", () => {
    expect(
      objectOpacity({ occludes: true, fadeMode: "always" }, { hexOccupied: true }),
    ).toBe(0.5);
  });

  it("fadeMode: never / 非占有 / occludesなし は不透明のまま", () => {
    expect(objectOpacity({ occludes: true, fadeMode: "never" }, { hexOccupied: true })).toBe(1);
    expect(objectOpacity({ occludes: true }, { hexOccupied: false })).toBe(1);
    expect(objectOpacity({}, { hexOccupied: true })).toBe(1);
  });

  it("fadeMode省略はalways扱い(既定)", () => {
    expect(objectOpacity({ occludes: true }, { hexOccupied: true })).toBe(0.5);
  });
});
