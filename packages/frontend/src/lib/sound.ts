"use client";

// ボタンクリック音(CC0素材。ライセンス表記は public/sounds/CREDITS.txt)。
// 短いWAVを都度新規Audioインスタンスで再生する: 連打時も前の再生を止めずに重ねて鳴らせる
const CLICK_SRC = "/sounds/click.wav";

export function playClickSound(): void {
  if (typeof window === "undefined") return;
  const audio = new Audio(CLICK_SRC);
  audio.volume = 0.5;
  // 自動再生ポリシー等での失敗は無視する(音が鳴らないだけで操作自体は継続できる)
  void audio.play().catch(() => {});
}
