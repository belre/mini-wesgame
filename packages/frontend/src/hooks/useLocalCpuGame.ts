"use client";

// ローカルCPU対局の共通フック(CPU練習モードとチュートリアルモードで共用)。
// APIを一切介さず、共有コアエンジンをブラウザ内で直接実行する:
// - 人間の手もCPUの手も applyAction で適用(盤面は useState で保持、保存はしない)
// - CPUの手番は setTimeout で1手ずつ進める(chooseCpuAction は core-engine の純粋関数)。
//   待ち時間は前の手が生んだ演出(移動スライド・戦闘の打撃列)の再生時間ぶんだけ延長する
//   (estimateEventsDurationMs)。固定間隔のままだと、演出に数秒かかる戦闘や長距離移動の
//   最中に盤面(真の状態)がどんどん先へ進んでしまい、「演出前にユニットが(実際にはもう
//   死んでいて)消える」「動きが速すぎて追えない」といった見た目の破綻が起きるため
// - 霧(FOG)のマッチでは filterStateForViewer をCPU・人間の双方に適用する
import { useEffect, useRef, useState } from "react";
import {
  applyAction,
  chooseCpuAction,
  createInitialState,
  filterStateForViewer,
  type Action,
  type GameEvent,
  type MatchState,
} from "@parle-stroika/core-engine";
import { estimateEventsDurationMs } from "./animationTiming";

export const CPU_USER_ID = "CPU";
const CPU_STEP_MS = 600; // CPUの1手ごとの最低間隔(動きを目で追えるように)
const CPU_MAX_STEPS_PER_TURN = 150; // 想定外の手詰まり対策(超えたら強制的にターン終了)

export interface LocalCpuGameConfig {
  userId: string; // 人間側(プレイヤーindex 0)
  factionId: string;
  leaderUnitId?: string;
  cpuFactionId: string; // CPU側(プレイヤーindex 1)
  mapId: string;
  fog?: boolean;
  maxTurns?: number; // 最長ターン数(任意)。超過時は引き分けで終了
  recruitUnitIds?: string[]; // 人間側の雇用制限(モード用。未指定は陣営既定)
  cpuRecruitUnitIds?: string[]; // CPU側の雇用制限(同上)
}

function newGame(config: LocalCpuGameConfig): MatchState {
  return createInitialState(
    {
      players: [
        {
          userId: config.userId,
          factionId: config.factionId,
          leaderUnitId: config.leaderUnitId,
          recruitUnitIds: config.recruitUnitIds,
        },
        {
          userId: CPU_USER_ID,
          factionId: config.cpuFactionId,
          recruitUnitIds: config.cpuRecruitUnitIds,
        },
      ],
      mapId: config.mapId,
      fog: config.fog,
      maxTurns: config.maxTurns,
    },
    Math.random,
  );
}

export function useLocalCpuGame(config: LocalCpuGameConfig): {
  game: MatchState; // 全情報の盤面(トリガー判定などロジック用)
  board: MatchState; // 人間視点にフィルタ済みの盤面(表示用)
  submit: (action: Action) => Promise<GameEvent[]>; // 人間の手(BoardScreenへ注入)
  // CPUの手で発生した直近のイベント(BoardScreenのextraEventsへ。移動経路アニメに使う)
  cpuEvents: { seq: number; events: GameEvent[] } | null;
  restart: () => void; // 同じ設定で最初からやり直す
} {
  const [game, setGame] = useState<MatchState>(() => newGame(config));
  const [cpuEvents, setCpuEvents] = useState<{
    seq: number;
    events: GameEvent[];
  } | null>(null);
  const cpuSteps = useRef(0);
  // 次のCPUの手を「今」から何ms後に進めるか(前の手の演出の再生時間ぶん)。
  // このeffectはgameが変わるたびに張り直されるため、値をrefで次回分まで持ち越す
  const nextDelayRef = useRef(CPU_STEP_MS);

  // CPUの手番: 1手ずつ間隔をあけて進める。game が更新されるたびに次の1手が予約される
  // (エフェクトは game 変更で毎回張り直されるため、タイマー内の game は常に最新)
  useEffect(() => {
    if (game.status !== "active" || game.activePlayer !== 1) {
      cpuSteps.current = 0;
      nextDelayRef.current = CPU_STEP_MS;
      return;
    }
    const timer = setTimeout(() => {
      cpuSteps.current += 1;
      let result: { state: MatchState; events: GameEvent[] };
      try {
        // 霧のマッチではCPUにも「見えている盤面」だけ渡す(チート防止)
        const view = game.fogEnabled
          ? filterStateForViewer(game, CPU_USER_ID)
          : game;
        const action: Action =
          cpuSteps.current > CPU_MAX_STEPS_PER_TURN
            ? { type: "endTurn" }
            : chooseCpuAction(view, Math.random);
        result = applyAction(game, CPU_USER_ID, action, Math.random);
      } catch {
        // 可視情報と実盤面の差などで手が不成立だった場合はターンを返して続行
        try {
          result = applyAction(game, CPU_USER_ID, { type: "endTurn" }, Math.random);
        } catch {
          result = applyAction(game, CPU_USER_ID, { type: "surrender" }, Math.random);
        }
      }
      setGame(result.state);
      setCpuEvents((prev) => ({ seq: (prev?.seq ?? 0) + 1, events: result.events }));
      // 次の手は、今回の移動/戦闘の演出が終わる頃合いまで待つ(最低でもCPU_STEP_MS)
      nextDelayRef.current = Math.max(
        CPU_STEP_MS,
        estimateEventsDurationMs(result.events),
      );
    }, nextDelayRef.current);
    return () => clearTimeout(timer);
  }, [game]);

  // 人間の手: エンジンを直接実行(EngineErrorはBoardScreenがトースト表示する)
  const submit = async (action: Action): Promise<GameEvent[]> => {
    const { state, events } = applyAction(game, config.userId, action, Math.random);
    setGame(state);
    return events;
  };

  // 表示は自分視点にフィルタ(霧・伏兵・潜水をリモート対戦と同じルールで隠す)
  const board = game.fogEnabled ? filterStateForViewer(game, config.userId) : game;

  const restart = () => {
    setGame(newGame(config));
    setCpuEvents(null);
  };

  return { game, board, submit, cpuEvents, restart };
}
