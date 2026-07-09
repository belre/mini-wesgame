// 立体物の不透明度規則(lib/board/objects.ts objectOpacity)の仕様固定。
// 2条件(revealBehind > 可読性フェード > 不透明)の優先順と、fadeModeの
// 実地検証で決まった意味(always/never)を回帰から守る。
// mini-wesgame(2026-07-09): 傾き表示を廃止したため、fadeMode: "tilted" は無くなった。
import { describe, expect, it } from "vitest";
import { objectOpacity } from "../src/lib/board/objects";

describe("objectOpacity", () => {
  it("revealBehind(操作性の救済)は fadeMode: never の岩にも掛かる", () => {
    expect(
      objectOpacity({ occludes: true, fadeMode: "never" }, { hexOccupied: false, revealBehind: true }),
    ).toBe(0.35);
  });

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

  it("フェード値の分離: reveal=0.35(強く抜く) / 占有=0.5(抜きすぎない)", () => {
    expect(
      objectOpacity({ occludes: true, fadeMode: "always" }, { hexOccupied: true, revealBehind: true }),
    ).toBe(0.35); // 両条件成立時はrevealが優先
  });
});
