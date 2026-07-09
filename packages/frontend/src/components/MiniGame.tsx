"use client";

// mini-wesgame のトップ画面 = 即CPU戦(2026-07-08 移植)。
// ロビー・ログイン・API を持たず、開いた瞬間に対局が始まる。
// 対局の駆動は useLocalCpuGame(共有コアエンジンをブラウザ内で直接実行)。
// 陣営は人間族とオークのみ(PLAYABLE_FACTION_IDS)。「陣営交代」で入れ替えて再戦できる
import { useMemo, useState } from "react";
import { getFaction, timeOfDayForTurn } from "@parle-stroika/core-engine";
import { useCutIn } from "@/hooks/useCutIn";
import { useLocalCpuGame } from "@/hooks/useLocalCpuGame";
import BoardScreen from "./BoardScreen";

const HUMAN = "loyalists";
const ORC = "northerners";

export default function MiniGame() {
  // swapped=false: 人間族を操作しオークと戦う / true: 逆
  const [swapped, setSwapped] = useState(false);
  const [gameKey, setGameKey] = useState(0); // 陣営交代時に対局を作り直すためのkey
  const config = useMemo(
    () => ({
      userId: "player",
      factionId: swapped ? ORC : HUMAN,
      cpuFactionId: swapped ? HUMAN : ORC,
      mapId: "valley_crossing",
    }),
    // gameKeyはconfigを再生成して新しい対局を開始させるためだけに依存に含める
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swapped, gameKey],
  );
  const { game, board, submit, cpuEvents, restart } = useLocalCpuGame(config);
  const tod = timeOfDayForTurn(board.scheduleId, board.startIndex, board.turnNumber);
  const cutIn = useCutIn(board.mapId, 0, tod);

  const banner = (
    <div
      className="row"
      style={{
        padding: "6px 12px",
        gap: 8,
        fontSize: 13,
        background: "var(--panel)",
        borderBottom: "1px solid var(--panel-border)",
        flexWrap: "wrap",
      }}
    >
      <strong>mini-wesgame</strong>
      <span className="dim">
        {getFaction(config.factionId).name} vs CPU[{getFaction(config.cpuFactionId).name}]
      </span>
      {game.status === "finished" && (
        <button className="primary" onClick={restart}>
          Rematch
        </button>
      )}
      <button
        onClick={() => {
          setSwapped((v) => !v);
          setGameKey((k) => k + 1);
        }}
      >
        Swap factions &amp; rematch
      </button>
    </div>
  );

  return (
    <BoardScreen
      board={board}
      myIndex={0}
      submit={submit}
      banner={banner}
      extraEvents={cpuEvents}
      onCombatPlayback={cutIn.onCombatPlayback}
    >
      {cutIn.stage}
    </BoardScreen>
  );
}
