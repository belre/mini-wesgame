// チュートリアルのガイド発火判定(純粋関数)。
// ガイドのデータは data/tutorials/*.json、表示と「表示済み」の管理はクライアント側
// (TutorialMatchView)が担う。ここは「この盤面でどのガイドが発火するか」だけを判定する。
import { hexEquals } from "./hex";
import type { MatchState, TutorialGuide, TutorialScript } from "./types";

// 単一ガイドの発火判定
// - turn: 人間側の手番で、ターン番号が指定値以上になったとき(>= なので取りこぼさない。
//   「一度だけ表示」は呼び出し側が shownIds で管理する)
// - hex: 自軍ユニットが指定ヘックスのいずれかの上にいるとき(移動・雇用どちらで乗ってもよい)
export function guideTriggered(
  guide: TutorialGuide,
  state: MatchState,
  humanIndex: number,
): boolean {
  const trigger = guide.trigger;
  switch (trigger.type) {
    case "turn":
      return (
        state.activePlayer === humanIndex &&
        state.turnNumber >= trigger.turnNumber
      );
    case "hex":
      return state.units.some(
        (u) =>
          u.owner === humanIndex &&
          trigger.hexes.some((h) => hexEquals(u.pos, h)),
      );
  }
}

// 未表示(shownIdsに含まれない)かつ発火条件を満たすガイドを、定義順で返す
export function firedGuides(
  script: TutorialScript,
  state: MatchState,
  humanIndex: number,
  shownIds: ReadonlySet<string>,
): TutorialGuide[] {
  return script.guides.filter(
    (g) => !shownIds.has(g.id) && guideTriggered(g, state, humanIndex),
  );
}
