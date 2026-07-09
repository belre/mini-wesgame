// チュートリアルのシナリオデータ。実体は data/tutorials/*.json(マップと同じ方針:
// 純粋なJSONデータをビルド時にバンドルし、手編集のtypoはロード時の検証で検出する)。
// ガイドの追加・文言修正はJSONを編集するだけでよい(型は types.ts の TutorialScript)。
import type { TutorialScript } from "../types";
import { getFaction } from "./factions";
import { inBounds, mapById } from "./maps";
import basicBattleJson from "./tutorials/basic_battle.json";

// JSONは手編集されうるデータのため、ロード時に整合性を検証する
function validateTutorial(script: TutorialScript): TutorialScript {
  const map = mapById(script.mapId); // 存在しないマップならここでthrow
  getFaction(script.playerFactionId);
  getFaction(script.cpuFactionId);
  const ids = new Set<string>();
  for (const guide of script.guides) {
    if (ids.has(guide.id)) {
      throw new Error(`tutorial ${script.id}: duplicate guide id '${guide.id}'`);
    }
    ids.add(guide.id);
    const t = guide.trigger;
    if (t.type === "turn") {
      if (!Number.isInteger(t.turnNumber) || t.turnNumber < 1) {
        throw new Error(`tutorial ${script.id}/${guide.id}: invalid turnNumber`);
      }
    } else if (t.type === "hex") {
      if (t.hexes.length === 0) {
        throw new Error(`tutorial ${script.id}/${guide.id}: hex trigger needs hexes`);
      }
    } else {
      throw new Error(
        `tutorial ${script.id}/${guide.id}: unknown trigger type '${(t as { type: string }).type}'`,
      );
    }
    const hexes = [
      ...(t.type === "hex" ? t.hexes : []),
      ...(guide.highlightHexes ?? []),
    ];
    for (const h of hexes) {
      if (!inBounds(map, h)) {
        throw new Error(
          `tutorial ${script.id}/${guide.id}: hex (${h.x},${h.y}) out of bounds`,
        );
      }
    }
  }
  return script;
}

export const BASIC_BATTLE: TutorialScript = validateTutorial(
  basicBattleJson as unknown as TutorialScript,
);

export const TUTORIALS: Record<string, TutorialScript> = {
  [BASIC_BATTLE.id]: BASIC_BATTLE,
};

export function tutorialById(id: string): TutorialScript {
  const t = TUTORIALS[id];
  if (!t) throw new Error(`unknown tutorial: ${id}`);
  return t;
}
