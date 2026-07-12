"use client";

// UIフィードバック音(素材はCC0/自作。ライセンス表記は public/sounds/CREDITS.txt)。
// 短いWAVを都度新規Audioインスタンスで再生する: 連打時も前の再生を止めずに重ねて鳴らせる
function playOneShot(src: string, volume: number): void {
  if (typeof window === "undefined") return;
  const audio = new Audio(src);
  audio.volume = volume;
  // 自動再生ポリシー等での失敗は無視する(音が鳴らないだけで操作自体は継続できる)
  void audio.play().catch(() => {});
}

// ボタン押下(click.wavより高く短い)
export function playClickSound(): void {
  playOneShot("/sounds/click.wav", 0.5);
}

// ユニット選択(click.wavより鈍い音で区別する)
export function playUnitSelectSound(): void {
  playOneShot("/sounds/select.wav", 0.5);
}

// 自分のターン開始(簡単な太鼓の一打)
export function playTurnStartSound(): void {
  playOneShot("/sounds/turn-start.wav", 0.6);
}
