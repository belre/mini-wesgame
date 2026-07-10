"use client";

// mini-wesgame のトップ画面 = 陣営選択→即CPU戦(2026-07-10 再設計)。
// ロビー・ログイン・API を持たず、陣営を選んだ瞬間に対局が始まる。
// 対局の駆動は useLocalCpuGame(共有コアエンジンをブラウザ内で直接実行)。
// 陣営は人間族とオークのみ(FactionSelect)。プレイヤーは常に先攻(index 0)。
// 試合終了後は「Rematch」で選択画面に戻る(=対局コンポーネントを丸ごと
// アンマウントする)。configを差し替えるだけの再戦は「内部stateが追従しない」
// バグの温床だったため、選択画面を経由する構造そのもので再発を防ぐ
import { useMemo, useState } from "react";
import { getFaction, timeOfDayForTurn } from "@parle-stroika/core-engine";
import { useCutIn } from "@/hooks/useCutIn";
import { useLocalCpuGame } from "@/hooks/useLocalCpuGame";
import BoardScreen from "./BoardScreen";
import FactionSelect, { HUMAN_FACTION_ID, ORC_FACTION_ID } from "./FactionSelect";
import { GameOverOverlay, type GameOverOutcome } from "./GameOverOverlay";

function GameSession({
  factionId,
  onExit,
}: {
  factionId: string;
  onExit: () => void;
}) {
  const cpuFactionId = factionId === HUMAN_FACTION_ID ? ORC_FACTION_ID : HUMAN_FACTION_ID;
  const config = useMemo(
    () => ({
      userId: "player",
      factionId,
      cpuFactionId,
      mapId: "valley_crossing",
      maxTurns: 1, // TODO(テスト用): 試合終了フローの確認用。検証が終わったら外す
    }),
    [factionId, cpuFactionId],
  );
  const { game, board, submit, cpuEvents } = useLocalCpuGame(config);
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
        {getFaction(factionId).name} vs CPU[{getFaction(cpuFactionId).name}]
      </span>
    </div>
  );

  const outcome: GameOverOutcome | null =
    game.status === "finished"
      ? game.winner == null
        ? "draw"
        : game.winner === 0
          ? "victory"
          : "defeat"
      : null;

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
      {outcome && <GameOverOverlay outcome={outcome} onRematch={onExit} />}
    </BoardScreen>
  );
}

export default function MiniGame() {
  const [factionId, setFactionId] = useState<string | null>(null);

  if (!factionId) {
    return <FactionSelect onSelect={setFactionId} />;
  }

  return <GameSession factionId={factionId} onExit={() => setFactionId(null)} />;
}
