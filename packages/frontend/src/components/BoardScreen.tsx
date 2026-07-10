"use client";

// 対戦盤面の共通UI(Client Component)。
// 盤面の描画・下書き状態(移動先候補・攻撃対象・雇用フロー)だけを持ち、
// アクションの確定は注入された submit(リモート: API / CPU練習: applyActionを直接実行)に委譲する。
// - 確定済みの盤面: props.board(呼び出し元がAPIキャッシュ or useStateで管理)
// - 下書き状態: useState(計画書3.3)
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { TOD_FX } from "@/lib/board/timeOfDayFx";
import {
  ABILITY_NAMES,
  canMoveTo,
  computeIncome,
  computeReachable,
  computeVisionSet,
  displayDamage,
  getFaction,
  getUnitDef,
  hasLeadershipSupport,
  hexEquals,
  hexDistance,
  hexKey,
  mapById,
  mapMeta,
  maxXpFor,
  reconstructPath,
  SPECIAL_NAMES,
  terrainAt,
  TIME_OF_DAY_DEFS,
  timeOfDayForTurn,
  type Action,
  type GameEvent,
  type HexCoord,
  type MatchState,
  type TimeOfDayDef,
  type UnitState,
} from "@parle-stroika/core-engine";
import { useCombatAnimations, type CombatPlaybackInput } from "@/hooks/useCombatAnimations";
import { useMatchAssets } from "@/hooks/useMatchAssets";
import { useMoveAnimations } from "@/hooks/useMoveAnimations";
import CombatPreviewPanel from "./CombatPreviewPanel";
import HexGrid from "./HexGrid";
import { backNeighborOf, hexCenter, hexElementId } from "@/lib/board/geometry";
import { OWNER_COLORS } from "@/lib/board/colors";
import { LoadingScreen } from "./LoadingScreen";
import RecruitSheet from "./RecruitSheet";
import RulesPanel from "./RulesPanel";

// 時間帯の見た目(2026-07-07 夜演出の本採用。/dev/terrainの昼夕夜プリセットで
// 検証済みの式)。skybox = terrain-diorama/skybox-<variant>.jpg(dayからgrade派生)、
// filter+overlay(multiply)は盤面ごと空気の色を作る。未定義の時間帯=昼

// ユニット詳細パネルの陣営表示(2026-07-10): lawful=昼+25%/夜-25%、chaotic=逆、
// neutral=無補正。アイコンで「どちらの時間帯有利か」を一目で示す
const ALIGNMENT_LABEL: Record<string, string> = {
  lawful: "☀ Lawful",
  neutral: "Neutral",
  chaotic: "🌙 Chaotic",
};

// 下書き(まだ送信していない自分だけのローカルな選択状態)。
// 1ターン目クリックガイド(FirstTurnGuide)が現在の操作段階を判定するために
// 外部公開する(onModeChange経由)
export type UiMode =
  | { kind: "idle" }
  | { kind: "unitSelected"; unitId: string }
  | { kind: "moveDraft"; unitId: string; target: HexCoord }
  | { kind: "attackDraft"; unitId: string; defenderId: string }
  | { kind: "recruitPick" } // 雇用 Stage 2: ボトムシート
  | { kind: "recruitPlace"; unitDefId: string }; // 雇用 Stage 3-4: 配置先選択

const EMPTY_SET: ReadonlySet<string> = new Set();

// ユニット選択の巡回救済(2026-07-08): 縦列(同じx)でユニットのスプライトが上下に
// 重なると、常に手前のユニットがタップを奪ってしまい奥のユニットを選びづらい。
// 直前タップとほぼ同じ画面位置への連続タップは「奥へフォーカスを移したい合図」とみなす。
// 暫定値(タッチ誤差程度を想定。要調整)
const SAME_TAP_RADIUS_PX = 16;

// TransformComponentのcontentStyle paddingと同じ値(centerOnHexの座標計算が使う)
const CONTENT_PADDING = 24;

// SSR時はuseLayoutEffectがno-op警告を出すためuseEffectにフォールバックする
// (このコンポーネントはクライアント専用だが、初回HTMLはServer Componentの
// ページから直接レンダーされるため、SSR中に一度だけ通る)
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// 1ターン目クリックガイド(FirstTurnGuide)がカメラを対象ヘックスへ寄せるための
// 命令的ハンドル。zoomToElementはhexElementIdのDOM idを直接探すため、
// マップサイズが変わっても座標計算をやり直す必要がない
export interface BoardScreenHandle {
  centerOnHex: (coord: HexCoord) => void;
}

