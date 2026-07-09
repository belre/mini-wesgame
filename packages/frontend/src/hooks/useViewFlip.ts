"use client";

// 盤面の向き(ビュー反転)のユーザー設定。
// 既定は「自陣を背にして戦場を見る」構図(boardViewFlippedFor: 青=180度回転)で、
// このフックはそれを打ち消す/かける「反転の上書き」をXORで重ねる
// (青軍は押すと素の向きに戻り、赤軍は押すと180度回転する)。
// 盤面(BoardScreen)とカットイン(useCutIn)が同じ値を見る必要があるため、
// モジュールレベルの共有ストア+useSyncExternalStoreで全購読者を同期させる。
// 設定はlocalStorageで永続化(陣営をまたいで「既定の構図が好みでない」が引き継がれる)
import { useSyncExternalStore } from "react";
import { boardViewFlippedFor } from "@/lib/tilt";

const STORAGE_KEY = "ps_view_flip_invert";
let inverted: boolean | null = null; // null = localStorage未読(クライアント初回に読む)
const listeners = new Set<() => void>();

function readInverted(): boolean {
  if (inverted === null) {
    inverted =
      typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";
  }
  return inverted;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useViewFlip(myIndex: number): {
  viewFlipped: boolean;
  toggleViewFlip: () => void;
} {
  // SSRスナップショットはfalse(既定構図)。クライアントで保存値が反映される
  const inv = useSyncExternalStore(subscribe, readInverted, () => false);
  return {
    viewFlipped: boardViewFlippedFor(myIndex) !== inv, // XOR
    toggleViewFlip: () => {
      inverted = !readInverted();
      localStorage.setItem(STORAGE_KEY, inverted ? "1" : "0");
      listeners.forEach((l) => l());
    },
  };
}
