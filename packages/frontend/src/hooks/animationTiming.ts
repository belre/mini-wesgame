// 移動・戦闘アニメーションの所要時間の定数と見積もり関数。
// useMoveAnimations/useCombatAnimationsの実際のタイミングと必ず一致させるため、
// ここを唯一の定義元にする(値を変えるならここだけ触ればよい)。
//
// useLocalCpuGameのCPUペース調整に使う: CPUの手番タイマーが演出時間を無視して
// 一定間隔(元は600ms固定)で次の手を進めると、移動や複数打撃の戦闘のように
// 演出時間が長いアクションの最中に次のアクションが盤面(真の状態)へ反映されてしまい、
// 「演出が始まる前にユニットが(真の状態としては既に)死んでいて消える」
// 「動きが速すぎて追えない」といった見た目の破綻が起きる。
// 見積もった時間だけ次のCPUの手を待たせることで、真の状態の進行を演出の再生速度に合わせる
import type { GameEvent } from "@parle-stroika/core-engine";

export const MOVE_MS_PER_HEX = 200; // useMoveAnimationsと同じ
export const STRIKE_WINDOW_MS = 550; // useCombatAnimationsと同じ(1打撃の枠)
export const TAIL_MS = 600; // useCombatAnimationsと同じ(最終打撃後の余韻)
export const MAX_PLAYED_STRIKES = 12; // useCombatAnimationsと同じ(狂戦対策の暫定上限)

// 1アクション分のイベント列から、演出が終わるまでのおおよその時間(ms)を見積もる。
// move/attackアクションは高々1つずつしかmoved/combatイベントを持たないため単純に合算でよい
export function estimateEventsDurationMs(events: readonly GameEvent[]): number {
  let ms = 0;
  for (const e of events) {
    if (e.type === "moved") {
      ms += Math.max(0, e.path.length - 1) * MOVE_MS_PER_HEX;
    }
    if (e.type === "combat") {
      const strikes = Math.min(e.result.strikes.length, MAX_PLAYED_STRIKES);
      ms += strikes * STRIKE_WINDOW_MS + TAIL_MS;
    }
  }
  return ms;
}
