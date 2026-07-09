"use client";

// スクリーン空間のパン/ズーム(傾け盤面用のカメラ操作)。
// 投影後の絵全体をtranslate/scaleする: 1本指/マウスドラッグ=パン、
// 2本指ピンチ=ズーム+重心パン、ホイール=ズーム。
// デモ(/dev/sprites)の地平面座標へ逆変換する方式と違い、投影後の2D変換なので
// 地形レイヤーとビルボードレイヤーの同期ズレが構造的に起きない。
//
// クリックとの共存(検証済みの落とし穴):
// - pointerdown時点でsetPointerCaptureするとclickがヘックスに届かなくなる
//   (キャプチャ要素へ再ターゲットされる)ため、ドラッグ確定(6px)まで遅延させる
// - スマホはコンテナに touch-action: none が無いと1本指がページスクロールに取られる
//   (呼び出し側でstyleに指定する)
// - ドラッグ/ピンチ後のclick誤発火は didDragRef を見て呼び出し側が抑止する
import { useEffect, useRef, useState } from "react";

export interface ScreenView {
  x: number;
  y: number;
  scale: number;
}

// initialView: 有効化時の初期カメラを呼び出し側が決める(コンテナ実寸を渡して計算してもらう)。
// 未指定は従来どおり原点。BoardScreenは「自軍リーダーが画面内に入る位置」を返す。
// resetKey: 値が変わるたびに初期カメラを取り直す(盤面の向き反転など、座標系が変わる操作用)
export function useScreenPanZoom(
  enabled: boolean,
  initialView?: (container: { width: number; height: number }) => ScreenView,
  resetKey?: unknown,
) {
  const [view, setView] = useState<ScreenView>({ x: 0, y: 0, scale: 1 });
  const scaleRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const isDragging = useRef(false);
  const didDragRef = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const pinchDist = useRef(0);
  const lastCentroid = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 最新のinitialViewを参照する(エフェクトの再実行はenabled切替時だけに保つ)
  const initialViewRef = useRef(initialView);
  initialViewRef.current = initialView;

  // 有効化(モード切替)のたびに初期表示へリセット
  useEffect(() => {
    const el = containerRef.current;
    const init =
      enabled && el && initialViewRef.current
        ? initialViewRef.current({ width: el.clientWidth, height: el.clientHeight })
        : { x: 0, y: 0, scale: 1 };
    setView(init);
    scaleRef.current = init.scale;
    pointers.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resetKey]);

  // ホイールズーム(ReactのonWheelはpassive登録でpreventDefaultできないため手動登録)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.max(0.3, Math.min(3, scaleRef.current * factor));
      scaleRef.current = next;
      setView((v) => ({ ...v, scale: next }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [enabled]);

  const centroidAndDist = () => {
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { cx, cy, dist };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      isDragging.current = false;
      didDragRef.current = false;
      last.current = { x: e.clientX, y: e.clientY };
    } else {
      // 2本目以降: ピンチ開始。両ポインタをキャプチャ(ピンチはクリック対象外)
      for (const id of pointers.current.keys()) {
        try {
          e.currentTarget.setPointerCapture(id);
        } catch {
          // 既に解放されたポインタ等は無視
        }
      }
      isDragging.current = false;
      const { cx, cy, dist } = centroidAndDist();
      lastCentroid.current = { x: cx, y: cy };
      pinchDist.current = dist;
      didDragRef.current = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.current.size >= 2) {
      // ピンチ: 距離比でズーム + 重心の移動でパン
      const { cx, cy, dist } = centroidAndDist();
      if (pinchDist.current > 0 && dist > 0) {
        const next = Math.max(0.3, Math.min(3, scaleRef.current * (dist / pinchDist.current)));
        scaleRef.current = next;
        setView((v) => ({
          x: v.x + cx - lastCentroid.current.x,
          y: v.y + cy - lastCentroid.current.y,
          scale: next,
        }));
      }
      pinchDist.current = dist;
      lastCentroid.current = { x: cx, y: cy };
      return;
    }
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    if (!isDragging.current) {
      if (Math.hypot(dx, dy) < 6) return;
      isDragging.current = true;
      didDragRef.current = true;
      // ドラッグ確定時に初めてキャプチャ(単純クリックはヘックスに素通しさせる)
      e.currentTarget.setPointerCapture(e.pointerId);
      last.current = { x: e.clientX, y: e.clientY };
      return;
    }
    last.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      // 2本→1本: 残った指を単独パンの起点に取り直す(ジャンプ防止)
      const rest = [...pointers.current.values()][0];
      last.current = { x: rest.x, y: rest.y };
      isDragging.current = true;
      pinchDist.current = 0;
      return;
    }
    if (pointers.current.size > 0) return;
    pinchDist.current = 0;
    isDragging.current = false;
  };

  return {
    view,
    containerRef,
    didDragRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
