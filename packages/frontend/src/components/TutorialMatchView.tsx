"use client";

// チュートリアルモード(Client Component)。
// 相手はCPU(useLocalCpuGame)、進行はローカル完結(APIなし・保存なし)。
// シナリオ(TutorialScript)のガイドを、ターン数トリガー/hexトリガーで盤面に重ねて表示する。
// - 発火判定は core-engine の firedGuides(純粋関数)。表示済みIDはこのコンポーネントが管理
// - 同時に複数発火した場合はキューに積み、1枚ずつ「OK」で送る
import { useEffect, useMemo, useState } from "react";
import {
  firedGuides,
  getFaction,
  hexKey,
  timeOfDayForTurn,
  type TutorialGuide,
  type TutorialScript,
} from "@parle-stroika/core-engine";
import { useTranslations } from "next-intl";
import { useCutIn } from "@/hooks/useCutIn";
import { useLocalCpuGame } from "@/hooks/useLocalCpuGame";
import BoardScreen from "./BoardScreen";

const HUMAN_USER_ID = "you"; // ローカル完結のためログイン不要。表示名を兼ねる
const HUMAN_INDEX = 0;

export default function TutorialMatchView({
  tutorial,
}: {
  tutorial: TutorialScript;
}) {
  const config = useMemo(
    () => ({
      userId: HUMAN_USER_ID,
      factionId: tutorial.playerFactionId,
      leaderUnitId: tutorial.playerLeaderUnitId,
      cpuFactionId: tutorial.cpuFactionId,
      mapId: tutorial.mapId,
      fog: tutorial.fog,
    }),
    [tutorial],
  );
  const { game, board, submit, cpuEvents, restart } = useLocalCpuGame(config);
  const tod = timeOfDayForTurn(board.scheduleId, board.startIndex, board.turnNumber);
  const cutIn = useCutIn(board.mapId, HUMAN_INDEX, tod);
  const t = useTranslations("TutorialMatchView");

  const [shownIds, setShownIds] = useState<ReadonlySet<string>>(new Set());
  const [queue, setQueue] = useState<TutorialGuide[]>([]);

  // 盤面が変わるたびに発火条件を評価する。ガイドは一度だけ表示(shownIds)。
  // トリガー判定は全情報の game で行う(霧で見えない位置でも「自軍が乗った」事実で発火してよい)
  useEffect(() => {
    const fired = firedGuides(tutorial, game, HUMAN_INDEX, shownIds);
    if (fired.length === 0) return;
    setShownIds((prev) => new Set([...prev, ...fired.map((g) => g.id)]));
    setQueue((prev) => [...prev, ...fired]);
  }, [game, tutorial, shownIds]);

  const currentGuide = queue[0] ?? null;

  const guideHexes = useMemo(() => {
    if (!currentGuide?.highlightHexes?.length) return undefined;
    return new Set(currentGuide.highlightHexes.map(hexKey)) as ReadonlySet<string>;
  }, [currentGuide]);

  const restartAll = () => {
    setShownIds(new Set());
    setQueue([]);
    restart();
  };

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
      <span>
        {t("bannerLabel", {
          tutorialName: tutorial.name,
          cpuFaction: getFaction(tutorial.cpuFactionId).name,
        })}
      </span>
      {game.status === "finished" && (
        <button className="primary" onClick={restartAll}>
          {t("restartButton")}
        </button>
      )}
    </div>
  );

  // ガイドカード: 盤面上部に重ねる。OKで次のガイドへ(キュー)
  const overlay = currentGuide && (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 25,
        width: "min(92%, 480px)",
        background: "var(--panel)",
        border: "1px solid #ffd75e",
        borderRadius: 12,
        padding: "12px 14px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      {currentGuide.title && (
        <strong style={{ display: "block", marginBottom: 6, color: "#ffd75e" }}>
          📖 {currentGuide.title}
        </strong>
      )}
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{currentGuide.text}</p>
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        {queue.length > 1 && (
          <span className="dim" style={{ fontSize: 12, marginRight: "auto" }}>
            {t("remainingCount", { count: queue.length - 1 })}
          </span>
        )}
        <button className="primary" onClick={() => setQueue((q) => q.slice(1))}>
          OK
        </button>
      </div>
    </div>
  );

  return (
    <BoardScreen
      board={board}
      myIndex={HUMAN_INDEX}
      submit={submit}
      banner={banner}
      overlay={overlay}
      guideHexes={guideHexes}
      extraEvents={cpuEvents}
      onCombatPlayback={cutIn.onCombatPlayback}
    >
      {cutIn.stage}
    </BoardScreen>
  );
}
