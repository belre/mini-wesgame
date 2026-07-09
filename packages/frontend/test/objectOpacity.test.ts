// 立体物の不透明度規則(lib/board/objects.ts objectOpacity)の仕様固定。
// 3条件(revealBehind > 可読性フェード > 不透明)の優先順と、fadeModeの
// 実地検証で決まった意味(always/tilted/never)を回帰から守る
import { describe, expect, it } from "vitest";
import { objectOpacity } from "../src/lib/board/objects";

describe("objectOpacity", () => {
  it("revealBehind(操作性の救済)は fadeMode: never の岩にも掛かる", () => {
    expect(
      objectOpacity({ occludes: true, fadeMode: "never" }, { hexOccupied: false, tilted: true, revealBehind: true }),
    ).toBe(0.35);
  });

  it("可読性フェード: occludes+占有+always は表示モードによらず薄くなる(0.5)", () => {
    for (const tilted of [true, false]) {
      expect(
        objectOpacity({ occludes: true, fadeMode: "always" }, { hexOccupied: true, tilted }),
      ).toBe(0.5);
    }
  });

  it("fadeMode: tilted は傾き表示のみ(平面では自分が消えるため)", () => {
    const obj = { occludes: true, fadeMode: "tilted" as const };
    expect(objectOpacity(obj, { hexOccupied: true, tilted: true })).toBe(0.5);
    expect(objectOpacity(obj, { hexOccupied: true, tilted: false })).toBe(1);
  });

  it("fadeMode: never / 非占有 / occludesなし は不透明のまま", () => {
    expect(objectOpacity({ occludes: true, fadeMode: "never" }, { hexOccupied: true, tilted: true })).toBe(1);
    expect(objectOpacity({ occludes: true }, { hexOccupied: false, tilted: true })).toBe(1);
    expect(objectOpacity({}, { hexOccupied: true, tilted: true })).toBe(1);
  });

  it("fadeMode省略はalways扱い(既定)", () => {
    expect(objectOpacity({ occludes: true }, { hexOccupied: true, tilted: false })).toBe(0.5);
  });

  it("フェード値の分離: reveal=0.35(強く抜く) / 占有=0.5(抜きすぎない)", () => {
    expect(
      objectOpacity({ occludes: true, fadeMode: "always" }, { hexOccupied: true, tilted: true, revealBehind: true }),
    ).toBe(0.35); // 両条件成立時はrevealが優先
  });
});
