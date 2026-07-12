"use client";

import { useEffect } from "react";
import { playClickSound } from "@/lib/sound";

// 全ボタンのクリックに共通のフィードバック音を鳴らす(2026-07-12)。
// 個別ボタンへ都度配線せず、document委譲リスナーで一括対応する
// (新しいボタンを増やしても対応漏れが起きない)。盤面のヘックス/ユニット
// クリック(<button>ではない)は対象外(ユーザー方針: ボタンのみ)
export default function ClickSoundListener() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (button && !button.disabled) playClickSound();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
