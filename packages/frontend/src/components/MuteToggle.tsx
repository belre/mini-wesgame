"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted } from "@/lib/sound";

// 全画面共通のミュート切り替え(右上常設。2026-07-12)。Providersでマウントし、
// 陣営選択画面・盤面のどちらでも同じ位置に出る(position:fixedで両画面の
// 共通祖先を必要としない)
export default function MuteToggle() {
  // 静的書き出しのHTMLは常に「ミュートなし」で生成される(localStorageはビルド時に
  // 存在しない)。ここで直接isMuted()を初期値にするとハイドレーション時に食い違う
  // ことがあるため、まずfalseで描画し、マウント後に実際の保存値へ同期する
  const [muted, setMutedState] = useState(false);
  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  return (
    <button
      className="mute-toggle"
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
      }}
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
