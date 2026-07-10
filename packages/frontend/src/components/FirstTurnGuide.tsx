"use client";

// 1ターン目クリックガイド(2026-07-10)。「今押していい場所」だけを残して
// 他の操作を封じるスポットライト演出。対象はCSSセレクタで指定する:
// - ヘックス: `#${hexElementId(coord)}`(HexGridが各ヘックスの<g>に付与するid)
// - 通常のUI: ボタン等のidやdata属性セレクタ(例: "#board-recruit-button")
// マップが大きくなってもセレクタで対象のDOM要素を探すだけなので、座標計算の
// やり直しは不要(ホールの位置はgetBoundingClientRectで毎フレーム追従する)。
import { useEffect, useState } from "react";

export interface GuideStep {
  targetSelector: string;
  message: string;
}

interface Hole {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const HOLE_PADDING = 8;

export function FirstTurnGuide({
  step,
  onDismiss,
}: {
  // nullの間は何も表示しない。stepがあるがtargetSelectorが空文字("")の場合は
  // 「対象なしの最終メッセージ」(締めの文)として全面ゲートのまま表示する
  step: GuideStep | null;
  // 最終メッセージのOKボタン用(対象なしステップでのみ使う)
  onDismiss?: () => void;
}) {
  const [hole, setHole] = useState<Hole | null>(null);

  useEffect(() => {
    if (!step || !step.targetSelector) {
      setHole(null);
      return;
    }
    let raf: number;
    // パン・ズーム・アニメーション中も対象の画面位置を追従させる(rAFループ)。
    // ガイド表示中だけ回る短命ループなので負荷は無視できる
    const tick = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        setHole({
          left: r.left - HOLE_PADDING,
          top: r.top - HOLE_PADDING,
          right: r.right + HOLE_PADDING,
          bottom: r.bottom + HOLE_PADDING,
        });
      } else {
        setHole(null);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step?.targetSelector]);

  if (!step) return null;

  return (
    <>
      {/* ホールが見つかるまで(or 対象なしステップ)は全面ゲート */}
      <div
        className="guide-scrim"
        style={{ top: 0, left: 0, right: 0, height: hole ? Math.max(0, hole.top) : "100%" }}
      />
      {hole && (
        <>
          <div className="guide-scrim" style={{ top: hole.bottom, left: 0, right: 0, bottom: 0 }} />
          <div
            className="guide-scrim"
            style={{ top: hole.top, height: hole.bottom - hole.top, left: 0, width: Math.max(0, hole.left) }}
          />
          <div
            className="guide-scrim"
            style={{ top: hole.top, height: hole.bottom - hole.top, left: hole.right, right: 0 }}
          />
          <div
            className="guide-hole-ring"
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.right - hole.left,
              height: hole.bottom - hole.top,
            }}
          />
        </>
      )}
      <div className="guide-message">
        <span>{step.message}</span>
        {!step.targetSelector && onDismiss && (
          <button className="primary" onClick={onDismiss}>
            OK
          </button>
        )}
      </div>
    </>
  );
}
