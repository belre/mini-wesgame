"use client";

// 戦闘アニメーションの再生ドライバ。
// シーン計算はlib/anim/combatTimeline.ts(純粋関数)に委譲し、このフックは
// 「キュー管理 + rAFで時計を進めて sceneAt(t) を反映する」だけの薄い層。
// - 確定盤面は即時反映のまま、表示だけを時間差で見せる。操作はブロックしない
// - 複数の戦闘(CPUが連続で攻撃した場合など)はキューで順番に再生する
import { useCallback, useEffect, useRef, useState } from "react";
import { getUnitDef } from "@parle-stroika/core-engine";
import { hexCenter } from "@/lib/board/geometry";
import {
  EMPTY_COMBAT_FX,
  compileCombatPlayback,
  type CombatFx,
  type CombatPlaybackInput,
  type CombatPopup,
  type CombatTimelineDeps,
  type EffectSprite,
} from "@/lib/anim/combatTimeline";
import { SPRITE_REGISTRY } from "@/lib/sprites";

export type { CombatFx, CombatPlaybackInput, CombatPopup, EffectSprite };

// 本盤面用の既定deps: 盤面ジオメトリとコンテンツ(スプライト定義表)の注入。
// combatTimeline自体はどの定義表・座標系にも結合しないため、カットイン等の
// 別レンダラーは自分の座標系のhexCenterを持つdepsを渡して同じフックを使い回せる
export const BOARD_COMBAT_DEPS: CombatTimelineDeps = {
  hexCenter,
  spriteOf: (unitDefId) =>
    SPRITE_REGISTRY.getUnitSprite(getUnitDef(unitDefId).spriteKey),
};

export function useCombatAnimations(deps: CombatTimelineDeps = BOARD_COMBAT_DEPS): {
  fx: CombatFx;
  enqueue: (input: CombatPlaybackInput) => void;
  // 再生中の戦闘の入力(なければnull)。カットイン等のレンダラーが
  // 「どの戦闘を描いているか」(地形範囲・登場ユニット)を知るために公開する
  current: CombatPlaybackInput | null;
} {
  const [fx, setFx] = useState<CombatFx>(EMPTY_COMBAT_FX);
  const [current, setCurrent] = useState<CombatPlaybackInput | null>(null);
  const queueRef = useRef<CombatPlaybackInput[]>([]);
  const playingRef = useRef(false);
  const rafRef = useRef(0);
  // 呼び出し側がdepsをインラインで組んでも安全なよう、最新値をrefで参照する
  // (startNextはuseCallback([])のため、直接参照すると初回レンダーの値に固定される)
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const startNext = useCallback(() => {
    const input = queueRef.current.shift();
    if (!input) {
      playingRef.current = false;
      setFx(EMPTY_COMBAT_FX);
      setCurrent(null);
      return;
    }
    playingRef.current = true;
    setCurrent(input);
    const playback = compileCombatPlayback(input, depsRef.current);
    const begin = performance.now();
    const step = (now: number) => {
      // rAFのタイムスタンプの巻き戻り対策で0〜totalにクランプ
      const t = Math.max(0, Math.min(playback.totalMs, now - begin));
      setFx(playback.sceneAt(t));
      if (t < playback.totalMs) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        startNext(); // 次の戦闘へ(なければEMPTYに戻る)
      }
    };
    // 初回フレーム(t≈0)を同期的に反映する。rAFの初回コールバックを待つと、
    // その一瞬だけ生の盤面(死亡ユニットが既に消えている等)がそのまま描画されてしまうため
    step(begin);
  }, []);

  const enqueue = useCallback(
    (input: CombatPlaybackInput) => {
      if (input.strikes.length === 0) return;
      queueRef.current.push(input);
      if (!playingRef.current) startNext();
    },
    [startNext],
  );

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { fx, enqueue, current };
}
