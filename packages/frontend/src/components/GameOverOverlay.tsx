"use client";

// 試合終了時のオーバーレイ(2026-07-10)。盤面をブラー+暗転させた上に
// 結果と次のアクションを重ねる。BoardScreenのchildrenスロット(盤面の上・
// Loading画面の下位置)に差し込むが、z-indexで両方より前面に出す。

export type GameOverOutcome = "victory" | "defeat" | "draw";

const TITLE: Record<GameOverOutcome, string> = {
  victory: "🎉 Victory!",
  defeat: "Defeat...",
  draw: "Draw",
};

const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;
const X_INVITE_URL = process.env.NEXT_PUBLIC_X_INVITE_URL;

export function GameOverOverlay({
  outcome,
  onRematch,
}: {
  outcome: GameOverOutcome;
  onRematch: () => void;
}) {
  return (
    <div className="game-over-overlay">
      <div className="game-over-card">
        <div className="game-over-title">{TITLE[outcome]}</div>
        <div className="game-over-actions">
          <button className="game-over-banner-btn primary" onClick={onRematch}>
            🔄 Rematch
          </button>
          {/* 本家Battle for Wesnothへのクレジット・敬意表明リンク(2026-07-10) */}
          <a
            className="game-over-banner-btn link-button"
            href="https://www.wesnoth.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            🏰 Inspired by Battle for Wesnoth ↗
          </a>
          {/* コミュニティ招待リンク(2026-07-10)。URLは.envで指定、未設定時は非表示 */}
          {DISCORD_INVITE_URL && (
            <a
              className="game-over-banner-btn link-button"
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 Join the Discord Server ↗
            </a>
          )}
          {X_INVITE_URL && (
            <a
              className="game-over-banner-btn link-button"
              href={X_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              🐦 Follow on X ↗
            </a>
          )}
        </div>

        {/* 広告枠モック(docs/backlog.md「CPU戦特化・広告モデル案」向けの置き場イメージ確認用。
            サイズはAdMob標準バナー320x50相当。実装ではなくレイアウト検討のためのプレースホルダー */}
        <div className="game-over-ad-mocks">
          <div className="game-over-ad-mock">Ad banner placeholder 2</div>
          <div className="game-over-ad-mock">Ad banner placeholder 3</div>
        </div>
      </div>
    </div>
  );
}
