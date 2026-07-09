"use client";

// カットインの結線フック(A-6項目5): BoardScreenを持つ各ビュー(リモート対戦・
// CPU練習・チュートリアル)が2行で組み込める形にまとめる。
//   const cutIn = useCutIn(board?.mapId);
//   <BoardScreen ... onCombatPlayback={cutIn.onCombatPlayback}>{cutIn.stage}</BoardScreen>
//
// - 見栄え評価のため ON/OFF をゲーム内トグル(盤面右上)で切替できる
//   (localStorage永続。カットインの採否が決まったら整理する)
// - OFF時はonCombatPlaybackをundefinedにする=BoardScreenが従来どおり盤面内で再生
// - 再生ポリシー: onCombatPlaybackに流れてくる戦闘のみ=自分の手+CPUの手。
//   リモート対戦の相手の手は戦闘イベントが取れず流れてこないため、設計方針
//   「相手ターンの後追いでは再生しない」(design_diorama.md)と自然に一致する
import { useEffect, useState, type ReactNode } from "react";
import { mapById, type TimeOfDayDef } from "@parle-stroika/core-engine";
import {
  useCombatAnimations,
  type CombatPlaybackInput,
} from "@/hooks/useCombatAnimations";
import { replayToPlayback, type AttackedEntry } from "@/lib/anim/replay";
import CutInStage from "@/components/CutInStage";

const STORAGE_KEY = "ps_cutin_mode";

export function useCutIn(
  mapId: string | undefined,
  myIndex: number,
  timeOfDay: TimeOfDayDef, // 戦況要約(summarizeCombatMoments)のダメージ試算に使う
): {
  onCombatPlayback?: (input: CombatPlaybackInput) => void;
  // 相手ターンログ(被攻撃)のリプレイ再生。ユーザーの明示操作なので
  // カットインOFF設定でも再生する(再生中だけステージが出る)
  playReplay: (entry: AttackedEntry) => void;
  stage: ReactNode;
} {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "off") setOn(false);
  }, []);
  // 盤面内アニメ(BoardScreen内蔵)とは別の第2再生インスタンス
  const { fx, enqueue, current } = useCombatAnimations();

  const stage: ReactNode = mapId ? (
    <>
      {/* OFF設定でも再生中(=明示操作のリプレイ)はステージを出す */}
      {(on || current !== null) && (
        <CutInStage
          map={mapById(mapId)}
          fx={fx}
          current={current}
          myIndex={myIndex}
          timeOfDay={timeOfDay}
        />
      )}
      {/* モード切替(評価用)。カットインの背面レイヤーはpointer-events:noneなので
          再生中も押せる。Loading画面(z30)の下、カットイン(z20)の上 */}
      <button
        onClick={() =>
          setOn((prev) => {
            const next = !prev;
            localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
            return next;
          })
        }
        style={{
          position: "absolute",
          right: 6,
          top: 6,
          zIndex: 25,
          fontSize: 11,
          padding: "2px 8px",
          opacity: 0.85,
        }}
        title="Toggle combat cut-in"
      >
        ⚔ Cut-in: {on ? "ON" : "OFF"}
      </button>
    </>
  ) : null;

  return {
    onCombatPlayback: on ? enqueue : undefined,
    playReplay: (entry) => {
      const input = replayToPlayback(entry);
      if (input) enqueue(input);
    },
    stage,
  };
}
