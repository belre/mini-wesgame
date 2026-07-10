"use client";

// 試合終了時のオーバーレイ(2026-07-10)。盤面をブラー+暗転させた上に
// 結果と次のアクションを重ねる。BoardScreenのchildrenスロット(盤面の上・
// Loading画面の下位置)に差し込むが、z-indexで両方より前面に出す。
import { UNIT_BASE_IMAGES } from "@/generated/unitBaseImages";

export type GameOverOutcome = "victory" | "defeat" | "draw";

const TITLE: Record<GameOverOutcome, string> = {
  victory: "🎉 Victory!",
  defeat: "Defeat...",
  draw: "Draw",
};

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
        </div>

        {/* 広告枠モック(docs/backlog.md「CPU戦特化・広告モデル案」向けの置き場イメージ確認用。
            サイズはAdMob標準バナー320x50相当。実装ではなくレイアウト検討のためのプレースホルダー。
            1枠だけ「アイコン+タイトル+サブテキスト」の実データ風にして質感を比較できるようにする */}
        <div className="game-over-ad-mocks">
          {/* 遷移先はモックなので実在サービスを指さない予約ドメイン(example.com)を使う */}
          <a
            className="game-over-ad-mock game-over-ad-mock--filled"
            href="https://example.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={UNIT_BASE_IMAGES["units/loyalists/swordsman"]} alt="" />
            <div className="game-over-ad-mock-text">
              <div className="game-over-ad-mock-title">Example Game Title</div>
              <div className="game-over-ad-mock-sub">Install now · Ad</div>
            </div>
          </a>
          <div className="game-over-ad-mock">Ad banner placeholder 2</div>
          <div className="game-over-ad-mock">Ad banner placeholder 3</div>
        </div>
      </div>
    </div>
  );
}
