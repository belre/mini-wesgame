"use client";

// 移動アニメーションの演出層。
// 確定盤面(ユニットの論理位置)は即時反映のまま、「表示位置」だけを
// 経路に沿って1ヘックス200ms(Wesnothエンジン既定値)でスライドさせる。
// 非同期ゲームなのでアニメ中も操作はブロックしない(クリック判定は論理位置)。
// 単一のrequestAnimationFrameループで全ユニットのアニメを更新する。
import { useCallback, useEffect, useRef, useState } from "react";
import type { HexCoord } from "@parle-stroika/core-engine";
import { hexCenter } from "@/lib/board/geometry";
import { MOVE_MS_PER_HEX } from "./animationTiming";

export interface PixelPos {
  cx: number;
  cy: number;
}

interface RunningAnim {
  pts: PixelPos[];
  start: number; // performance.now()
  total: number; // ms
}

export function useMoveAnimations(): {
  // アニメ中ユニットの表示位置(HexGridはこれがあれば論理位置の代わりに使う)
  animatedPositions: ReadonlyMap<string, PixelPos>;
  playMove: (unitId: string, path: HexCoord[]) => void;
} {
  const [positions, setPositions] = useState<ReadonlyMap<string, PixelPos>>(
    new Map(),
  );
  const animsRef = useRef(new Map<string, RunningAnim>());
  const rafRef = useRef(0);
  const runningRef = useRef(false);

  const loop = useCallback((now: number) => {
    const anims = animsRef.current;
    const next = new Map<string, PixelPos>();
    for (const [unitId, a] of anims) {
      // rAFのタイムスタンプはstart取得時点より過去がありうるため0〜totalにクランプ
      const t = Math.max(0, Math.min(a.total, now - a.start));
      if (t >= a.total) {
        anims.delete(unitId); // 完了: 以後は論理位置で描画される
        continue;
      }
      const seg = Math.max(
        0,
        Math.min(a.pts.length - 2, Math.floor(t / MOVE_MS_PER_HEX)),
      );
      const f = t / MOVE_MS_PER_HEX - seg;
      const p = a.pts[seg];
      const q = a.pts[seg + 1];
      next.set(unitId, {
        cx: p.cx + (q.cx - p.cx) * f,
        cy: p.cy + (q.cy - p.cy) * f,
      });
    }
    setPositions(next);
    if (anims.size > 0) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      runningRef.current = false;
    }
  }, []);

  const playMove = useCallback(
    (unitId: string, path: HexCoord[]) => {
      if (path.length < 2) return;
      const pts = path.map(hexCenter);
      animsRef.current.set(unitId, {
        pts,
        start: performance.now(),
        total: (path.length - 1) * MOVE_MS_PER_HEX,
      });
      // 開始位置を同期的に反映しておく。rAFの初回コールバック(次のフレーム)を
      // 待つ間、animatedPositionsにこのユニットの分がまだ無いためHexGridは
      // 論理位置(=既に更新済みの目標ヘックス)で描画してしまい、目標地点に
      // 一瞬だけちらついて見える(flicker)。呼び出し側もuseLayoutEffectで
      // 盤面更新と同じコミットに揃えることで、このちらつきをペイント前に解消する
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(unitId, pts[0]);
        return next;
      });
      if (!runningRef.current) {
        runningRef.current = true;
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [loop],
  );

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { animatedPositions: positions, playMove };
}
