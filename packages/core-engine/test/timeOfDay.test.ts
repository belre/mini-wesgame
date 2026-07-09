import { describe, expect, it } from "vitest";
import {
  STANDARD_CYCLE,
  alignmentMultiplier,
  expandSchedule,
  getCurrentTimeOfDay,
  TIME_OF_DAY_DEFS,
  timeOfDayForTurn,
} from "../src/timeOfDay";

describe("expandSchedule", () => {
  it("標準サイクルは6フェーズに展開される", () => {
    expect(expandSchedule(STANDARD_CYCLE)).toEqual([
      "dawn",
      "morning",
      "afternoon",
      "dusk",
      "first_watch",
      "second_watch",
    ]);
  });

  it("turns>1のフェーズは繰り返される", () => {
    expect(
      expandSchedule({
        id: "long_night",
        phases: [
          { timeOfDay: "dusk", turns: 1 },
          { timeOfDay: "first_watch", turns: 3 },
        ],
      }),
    ).toEqual(["dusk", "first_watch", "first_watch", "first_watch"]);
  });
});

describe("getCurrentTimeOfDay", () => {
  const expanded = expandSchedule(STANDARD_CYCLE);

  it("サイクルは周回する", () => {
    expect(getCurrentTimeOfDay(expanded, 0, 0)).toBe("dawn");
    expect(getCurrentTimeOfDay(expanded, 0, 6)).toBe("dawn");
    expect(getCurrentTimeOfDay(expanded, 0, 7)).toBe("morning");
  });

  it("startIndexで開始位置をずらせる(夜スタート等)", () => {
    expect(getCurrentTimeOfDay(expanded, 4, 0)).toBe("first_watch");
  });
});

describe("timeOfDayForTurn", () => {
  it("ターン1(1始まり)は先頭フェーズ", () => {
    expect(timeOfDayForTurn("standard_cycle", 0, 1).id).toBe("dawn");
    expect(timeOfDayForTurn("standard_cycle", 0, 2).id).toBe("morning");
    expect(timeOfDayForTurn("standard_cycle", 0, 7).id).toBe("dawn");
  });
});

describe("alignmentMultiplier", () => {
  it("neutralは常に1.0", () => {
    expect(alignmentMultiplier("neutral", TIME_OF_DAY_DEFS.morning)).toBe(1);
    expect(alignmentMultiplier("neutral", TIME_OF_DAY_DEFS.first_watch)).toBe(1);
  });

  it("lawfulは昼+25% / 夜-25%", () => {
    expect(alignmentMultiplier("lawful", TIME_OF_DAY_DEFS.morning)).toBe(1.25);
    expect(alignmentMultiplier("lawful", TIME_OF_DAY_DEFS.first_watch)).toBe(0.75);
    expect(alignmentMultiplier("lawful", TIME_OF_DAY_DEFS.dawn)).toBe(1);
  });
});
