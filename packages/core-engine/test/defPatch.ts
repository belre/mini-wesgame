// テスト用: 登録済みUnitDefを一時的に書き換え、復元用の関数を返す。
//
// 現在のユニットデータには担い手がいないルール機構
// (狂戦berserk・装甲steadfast・伏兵ambush・多選択昇格など。knalgan陣営の無効化や
// ユニット再編で担い手が消えた)のエンジンテストカバレッジを維持するために使う。
// エンジンは能力・攻撃をレジストリ(getUnitDef)経由で読むため、
// 合成defではなく登録済みdefの一時書き換えが必要。
//
// 必ず afterAll / finally で復元関数を呼ぶこと(vitestはファイル単位で
// プロセス分離されるため、復元漏れの影響は同一ファイル内に留まるが、
// 後続テストの前提を壊す)。
import { getUnitDef } from "../src/data/factions";
import type { UnitDef } from "../src/types";

export function patchUnitDef(
  unitDefId: string,
  mutate: (def: UnitDef) => void,
): () => void {
  const def = getUnitDef(unitDefId);
  const backup = structuredClone(def);
  mutate(def);
  return () => {
    for (const key of Object.keys(def)) {
      if (!(key in backup)) {
        delete (def as unknown as Record<string, unknown>)[key];
      }
    }
    Object.assign(def, backup);
  };
}
