"use client";

// 地形(polygon)専用の傾けコンテナ。傾きはこの中にだけ適用する。
// 外側のdivでrotateX+perspectiveを2Dへ平坦化してから(transform-styleの既定値がflatなので
// 自動的に平坦化される)、さらに外側のdivで平面回転(rotate)を重ねて右斜め方向の傾きにする。
// スプライト・文字はこの外側にビルボードとして重ね、lib/tilt.tsのprojectTiltで
// 同じ投影計算をJS側で再現して位置だけ動かす
import type { ReactNode } from "react";
import { PERSPECTIVE_PX, TILT_TRANSFORM } from "@/lib/tilt";

export default function TiltStage({
  tilted,
  diagonalDeg,
  children,
}: {
  tilted: boolean;
  diagonalDeg: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: tilted ? `rotate(${diagonalDeg}deg)` : undefined,
        transformOrigin: "center center",
        transition: "transform 0.3s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: tilted ? PERSPECTIVE_PX : undefined,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: tilted ? TILT_TRANSFORM : undefined,
            transformOrigin: "center center",
            transition: "transform 0.3s ease",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
