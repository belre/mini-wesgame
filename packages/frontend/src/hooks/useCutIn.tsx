"use client";

// カットインの結線フック(A-6項目5): BoardScreenを持つ各ビュー(リモート対戦・
// CPU練習・チュートリアル)が2行で組み込める形にまとめる。
//   const cutIn = useCutIn(board?.mapId);
//   <BoardScreen ... onCombatPlayback={cutIn.onCombatPlayback}>{cutIn.stage}</BoardScreen>
//
// - 見栄え評価のため OFF/平面/傾き をゲーム内トグル(盤面右上)で切替できる
//   (localStorage永続。カットインの採否・形式が決まったら整理する)
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
import { useViewFlip } from "@/hooks/useViewFlip";
import CutInStage from "@/components/CutInStage";

type CutInMode = "off" | "flat" | "tilted";
const MODE_LABEL: Record<CutInMode, string> = { off: "OFF", flat: "平面", tilted: "傾き" };
const NEXT_MODE: Record<CutInMode, CutInMode> = { off: "flat", flat: "tilted", tilted: "off" };
const STORAGE_KEY = "ps_cutin_mode";

export function useCutIn(
  mapId: string | undefined,
  myIndex: number, // 視点。本盤面と同じビュー変換(青視点は180度回転)をカットインにも適用する
  timeOfDay: TimeOfDayDef, // 戦況要約(summarizeCombatMoments)のダメージ試算に使う
): {
  onCombatPlayback?: (input: CombatPlaybackInput) => void;
  // 相手ターンログ(被攻撃)のリプレイ再生。ユーザーの明示操作なので
  // カットインOFF設定でも再生する(再生中だけステージが出る)
  playReplay: (entry: AttackedEntry) => void;
  stage: ReactNode;
} {
  const [mode, setMode] = useState<CutInMode>("flat");
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "off" || saved === "flat" || saved === "tilted") setMode(saved);
  }, []);
  // 盤面内アニメ(BoardScreen内蔵)とは別の第2再生インスタンス
  const { fx, enqueue, current } = useCombatAnimations();
  // 盤面の向き(ユーザー設定込み)。BoardScreenのトグルと同じ共有ストアを購読する
  const { viewFlipped } = useViewFlip(myIndex);

  const stage: ReactNode = mapId ? (
    <>
      {/* OFF設定でも再生中(=明示操作のリプレイ)はステージを出す */}
      {(mode !== "off" || current !== null) && (
        <CutInStage
          map={mapById(mapId)}
          fx={fx}
          current={current}
          tilted={mode === "tilted"}
          viewFlipped={viewFlipped}
          myIndex={myIndex}
          timeOfDay={timeOfDay}
        />
      )}
      {/* モード切替(評価用)。カットインの背面レイヤーはpointer-events:noneなので
          再生中も押せる。Loading画面(z30)の下、カットイン(z20)の上 */}
      <button
        onClick={() =>
          setMode((m) => {
            const next = NEXT_MODE[m];
            localStorage.setItem(STORAGE_KEY, next);
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
        title="戦闘カットインの表示(見栄え評価用)"
      >
        ⚔ カットイン: {MODE_LABEL[mode]}
      </button>
    </>
  ) : null;

  return {
    onCombatPlayback: mode === "off" ? undefined : enqueue,
    playReplay: (entry) => {
      const input = replayToPlayback(entry);
      if (input) enqueue(input);
    },
    stage,
  };
}