function BoardScreen(
  {
    board,
    myIndex,
    submit: submitImpl,
    banner,
    overlay,
    guideHexes,
    extraEvents,
    onCombatPlayback,
    onModeChange,
    children,
  }: {
    board: MatchState; // 閲覧者視点でフィルタ済みの盤面
    myIndex: number;
    submit: (action: Action) => Promise<GameEvent[]>; // 成功時はイベント列、失敗時はthrow
    banner?: ReactNode; // topbar直下に出す通知(CPU練習モードの案内など)
    overlay?: ReactNode; // 盤面の上に重ねる要素(チュートリアルのガイドカードなど)
    guideHexes?: ReadonlySet<string>; // ガイド用にハイライトするヘックス(hexKey)
    // 自分の操作以外で発生したイベント(CPUの手など)。movedの実経路アニメに使う
    extraEvents?: { seq: number; events: GameEvent[] } | null;
    // 戦闘再生入力の注入口(producer/consumer分離)。未指定なら従来どおり盤面内アニメで
    // 再生し、指定時は外部レンダラー(カットイン等)へ流して盤面内では再生しない。
    // 入力の組み立て(戦闘前スナップショット・ゴースト・ちらつき対策)はBoardScreenが
    // 唯一のproducerとして担い、消費側だけを差し替えられる
    onCombatPlayback?: (input: CombatPlaybackInput) => void;
    // 内部の下書き状態(UiMode)が変わるたびに通知する。FirstTurnGuideのような
    // 「操作段階を外から観測して誘導したい」呼び出し元向け(2026-07-10)
    onModeChange?: (mode: UiMode) => void;
    // board-wrap内(盤面の上・Loading画面の下)に重ねる要素。カットイン(CutInStage)の差し込み口
    children?: ReactNode;
  },
  ref: React.Ref<BoardScreenHandle>,
) {
  const t = useTranslations("Board");
  // 時間帯の表示名(id→翻訳キーの対応。timeOfDayForTurnのid一覧と揃える)
  const TOD_LABEL: Record<string, string> = {
    dawn: t("todDawn"),
    morning: t("todMorning"),
    afternoon: t("todAfternoon"),
    dusk: t("todDusk"),
    first_watch: t("todNight"),
    second_watch: t("todLateNight"),
  };
  const [mode, setMode] = useState<UiMode>({ kind: "idle" });
  useEffect(() => {
    onModeChange?.(mode);
    // onModeChangeは呼び出し側でuseCallback化されていない前提が多いため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const pzRef = useRef<ReactZoomPanPinchRef | null>(null);
  useImperativeHandle(ref, () => ({
    // zoomToElementは要素サイズにフィットするズームまでかけてしまい(地形立体物で
    // 実バウンディングボックスが膨らむユニットもあるため)挙動が安定しなかった。
    // 代わりに現在のズーム倍率のまま「対象ヘックスを画面中央へ平行移動するだけ」の
    // 計算をhexCenter(盤面座標系)から直接行う(TransformComponentのcontentStyle
    // paddingぶんのオフセットだけ補正すればよい。CONTENT_PADDINGと同じ値を使う)
    centerOnHex: (coord) => {
      const ctx = pzRef.current;
      const wrapper = ctx?.instance.wrapperComponent;
      if (!ctx || !wrapper) return;
      const { cx, cy } = hexCenter(coord);
      const scale = ctx.instance.transformState.scale;
      const rect = wrapper.getBoundingClientRect();
      const positionX = rect.width / 2 - (cx + CONTENT_PADDING) * scale;
      const positionY = rect.height / 2 - (cy + CONTENT_PADDING) * scale;
      ctx.setTransform(positionX, positionY, scale, 400);
    },
  }), []);
  const [fabOpen, setFabOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [endTurnConfirm, setEndTurnConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // ---- 移動・戦闘アニメーション(演出層。確定盤面は即時反映のまま表示だけ遅らせる) ----
  const { animatedPositions, playMove } = useMoveAnimations();
  const { fx: combatFx, enqueue: enqueueCombat } = useCombatAnimations();
  // 戦闘の消費先: 外部レンダラー指定時は内蔵アニメ(enqueueCombat)を使わないため、
  // combatFxはEMPTYのままになりHexGridでは何も再生されない
  const playCombat = onCombatPlayback ?? enqueueCombat;

  // 対戦アセット(両陣営スプライト+地形)の一括プリロード。readyまでLoading画面を重ねる
  const matchAssets = useMatchAssets(board);
  // パック配信(CDN)の失敗通知(2026-07-08): ゲームは個別取得で続行するので
  // 致命エラー扱いにせず、既存トーストで軽く知らせるだけ(CPU戦画面は正式リリース時に
  // 再実装予定のため、当面はこの簡易表示でよい — ユーザー合意)
  const packWarning = matchAssets.packWarning;
  useEffect(() => {
    if (!packWarning) return;
    setToast(packWarning);
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [packWarning]);

  // CPUの手(extraEvents)用の実経路/戦闘登録。自分の手はsubmit内で送信前スナップショットを
  // 使って直接再生する(盤面の更新タイミングに左右されないようにするため)ので、
  // ここは「イベントが取れない相手の手」の直線スライドフォールバックと、CPUの手の演出に使う
  const pendingMovePaths = useRef(new Map<string, HexCoord[]>());
  const pendingCombats = useRef<Extract<GameEvent, { type: "combat" }>[]>([]);
  const prevUnits = useRef(new Map<string, UnitState>());

  // CPUの手などの外部イベントから実経路・戦闘を回収する(盤面差分エフェクトより先に宣言すること)。
  // useLayoutEffect: 盤面(board)の更新と同じコミット内で同期的に処理することで、
  // 「アニメ未登録のまま論理位置(移動後・死亡済み)がそのまま一瞬ペイントされてしまう」
  // ちらつき(flicker)を防ぐ(通常のuseEffectはペイント後に走るため間に合わない)
  useIsoLayoutEffect(() => {
    for (const e of extraEvents?.events ?? []) {
      if (e.type === "moved") pendingMovePaths.current.set(e.unitId, e.path);
      if (e.type === "combat") pendingCombats.current.push(e);
    }
  }, [extraEvents]);

  // 盤面が変わったら、位置の変わったユニットをアニメーションさせる。
  // 実経路が「観測された移動(旧位置→現位置)」と一致するときだけ採用し、
  // 一致しなければ直線スライドにフォールバックする。経路の登録がこのエフェクトより
  // 遅れて次の盤面変化に持ち越された場合に、古い経路を再生してしまう事故を防ぐ。
  // 霧で見えないユニットはboard.unitsに含まれないため、自然に「見える範囲だけ」動く。
  // こちらもuseLayoutEffect(理由は上のエフェクトと同じ: ペイント前にアニメの初期状態を
  // 反映し、目標地点/死亡済み状態が一瞬そのまま見えるちらつきを防ぐ)
  useIsoLayoutEffect(() => {
    const prev = prevUnits.current;
    for (const u of board.units) {
      const before = prev.get(u.id)?.pos;
      if (!before || hexEquals(before, u.pos)) continue; // 動いていない
      const path = pendingMovePaths.current.get(u.id);
      if (
        path &&
        hexEquals(path[0], before) &&
        hexEquals(path[path.length - 1], u.pos)
      ) {
        playMove(u.id, path);
      } else {
        playMove(u.id, [before, u.pos]);
      }
    }
    pendingMovePaths.current.clear();

    // 戦闘: 戦闘前スナップショット(prev)を打撃列と合わせて演出キューへ。
    // 死亡して盤面から消えたユニットはゴーストとして演出終了まで描画される
    for (const c of pendingCombats.current) {
      const attacker = prev.get(c.attackerId);
      const defender = prev.get(c.defenderId);
      if (!attacker || !defender) continue; // スナップショット無し(視界外など)は演出スキップ
      const ghosts = [attacker, defender].filter(
        (u) => !board.units.some((b) => b.id === u.id),
      );
      playCombat({
        attacker,
        defender,
        strikes: c.result.strikes,
        ghosts,
        attackerAttackId: c.attackerAttack.id,
        defenderAttackId: c.result.retaliationAttack?.id,
        bystanders: [...prev.values()].filter(
          (u) => u.id !== c.attackerId && u.id !== c.defenderId,
        ),
      });
    }
    pendingCombats.current = [];

    prevUnits.current = new Map(board.units.map((u) => [u.id, u]));
  }, [board, playMove, playCombat]);

  const submit = (action: Action) => {
    if (pending) return;
    setPending(true);

    // 自分の手が動かす/攻撃するユニットの「送信前」スナップショットをここで確保する。
    // submitImpl(CPU戦はapplyActionを同期実行、リモートはAPI応答後)が内部で盤面stateを
    // 更新するため、後続の.thenの時点でboard.unitsを見ても既に更新後の値になっている
    // ことがある(タイミング次第で盤面差分useEffectが先に走ってしまう)。
    // ここで確保したスナップショットを使えば、盤面の更新タイミングに関係なく
    // 「攻撃前のHP・位置」から正しくアニメーションを再生できる
    const preActionUnits = new Map(board.units.map((u) => [u.id, u]));

    // submitImplはマイクロタスクで開始する(クリックイベントの同期フラッシュに
    // 巻き込まれて盤面差分エフェクトが先に走るのを避けるため)
    Promise.resolve()
      .then(() => submitImpl(action))
      .then((events) => {
        for (const e of events) {
          if (e.type === "moved") {
            const before = preActionUnits.get(e.unitId);
            if (before) {
              playMove(e.unitId, e.path);
              // 盤面差分エフェクトが同じ移動を二重に再生しないよう位置を進めておく
              prevUnits.current.set(e.unitId, { ...before, pos: e.path[e.path.length - 1] });
            } else {
              pendingMovePaths.current.set(e.unitId, e.path); // スナップショット無しのフォールバック
            }
          }
          if (e.type === "combat") {
            const attacker = preActionUnits.get(e.attackerId);
            const defender = preActionUnits.get(e.defenderId);
            if (attacker && defender) {
              const ghosts: UnitState[] = [];
              if (e.result.attackerDied) ghosts.push(attacker);
              if (e.result.defenderDied) ghosts.push(defender);
              playCombat({
                attacker,
                defender,
                strikes: e.result.strikes,
                ghosts,
                attackerAttackId: e.attackerAttack.id,
                defenderAttackId: e.result.retaliationAttack?.id,
                bystanders: [...preActionUnits.values()].filter(
                  (u) => u.id !== e.attackerId && u.id !== e.defenderId,
                ),
              });
            } else {
              pendingCombats.current.push(e); // スナップショット無しのフォールバック
            }
          }
        }
        setMode({ kind: "idle" });
        setFabOpen(false);
        setEndTurnConfirm(false);
        // 特筆イベントの通知(伏兵による中断・レベルアップ)
        const notices: string[] = [];
        if (events.some((e) => e.type === "moveInterrupted")) {
          notices.push(t("moveInterrupted"));
        }
        for (const e of events.filter(
          (e): e is Extract<GameEvent, { type: "levelUp" }> => e.type === "levelUp",
        )) {
          notices.push(
            e.amla
              ? t("levelUpAmla", { name: getUnitDef(e.toDefId).name })
              : t("levelUpPromote", {
                  from: getUnitDef(e.fromDefId).name,
                  to: getUnitDef(e.toDefId).name,
                }),
          );
        }
        if (notices.length > 0) {
          setToast(notices.join(" "));
          setTimeout(() => setToast(null), 5000);
        }
      })
      .catch((err: unknown) => {
        setToast(err instanceof Error ? err.message : t("genericError"));
        setTimeout(() => setToast(null), 4000);
      })
      .finally(() => setPending(false));
  };

  const isMyTurn =
    board.status === "active" && myIndex === board.activePlayer;

  const map = mapById(board.mapId);
  const meta2 = mapMeta(map);

  // ユニット選択の巡回救済用の状態。setMode等の再レンダーは要らないのでrefで持つ
  const lastTapRef = useRef<{ x: number; y: number; anchorHex: HexCoord } | null>(null);

  // タップ時のフィードバック演出(2026-07-09)。「選択可能な有効なユニット」へのタップが
  // 実際に何か(選択・攻撃下書き・移動下書き・巡回切り替え等)を起こしたときだけ、
  // タップ位置に一瞬リングを出す。空振りのタップ(何も起きない)には出さない —
  // 巡回タップ等「効いたかどうか分かりにくい」操作の手応えを補うのが狙いなので、
  // 「起きた」ことが伝わらないと意味がない
  const [tapFx, setTapFx] = useState<{ id: number; x: number; y: number } | null>(null);
  const tapFxIdRef = useRef(0);
  const showTapFx = (screenPos: { x: number; y: number }) => {
    tapFxIdRef.current += 1;
    setTapFx({ id: tapFxIdRef.current, x: screenPos.x, y: screenPos.y });
  };
  // onHexClickを経由しない選択解除(パネルの閉じるボタン・行動確定後のリセット等)でも
  // 巡回のアンカーを破棄する。ここを漏らすと、選択解除後に同じ画面位置を再タップしたときに
  // 「新規選択」ではなく古いアンカーからの巡回として処理され、ユニットが選べなくなる
  useEffect(() => {
    if (mode.kind === "idle") lastTapRef.current = null;
  }, [mode]);

  // 縦列の奥隣ヘックス判定(lib/board/geometry.ts。ユニット巡回選択・敵の背後移動で共有)
  const backNeighborOfHere = (anchor: HexCoord): HexCoord | null =>
    backNeighborOf(map, anchor);

  const selectedUnit: UnitState | null = useMemo(() => {
    const unitId =
      mode.kind === "unitSelected" ||
      mode.kind === "moveDraft" ||
      mode.kind === "attackDraft"
        ? mode.unitId
        : null;
    return board.units.find((u) => u.id === unitId) ?? null;
  }, [board, mode]);

  // 移動範囲プレビュー: 共有コアエンジンをブラウザ内で直接実行(APIコールなし)
  const reachable = useMemo(() => {
    if (!selectedUnit) return null;
    if (!isMyTurn || selectedUnit.owner !== myIndex || selectedUnit.movesLeft <= 0)
      return null;
    return computeReachable({
      unit: selectedUnit,
      unitDef: getUnitDef(selectedUnit.unitDefId),
      units: board.units,
      map,
    });
  }, [board, map, selectedUnit, isMyTurn, myIndex]);

  const moveTargets = useMemo(() => {
    if (!reachable) return EMPTY_SET;
    const set = new Set<string>();
    for (const node of reachable.values()) {
      if (canMoveTo(reachable, node.coord)) set.add(hexKey(node.coord));
    }
    return set as ReadonlySet<string>;
  }, [reachable]);

  const attackTargets = useMemo(() => {
    if (!selectedUnit || !isMyTurn) return EMPTY_SET;
    if (selectedUnit.owner !== myIndex || selectedUnit.attacksLeft <= 0)
      return EMPTY_SET;
    const set = new Set<string>();
    for (const u of board.units) {
      if (u.owner !== myIndex && hexDistance(u.pos, selectedUnit.pos) === 1) {
        set.add(hexKey(u.pos));
      }
    }
    return set as ReadonlySet<string>;
  }, [board, selectedUnit, isMyTurn, myIndex]);

  const recruitTargets = useMemo(() => {
    if (mode.kind !== "recruitPlace" || myIndex < 0) return EMPTY_SET;
    const set = new Set<string>();
    for (const c of meta2.castlesByPlayer[myIndex]) {
      if (!board.units.some((u) => hexEquals(u.pos, c))) set.add(hexKey(c));
    }
    return set as ReadonlySet<string>;
  }, [board, meta2, mode, myIndex]);

  // 下書き移動の経路プレビュー: どのヘックスを通り、移動力をいくつ消費して、
  // どこで移動が終わるか(ZOC・村占領)を送信前に示す
  const draftPlan = useMemo(() => {
    if (mode.kind !== "moveDraft" || !reachable || myIndex < 0) return null;
    const node = reachable.get(hexKey(mode.target));
    const path = reconstructPath(reachable, mode.target);
    if (!node || !path) return null;
    const capturesVillage =
      terrainAt(map, mode.target).id === "village" &&
      (board.villageOwners ?? {})[hexKey(mode.target)] !== myIndex;
    return {
      path,
      cost: node.cost,
      // 村の占領で移動終了する場合は残り0(サーバー側の確定値と一致させる)
      remaining: capturesVillage ? 0 : node.remaining,
      capturesVillage,
      stoppedByZoc: !capturesVillage && node.remaining === 0 && node.cost < (selectedUnit?.movesLeft ?? 0),
    };
  }, [mode, reachable, board, map, myIndex, selectedUnit]);

  // 霧: 自軍の視界(nullなら霧なし=全ヘックス可視)
  const myVision = useMemo(() => {
    if (myIndex < 0) return null;
    return computeVisionSet(board, myIndex);
  }, [board, myIndex]);

  // 自軍ユニットに昇格先選択待ちがあれば取り出す(あれば昇格UIを優先表示)。
  // 相手ターン中の昇格(防御側のレベルアップ)は自分の手番が来てから選択する
  const myPendingPromotion = useMemo(() => {
    if (myIndex < 0 || !isMyTurn) return null;
    return (
      (board.pendingPromotion ?? []).find(
        (p) => board.units.find((u) => u.id === p.unitId)?.owner === myIndex,
      ) ?? null
    );
  }, [board, myIndex, isMyTurn]);

  const myPlayer = myIndex >= 0 ? board.players[myIndex] : null;
  const myIncome = myIndex >= 0 ? computeIncome(board, myIndex) : null;
  const tod = timeOfDayForTurn(board.scheduleId, board.startIndex, board.turnNumber);
  const todFx = TOD_FX[tod.id];
  const myFaction = myPlayer ? getFaction(myPlayer.factionId) : null;
  const myLeader = board.units.find((u) => u.owner === myIndex && u.isLeader);
  const leaderOnKeep =
    !!myLeader && myIndex >= 0 && hexEquals(myLeader.pos, meta2.keeps[myIndex]);
  const unactedCount = board.units.filter(
    (u) => u.owner === myIndex && (u.movesLeft > 0 || u.attacksLeft > 0),
  ).length;

  const onHexClick = (coord: HexCoord, screenPos: { x: number; y: number }) => {
    if (pending) return;
    const key = hexKey(coord);
    const clickedUnit = board.units.find((u) => hexEquals(u.pos, coord));

    // 直前タップは1度だけ読み取り、以降の分岐で使い回す(書き込みは各分岐の抜け口でのみ行う。
    // 読み書きを混在させると、同一呼び出し内で「今回のタップ」を「直前タップ」と誤認する事故になる)
    const lastTap = lastTapRef.current;
    const isNearLastTap =
      !!lastTap &&
      Math.hypot(screenPos.x - lastTap.x, screenPos.y - lastTap.y) <= SAME_TAP_RADIUS_PX;

    if (mode.kind === "recruitPlace") {
      lastTapRef.current = null;
      // 雇用 Stage 4: ハイライトされたヘックスをタップして配置確定
      if (recruitTargets.has(key)) {
        submit({ type: "recruit", unitDefId: mode.unitDefId, target: coord });
      } else {
        setMode({ kind: "idle" });
      }
      return;
    }

    // 移動中・攻撃選択中、敵ユニットの「背後」(奥隣)への対象指定の救済(2026-07-09)。
    // 傾き盤面では敵のスプライトが背後のヘックス(移動先の空きヘックス、または縦列で
    // 重なった別の敵)を覆い隠し、直接タップできないことがある。自軍ユニット選択中
    // (または既にその敵への攻撃下書き中)に同じ敵ヘックスへ同じ画面位置で連続タップすると、
    // 奥隣が移動先候補ならそちらへの移動下書きに、奥隣に別の攻撃対象(敵)がいれば
    // そちらへ攻撃対象を切り替える。1回目のタップは従来どおり(攻撃対象なら攻撃下書きを
    // 開く。対象外の遠方の敵などは選択状態を保ったまま何もしない — 以前はここで敵を
    // 選び直してしまい、自軍の移動下書き文脈が失われていた)
    const activeMoverId =
      mode.kind === "unitSelected" || mode.kind === "attackDraft" ? mode.unitId : null;
    // このタップが「今アンカーしている縦列の続き」かどうか。攻撃対象を奥へ切り替えた後は
    // mode.defenderIdが実際にタップされているユニット(常に手前側)と一致しなくなるため、
    // defenderId一致だけでなくアンカー一致でも「関連するタップ」とみなす必要がある
    // (でないと3回目以降のタップが「無関係な敵へのタップ」としてキャンセル扱いになってしまう)
    const tapMatchesActiveAnchor =
      isNearLastTap && !!lastTap && hexEquals(lastTap.anchorHex, coord);
    if (
      isMyTurn &&
      clickedUnit &&
      clickedUnit.owner !== myIndex &&
      activeMoverId &&
      (mode.kind !== "attackDraft" ||
        clickedUnit.id === mode.defenderId ||
        tapMatchesActiveAnchor)
    ) {
      if (tapMatchesActiveAnchor) {
        const back = backNeighborOfHere(coord);
        if (back && moveTargets.has(hexKey(back))) {
          lastTapRef.current = null;
          showTapFx(screenPos);
          setMode({ kind: "moveDraft", unitId: activeMoverId, target: back });
          return;
        }
        // 縦列で重なった奥の敵ヘックスが別の攻撃対象なら、そちらへ攻撃対象を切り替える。
        // アンカーは同じ手前側ヘックスのまま維持する(nullにすると次のタップが「初回」扱いになり、
        // 手前の敵が再び覆いかぶさって拾われた瞬間に攻撃下書きがキャンセルされてしまう —
        // 3回目以降の同位置タップも同じ奥の対象を指し続けさせるための維持)
        const backUnit = back && board.units.find((u) => hexEquals(u.pos, back));
        if (backUnit && backUnit.owner !== myIndex && attackTargets.has(hexKey(back))) {
          lastTapRef.current = { x: screenPos.x, y: screenPos.y, anchorHex: coord };
          showTapFx(screenPos);
          setMode({ kind: "attackDraft", unitId: activeMoverId, defenderId: backUnit.id });
          return;
        }
        // 奥に移動先候補も攻撃対象も無い場合はここで打ち切る。下の「ユニットを選び直す」
        // 汎用サイクルに素通しさせると、攻撃中だった自軍ユニットの選択が破棄されて
        // 奥の敵をただ選び直すだけになり、「奥の敵に攻撃できない」事故になる(2026-07-09)。
        // 攻撃下書き中だったならキャンセルして選択状態へ戻し、それ以外は選択を維持する
        lastTapRef.current = null;
        if (mode.kind === "attackDraft") {
          setMode({ kind: "unitSelected", unitId: mode.unitId });
        }
        return;
      } else {
        lastTapRef.current = { x: screenPos.x, y: screenPos.y, anchorHex: coord };
        // 1回目のタップ自体はモードを変えないことがある(対象外の遠方の敵など)が、
        // 「2回目タップで背後へ移動できる」合図を仕込んだこと自体はここで確定して起きている。
        // 見た目上何も変わらないと「タップが効いたか」が分からず不安になるため、
        // ここだけは効果の有無によらずリングを出す(この後の2回目タップの成否を問わない)
        showTapFx(screenPos);
        if (mode.kind === "unitSelected" && attackTargets.has(key)) {
          setMode({ kind: "attackDraft", unitId: activeMoverId, defenderId: clickedUnit.id });
        }
        return;
      }
    }

    if (mode.kind === "moveDraft" || mode.kind === "attackDraft") {
      lastTapRef.current = null;
      // 下書き中に別ヘックスをタップしたらキャンセル
      setMode({ kind: "unitSelected", unitId: mode.unitId });
      return;
    }

    if (mode.kind === "unitSelected" && selectedUnit && isMyTurn) {
      if (clickedUnit && attackTargets.has(key)) {
        lastTapRef.current = null;
        showTapFx(screenPos);
        setMode({
          kind: "attackDraft",
          unitId: selectedUnit.id,
          defenderId: clickedUnit.id,
        });
        return;
      }
      if (!clickedUnit && moveTargets.has(key)) {
        lastTapRef.current = null;
        setMode({ kind: "moveDraft", unitId: selectedUnit.id, target: coord });
        return;
      }
      // 雇用 Stage 1: リーダーが乗っている主城(keep)を再タップで雇用モードへ
      if (
        selectedUnit.isLeader &&
        selectedUnit.owner === myIndex &&
        hexEquals(selectedUnit.pos, coord) &&
        leaderOnKeep
      ) {
        lastTapRef.current = null;
        showTapFx(screenPos);
        setMode({ kind: "recruitPick" });
        return;
      }
    }

    // ここに来るのは「ユニットを選ぶ/選び直す」タップだけ(下書き中の対象指定・敵の背後移動は
    // 上で分岐済み)。直前タップとほぼ同じ画面位置(SAME_TAP_RADIUS_PX以内)への連続タップは、
    // 直前に選んだヘックスの列の奥隣にユニットがいればそちらへ選択を切り替える。奥へは1段しか
    // 進まない(3回目以降の同位置タップも同じ奥隣を指し続け、それ以上は進まない)
    if (isNearLastTap && lastTap) {
      lastTapRef.current = { x: screenPos.x, y: screenPos.y, anchorHex: lastTap.anchorHex };
      const back = backNeighborOfHere(lastTap.anchorHex);
      const backUnit = back && board.units.find((u) => hexEquals(u.pos, back));
      if (backUnit) {
        showTapFx(screenPos);
        setMode({ kind: "unitSelected", unitId: backUnit.id });
      }
      // 奥に候補がいなければ何もしない(現在の選択を維持)
      return;
    }

    lastTapRef.current = clickedUnit
      ? { x: screenPos.x, y: screenPos.y, anchorHex: coord }
      : null;

    if (clickedUnit) {
      showTapFx(screenPos);
      setMode({ kind: "unitSelected", unitId: clickedUnit.id });
    } else {
      setMode({ kind: "idle" });
    }
  };

  const defender =
    mode.kind === "attackDraft"
      ? board.units.find((u) => u.id === mode.defenderId) ?? null
      : null;

  // 戦闘のランジ(踏み込み)位置は移動アニメの位置より優先する
  const mergedPositions =
    combatFx.positions.size > 0
      ? new Map([...animatedPositions, ...combatFx.positions])
      : animatedPositions;

  return (
    <div className="match-screen">
      <div className="match-topbar">
        <span>
          {t("turnLabel", { turnNumber: board.turnNumber })}
          {board.maxTurns != null && `/${board.maxTurns}`} {TOD_LABEL[tod.id]}
          {board.fogEnabled && (
            <span title={t("fogTitle")} style={{ marginLeft: 4 }}>
              🌫
            </span>
          )}
        </span>
        {myPlayer && myIncome && (
          <span
            style={{ color: "var(--gold)" }}
            title={t("incomeTitle", {
              base: myIncome.base,
              villageGold: myIncome.villageGold,
              upkeepPaid: myIncome.upkeepPaid,
            })}
          >
            {t("goldLabel", { gold: myPlayer.gold })}
            <span className="dim" style={{ fontSize: 12 }}>
              {t("incomeDetail", {
                signedTotal: `${myIncome.total >= 0 ? "+" : ""}${myIncome.total}`,
                villages: myIncome.villages,
              })}
            </span>
          </span>
        )}
        {board.status === "finished" ? (
          <span className="badge finished">
            {board.winner == null ? (
              t("draw")
            ) : (
              <>
                {board.winner === myIndex ? t("victory") : t("defeat")}
                {t("winnerSuffix", { name: board.players[board.winner].userId })}
              </>
            )}
          </span>
        ) : isMyTurn ? (
          <span className="badge your-turn">{t("yourTurn")}</span>
        ) : (
          <span className="badge">
            {t("opponentTurn", { name: board.players[board.activePlayer].userId })}
          </span>
        )}
      </div>

      {banner}

      <div className="board-wrap">
        {/* パン&ズーム(1本指パン・2本指ピンチ・ホイール)のラップ範囲はSVGのみ(計画書3.4) */}
        <TransformWrapper
          ref={pzRef}
          minScale={0.4}
          maxScale={3}
          limitToBounds={false}
          centerOnInit
          doubleClick={{ disabled: true }}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%", filter: todFx.filter }}
            contentStyle={{ padding: CONTENT_PADDING }}
          >
            <HexGrid
              map={map}
              units={board.units}
              villageOwners={board.villageOwners ?? {}}
              activePlayer={board.activePlayer}
              selectedUnitId={selectedUnit?.id ?? null}
              moveTargets={moveTargets}
              attackTargets={attackTargets}
              recruitTargets={recruitTargets}
              draftTarget={mode.kind === "moveDraft" ? mode.target : null}
              movePath={draftPlan?.path ?? null}
              visionSet={myVision}
              guideHexes={guideHexes}
              animatedPositions={mergedPositions}
              combatFx={combatFx}
              onHexClick={onHexClick}
            />
          </TransformComponent>
        </TransformWrapper>

        {/* 時間帯の色被せ(2026-07-10): 夕方・夜(first/second watch)・夜明けを
            薄暗く・色味で語る。盤面のクリック判定はTransformWrapper側にあるため
            pointerEvents:noneで操作を妨げない。値の一元管理はlib/board/timeOfDayFx.ts
            (/dev/terrain検収ページと共有) */}
        {todFx.overlay && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: todFx.overlay,
              mixBlendMode: "multiply",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        )}

        {/* バージョン表示(2026-07-10): デプロイ先で今どのビルドが動いているかを
            切り分けるための最小限の手がかり。package.jsonのversion+Vercelの
            コミットSHA(ローカルdevでは未注入なので省略)。next.config.tsで注入 */}
        <div
          style={{
            position: "absolute",
            left: 6,
            bottom: 4,
            fontSize: 11,
            color: "#8a94a3",
            pointerEvents: "none",
            zIndex: 10,
            textShadow: "0 1px 2px #000",
          }}
        >
          v{process.env.NEXT_PUBLIC_APP_VERSION}
          {process.env.NEXT_PUBLIC_COMMIT_SHA && ` · ${process.env.NEXT_PUBLIC_COMMIT_SHA}`}
        </div>

        {/* タップフィードバック(2026-07-09): 有効なユニットタップで選択・攻撃下書き・移動下書き・
            巡回切り替えのいずれかが実際に起きたときだけ、タップ位置に一瞬リングを出す。
            screenPos(clientX/Y)基準なのでposition: fixedでビューポート座標にそのまま置ける */}
        {tapFx && (
          <div
            key={tapFx.id}
            aria-hidden
            className="tap-fx"
            style={{ left: tapFx.x, top: tapFx.y }}
            onAnimationEnd={() => setTapFx(null)}
          />
        )}

        {/* カットイン等の差し込みスロット(盤面の上・Loading画面の下) */}
        {children}

        {/* アセット取得が済むまで盤面を覆う(盤面は裏でマウント済み=キャッシュ共有) */}
        <LoadingScreen assets={matchAssets} />

        {/* overlayはLoading完了後にだけ出す(FirstTurnGuideのスポットライトが
            Loading画面の黒背景の上に浮いて見える問題があった。2026-07-10) */}
        {matchAssets.status === "ready" && overlay}

        {toast && <div className="toast">{toast}</div>}

        {/* ターン終了の条件付き確認トースト */}
        {endTurnConfirm && (
          <div className="toast">
            <span>{t("endTurnConfirmMsg", { count: unactedCount })}</span>
            <button
              className="primary"
              disabled={pending}
              onClick={() => submit({ type: "endTurn" })}
            >
              {t("endTurnConfirmButton")}
            </button>
            <button onClick={() => setEndTurnConfirm(false)}>{t("cancel")}</button>
          </div>
        )}

        {/* ルール早見(常設): 試合中いつでも押せる。宣伝デモとして「詳しくは知らなくても
            遊べる」を保ちつつ、気になった人だけ見返せる導線(2026-07-10) */}
        <button className="help-fab" onClick={() => setRulesOpen((v) => !v)}>
          ?
        </button>

        {/* パネル表示中は盤面・下書きUI(雇用・移動・攻撃プレビュー等)を封じる。
            誤操作防止(2026-07-10)。クリックでも閉じられる(モーダルの定石)。
            RulesPanel自体は.overlay-bottom(position:absolute+z-index10で
            独自のスタッキングコンテキストを作る)の"外"、scrimと同じ階層の
            兄弟として描画しないと、子要素にz-indexを盛ってもscrimの下に
            埋もれてしまう(実際に踏んだ不具合) */}
        {rulesOpen && (
          <>
            <div className="rules-scrim" onClick={() => setRulesOpen(false)} />
            <div className="rules-panel-wrap">
              <RulesPanel onClose={() => setRulesOpen(false)} />
            </div>
          </>
        )}

        {/* 汎用アクションメニュー(FAB): 開く→選ぶの2タップ構造が誤操作防止(計画書3.4) */}
        {board.status === "active" && (
          <>
            <button className="fab" onClick={() => setFabOpen((v) => !v)}>
              ⋯
            </button>
            {fabOpen && (
              <div className="fab-menu">
                <button
                  disabled={!isMyTurn || pending}
                  onClick={() => {
                    setFabOpen(false);
                    if (unactedCount > 0) {
                      setEndTurnConfirm(true);
                    } else {
                      submit({ type: "endTurn" });
                    }
                  }}
                >
                  {t("endTurn")}
                </button>
                <button
                  className="danger"
                  disabled={!isMyTurn || pending}
                  onClick={() => {
                    setFabOpen(false);
                    submit({ type: "surrender" });
                  }}
                >
                  {t("surrender")}
                </button>
              </div>
            )}
          </>
        )}

        <div className="overlay-bottom">
          {myPendingPromotion && (() => {
            const promotingUnit = board.units.find((u) => u.id === myPendingPromotion.unitId);
            if (!promotingUnit) return null;
            const fromDef = getUnitDef(promotingUnit.unitDefId);
            return (
              <div className="sheet">
                <strong>⭐ {t("promotionHeading", { name: fromDef.name })}</strong>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {myPendingPromotion.choices.map((targetDefId) => {
                    const targetDef = getUnitDef(targetDefId);
                    return (
                      <button
                        key={targetDefId}
                        className="primary"
                        disabled={pending}
                        onClick={() =>
                          submit({ type: "chooseLevelUp", unitId: promotingUnit.id, targetDefId })
                        }
                      >
                        {targetDef.name}（Lv{targetDef.level} / HP{targetDef.hp}）
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {!myPendingPromotion && mode.kind === "moveDraft" && selectedUnit && (
            <div className="confirm-bar">
              <span>
                {t("moveConfirmQuestion", {
                  name: getUnitDef(selectedUnit.unitDefId).name,
                  x: mode.target.x,
                  y: mode.target.y,
                })}
                {draftPlan && (
                  <span className="dim" style={{ display: "block", fontSize: 12 }}>
                    {t("movePlanDetail", {
                      hexCount: draftPlan.path.length - 1,
                      cost: draftPlan.cost,
                      remaining: draftPlan.remaining,
                    })}
                    {draftPlan.capturesVillage && t("capturesVillage")}
                    {draftPlan.stoppedByZoc && t("stoppedByZoc")}
                  </span>
                )}
              </span>
              <div className="row">
                <button
                  className="primary"
                  disabled={pending}
                  onClick={() =>
                    submit({
                      type: "move",
                      unitId: selectedUnit.id,
                      target: mode.target,
                    })
                  }
                >
                  {t("moveButton")}
                </button>
                <button
                  onClick={() =>
                    setMode({ kind: "unitSelected", unitId: selectedUnit.id })
                  }
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}

          {!myPendingPromotion && mode.kind === "attackDraft" && selectedUnit && defender && (
            <CombatPreviewPanel
              board={board}
              attacker={selectedUnit}
              defender={defender}
              pending={pending}
              onConfirm={(attackIndex) =>
                submit({
                  type: "attack",
                  attackerId: selectedUnit.id,
                  defenderId: defender.id,
                  attackIndex,
                })
              }
              onCancel={() =>
                setMode({ kind: "unitSelected", unitId: selectedUnit.id })
              }
            />
          )}

          {!myPendingPromotion && mode.kind === "recruitPick" && myFaction && myPlayer && (
            <RecruitSheet
              faction={myFaction}
              gold={myPlayer.gold}
              recruitUnitIds={myPlayer.recruitUnitIds}
              onPick={(unitDefId) => setMode({ kind: "recruitPlace", unitDefId })}
              onClose={() => setMode({ kind: "idle" })}
            />
          )}

          {!myPendingPromotion && mode.kind === "recruitPlace" && (
            <div className="confirm-bar">
              <span>
                {t("recruitPlaceInstruction", { name: getUnitDef(mode.unitDefId).name })}
              </span>
              <button onClick={() => setMode({ kind: "recruitPick" })}>{t("back")}</button>
            </div>
          )}

          {!myPendingPromotion && mode.kind === "unitSelected" && selectedUnit && (
            <UnitInfoPanel
              unit={selectedUnit}
              isMine={selectedUnit.owner === myIndex}
              canRecruit={
                isMyTurn && selectedUnit.isLeader && selectedUnit.owner === myIndex && leaderOnKeep
              }
              timeOfDay={tod}
              units={board.units}
              onRecruit={() => setMode({ kind: "recruitPick" })}
              onClose={() => setMode({ kind: "idle" })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default forwardRef(BoardScreen);

function UnitInfoPanel({
  unit,
  isMine,
  canRecruit,
  timeOfDay,
  units,
  onRecruit,
  onClose,
}: {
  unit: UnitState;
  isMine: boolean;
  canRecruit: boolean;
  timeOfDay: TimeOfDayDef;
  units: readonly UnitState[]; // 統率(隣接の統率持ち味方)判定に使う
  onRecruit: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("UnitInfoPanel");
  const def = getUnitDef(unit.unitDefId);
  const abilities = def.abilities ?? [];
  const leadership = hasLeadershipSupport(unit, units);
  return (
    <div className="unit-panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>
          {unit.isLeader ? "★ " : ""}
          {def.name}
          <span className="dim" style={{ marginLeft: 6, fontSize: 12 }}>
            {/* 自軍/敵軍は文字でなく所属色のドットで示す(2026-07-10。盤面の
                足元カラーと同じOWNER_COLORSを流用し、見た瞬間に分かるように) */}
            <span
              aria-label={isMine ? "Your unit" : "Enemy unit"}
              title={isMine ? "Your unit" : "Enemy unit"}
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: OWNER_COLORS[unit.owner],
                marginRight: 5,
              }}
            />
            Lv{def.level}
          </span>
          <span className="dim" style={{ marginLeft: 6, fontSize: 12 }}>
            {ALIGNMENT_LABEL[def.alignment] ?? def.alignment}
          </span>
          {abilities.length > 0 && (
            <span style={{ color: "#7ec8e3", marginLeft: 6, fontSize: 12 }}>
              {abilities.map((a) => ABILITY_NAMES[a]).join("・")}
            </span>
          )}
          {unit.poisoned && (
            <span style={{ color: "#8ee08e", marginLeft: 6, fontSize: 12 }}>☠Poison</span>
          )}
          {unit.slowed && (
            <span style={{ color: "#c9a6e0", marginLeft: 6, fontSize: 12 }}>🐌Slowed</span>
          )}
        </strong>
        <div className="row">
          {canRecruit && (
            <button id="board-recruit-button" className="primary" onClick={onRecruit}>
              {t("recruitButton")}
            </button>
          )}
          <button onClick={onClose}>{t("closeButton")}</button>
        </div>
      </div>
      <div className="dim" style={{ marginTop: 6, fontSize: 12 }}>
        HP {unit.hp}/{unit.maxHp ?? def.hp} ・{" "}
        <span style={{ color: "#b07fe0" }}>
          XP {unit.xp ?? 0}/{maxXpFor(def, unit.traits ?? [])}
        </span>
        {" "}・ {t("moveLabel")} {unit.movesLeft}/{unit.maxMoves ?? def.movement.points}
        {def.movement.type === "fly"
          ? t("flying")
          : def.movement.type === "swim"
            ? t("swimming")
            : ""}
      </div>
      <div className="dim" style={{ marginTop: 4, fontSize: 12 }}>
        {def.attacks.map((a, i) => {
          const effective = displayDamage(a, def, timeOfDay, {
            attackerTraits: unit.traits,
            leadership,
            slowed: unit.slowed,
          });
          // 基準値: このユニット固有の特性(強力等)は含めたまま、状況要因
          // (時間帯・統率・遅化)だけを外した値。2026-07-10: 素朴にattack.damage
          // (陣営データの生値)と比べると「強力」等の個体差まで「今だけ上がっている」
          // ように見えてしまうバグがあった(dawn=無補正のはずなのに矢印が出た実例)。
          // TIME_OF_DAY_DEFS.dawnはalignmentModifier:{}=無補正なので基準として使える
          const baseline = displayDamage(a, def, TIME_OF_DAY_DEFS.dawn, {
            attackerTraits: unit.traits,
          });
          const diff = effective - baseline;
          const boostColor = diff > 0 ? "#8ee08e" : diff < 0 ? "#e08a8a" : undefined;
          return (
            <span key={a.id}>
              {i > 0 && " / "}
              {a.name}{" "}
              <span style={boostColor ? { color: boostColor, fontWeight: 700 } : undefined}>
                {effective}
                {diff > 0 ? "▲" : diff < 0 ? "▼" : ""}
              </span>
              ×{a.count}(
              {a.range === "melee" ? t("melee") : t("ranged")}
              {a.specials?.length
                ? `・${a.specials.map((s) => SPECIAL_NAMES[s]).join("・")}`
                : ""}
              )
            </span>
          );
        })}
      </div>
    </div>
  );
}
