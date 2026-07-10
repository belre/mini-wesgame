"use client";

// mini-wesgame のトップ画面 = 陣営選択→即CPU戦(2026-07-10 再設計)。
// ロビー・ログイン・API を持たず、陣営を選んだ瞬間に対局が始まる。
// 対局の駆動は useLocalCpuGame(共有コアエンジンをブラウザ内で直接実行)。
// 陣営は人間族とオークのみ(FactionSelect)。プレイヤーは常に先攻(index 0)。
// 試合終了後は「Rematch」で選択画面に戻る(=対局コンポーネントを丸ごと
// アンマウントする)。configを差し替えるだけの再戦は「内部stateが追従しない」
// バグの温床だったため、選択画面を経由する構造そのもので再発を防ぐ
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getUnitDef,
  hexEquals,
  mapById,
  mapMeta,
  timeOfDayForTurn,
  type HexCoord,
} from "@parle-stroika/core-engine";
import { useCutIn } from "@/hooks/useCutIn";
import { useLocalCpuGame } from "@/hooks/useLocalCpuGame";
import { hexElementId } from "@/lib/board/geometry";
import BoardScreen, { type BoardScreenHandle, type UiMode } from "./BoardScreen";
import FactionSelect, { HUMAN_FACTION_ID, ORC_FACTION_ID } from "./FactionSelect";
import { FirstTurnGuide, type GuideStep } from "./FirstTurnGuide";
import { GameOverOverlay, type GameOverOutcome } from "./GameOverOverlay";

// 1ターン目ガイドの「おすすめの初手ユニット」(陣営ごとに1種、役割説明が
// しやすい標準的なユニットを選ぶ。game-data-editing skillの「役割が被らない」方針に合わせる)
const FIRST_RECRUIT_UNIT_ID: Record<string, string> = {
  [HUMAN_FACTION_ID]: "spearman",
  [ORC_FACTION_ID]: "orcish_grunt",
};

function GameSession({
  factionId,
  onExit,
}: {
  factionId: string;
  onExit: () => void;
}) {
  const cpuFactionId = factionId === HUMAN_FACTION_ID ? ORC_FACTION_ID : HUMAN_FACTION_ID;
  // 1戦目の固定パターン(2026-07-10 ユーザー決定): 足の速いユニット(竜騎兵・狼乗り)は
  // 序盤マップでは決着が早まりすぎるため外す。陣営データは変えず、モード側の
  // 雇用制限(recruitUnitIds)で絞る。プレイヤー側は+1種(魔術師/トロル)の変化枠つき
  const RECRUITS: Record<string, { player: string[]; cpu: string[] }> = {
    [HUMAN_FACTION_ID]: { player: ["spearman", "bowman", "mage"], cpu: ["orcish_grunt", "orcish_archer"] },
    [ORC_FACTION_ID]: { player: ["orcish_grunt", "orcish_archer", "troll_whelp"], cpu: ["spearman", "bowman"] },
  };
  const config = useMemo(
    () => ({
      userId: "player",
      factionId,
      cpuFactionId,
      mapId: "valley_crossing",
      fog: true, // 演出用(2026-07-10): 本家Wesnothらしさを見せる要素として常時有効
      maxTurns: 30,
      recruitUnitIds: RECRUITS[factionId].player,
      cpuRecruitUnitIds: RECRUITS[factionId].cpu,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [factionId, cpuFactionId],
  );
  const { game, board, submit, cpuEvents } = useLocalCpuGame(config);
  const tod = timeOfDayForTurn(board.scheduleId, board.startIndex, board.turnNumber);
  const cutIn = useCutIn(board.mapId, 0, tod);
  const boardRef = useRef<BoardScreenHandle>(null);

  // --- 1ターン目クリックガイド(2026-07-10) ---
  // BoardScreen内部の下書き状態(UiMode)をonModeChangeで受け取り、現在どの
  // 操作段階かを外から判定する。対象はhex座標(hexElementId経由のDOM id)か
  // ボタン/カードのセレクタで指定するので、マップサイズが変わっても壊れない
  const [uiMode, setUiMode] = useState<UiMode>({ kind: "idle" });
  const [guideDone, setGuideDone] = useState(false);

  const myUnitCount = board.units.filter((u) => u.owner === 0).length;
  const leader = board.units.find((u) => u.owner === 0 && u.isLeader);
  const map = mapById(board.mapId);
  const meta = mapMeta(map);
  const firstCastleHex = meta.castlesByPlayer[0]?.find(
    (c) => !board.units.some((u) => hexEquals(u.pos, c)),
  );
  const recommendedUnitId = FIRST_RECRUIT_UNIT_ID[factionId];
  const recommendedUnitName = getUnitDef(recommendedUnitId).name;

  const isMyTurn = board.status === "active" && board.activePlayer === 0;
  let guideStep: GuideStep | null = null;
  let guideCenterHex: HexCoord | null = null;
  if (!guideDone && isMyTurn) {
    if (myUnitCount > 1) {
      guideStep = {
        targetSelector: "",
        message: "Recruit more if you like, then end your turn from the ⋯ menu. Enjoy!",
      };
    } else if (uiMode.kind === "idle" && leader) {
      guideStep = { targetSelector: `#${hexElementId(leader.pos)}`, message: "Tap your commander to select it." };
      guideCenterHex = leader.pos;
    } else if (uiMode.kind === "unitSelected" && leader && uiMode.unitId === leader.id) {
      guideStep = { targetSelector: "#board-recruit-button", message: "Press Recruit to open the roster." };
    } else if (uiMode.kind === "recruitPick") {
      guideStep = {
        targetSelector: `[data-unit-def-id="${recommendedUnitId}"]`,
        message: `Choose the ${recommendedUnitName}.`,
      };
    } else if (uiMode.kind === "recruitPlace" && firstCastleHex) {
      guideStep = {
        targetSelector: `#${hexElementId(firstCastleHex)}`,
        message: "Tap the highlighted hex to place it.",
      };
      guideCenterHex = firstCastleHex;
    }
  }

  // ヘックス系ステップが新規に始まったときだけカメラを寄せる。setTimeoutを挟んで
  // クリーンアップさせる形にしておくと、React Strict Modeの開発時二重実行
  // (mount→cleanup→mount)でも最後の1回だけが実際に発火する(実測済み。
  // 素朴にcenterOnHexを直接呼ぶと1回目の結果が2回目のcenterOnInit相当の
  // 再計算で上書きされ、カメラが対象からズレたまま戻ってこない事故があった)
  useEffect(() => {
    if (!guideCenterHex) return;
    const hex = guideCenterHex;
    const timer = setTimeout(() => {
      boardRef.current?.centerOnHex(hex);
    }, 0);
    return () => clearTimeout(timer);
  }, [guideCenterHex?.x, guideCenterHex?.y]);

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
      ref={boardRef}
      board={board}
      myIndex={0}
      submit={submit}
      extraEvents={cpuEvents}
      onCombatPlayback={cutIn.onCombatPlayback}
      onModeChange={setUiMode}
      overlay={<FirstTurnGuide step={guideStep} onDismiss={() => setGuideDone(true)} />}
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
