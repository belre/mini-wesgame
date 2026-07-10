"use client";

// カットインの結線フック(A-6項目5): BoardScreenを持つ各ビュー(リモート対戦・
// CPU練習・チュートリアル)が2行で組み込める形にまとめる。
//   const cutIn = useCutIn(board?.mapId);
//   <BoardScreen ... onCombatPlayback={cutIn.onCombatPlayback}>{cutIn.stage}</BoardScreen>
//
// - カットインは常時ON(2026-07-10 見栄え評価完了。トグルは撤去)
// - 再生ポリシー: onCombatPlaybackに流れてくる戦闘のみ=自分の手+CPUの手。
//   リモート対戦の相手の手は戦闘イベントが取れず流れてこないため、設計方針
//   「相手ターンの後追いでは再生しない」(design_diorama.md)と自然に一致する
import type { ReactNode } from "react";
import { mapById, type TimeOfDayDef } from "@parle-stroika/core-engine";
import {
  useCombatAnimations,
  type CombatPlaybackInput,
} from "@/hooks/useCombatAnimations";
import { replayToPlayback, type AttackedEntry } from "@/lib/anim/replay";
import CutInStage from "@/components/CutInStage";

export function useCutIn(
  mapId: string | undefined,
  myIndex: number,
  timeOfDay: TimeOfDayDef, // 戦況要約(summarizeCombatMoments)のダメージ試算に使う
): {
  onCombatPlayback?: (input: CombatPlaybackInput) => void;
  // 相手ターンログ(被攻撃)のリプレイ再生。ユーザーの明示操作
  playReplay: (entry: AttackedEntry) => void;
  stage: ReactNode;
} {
  // 盤面内アニメ(BoardScreen内蔵)とは別の第2再生インスタンス
  const { fx, enqueue, current } = useCombatAnimations();

  const stage: ReactNode = mapId ? (
    <CutInStage
      map={mapById(mapId)}
      fx={fx}
      current={current}
      myIndex={myIndex}
      timeOfDay={timeOfDay}
    />
  ) : null;

  return {
    onCombatPlayback: enqueue,
    playReplay: (entry) => {
      const input = replayToPlayback(entry);
      if (input) enqueue(input);
    },
    stage,
  };
}
