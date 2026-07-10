import {
  hasSpecial,
  predictCombat,
  resolveCombat,
  type CombatResult,
} from "./combat";
import { getFaction, getUnitDef } from "./data/factions";
import { mapById, mapMeta, terrainAt } from "./data/maps";
import { hexDistance, hexEquals, hexKey, hexNeighbors } from "./hex";
import { canMoveTo, computeReachable, moveCostFor, reconstructPath } from "./movement";
import { computeVisionSet, isHiddenFrom } from "./visibility";
import { timeOfDayForTurn } from "./timeOfDay";
import {
  assignTraits,
  hasAbility,
  hasTrait,
  maxXpFor,
  traitMaxHp,
  traitMoves,
} from "./traits";
import type {
  Action,
  AttackDef,
  HexCoord,
  MatchState,
  Rng,
  UnitDef,
  UnitState,
} from "./types";

export const STARTING_GOLD = 100;
export const BASE_INCOME = 2; // 基本収入
export const VILLAGE_GOLD = 2; // 村1つあたりの収入
export const VILLAGE_HEAL = 8; // 村での回復量(ターン開始時)
export const REST_HEAL = 2; // 休息回復量(前のターンに行動しなかった場合)
export const REGEN_HEAL = 8; // 再生(regenerates)の回復量
export const POISON_DAMAGE = 8; // 毒のターン開始時ダメージ(HPは1未満にならない)

// バリデーション失敗はすべて EngineError。
// サーバーはこれを 400 に変換し、クライアントはメッセージを表示する。
export class EngineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export type GameEvent =
  | { type: "moved"; unitId: string; from: HexCoord; to: HexCoord; path: HexCoord[] }
  | { type: "moveInterrupted"; unitId: string; at: HexCoord } // 伏兵・潜水ユニットに阻まれて途中停止
  | { type: "villageCaptured"; unitId: string; at: HexCoord; owner: number }
  | {
      type: "combat";
      attackerId: string;
      defenderId: string;
      attackerAttack: AttackDef; // 攻撃側が選択した攻撃(クライアントの演出選択用。result.retaliationAttackが防御側の対応)
      result: CombatResult;
    }
  | { type: "unitKilled"; unitId: string; unitDefId: string; owner: number }
  | { type: "plagueSpawned"; unit: UnitState } // 疫病で死体化したユニット
  | { type: "recruited"; unit: UnitState }
  | {
      type: "levelUp";
      unitId: string;
      fromDefId: string;
      toDefId: string; // AMLAの場合はfromと同じ
      amla: boolean;
    }
  | { type: "pendingLevelUp"; unitId: string; choices: string[] } // 昇格先選択待ち(chooseLevelUpで解決)
  | {
      type: "healed";
      unitId: string;
      amount: number;
      source: "village" | "regenerate" | "healer" | "rest"; // 複数該当する場合は最大値のみ採用(engine側の既存仕様)
    }
  | { type: "poisonDamage"; unitId: string; amount: number }
  | { type: "turnEnded"; nextPlayer: number; turnNumber: number; income: number }
  | { type: "matchFinished"; winner: number | null }; // winner: null は引き分け(maxTurns到達)

export interface ApplyResult {
  state: MatchState;
  events: GameEvent[];
}

export interface CreateMatchParams {
  players: {
    userId: string;
    factionId: string;
    leaderUnitId?: string; // 未指定は陣営デフォルト(faction.leaderUnitId)
    // 雇用可能ユニットの上書き(任意)。未指定は陣営のrecruitableUnitIds。
    // ゲームモードによる雇用制限(例: 1戦目は歩兵のみ)に使う
    recruitUnitIds?: string[];
  }[];
  mapId: string;
  scheduleId?: string;
  startIndex?: number;
  fog?: boolean; // 霧(FOG)を有効にするか(デフォルト無効)
  maxTurns?: number; // 最長ターン数(任意)。未指定は無制限。超過時は引き分けで終了
}

// 隊長ユニットの解決と検証。プレイヤーは自陣営のレベル2以上のユニットを隊長に選べる。
// (マッチ作成/参加APIのバリデーションでも同じ関数を使う)
export function resolveLeaderDef(factionId: string, leaderUnitId?: string): UnitDef {
  const faction = getFaction(factionId);
  const id = leaderUnitId ?? faction.defaultLeaderUnitId;
  const def = faction.units.find((u) => u.id === id);
  if (!def) {
    throw new EngineError("invalid_leader", "この陣営に存在しないユニットは隊長にできません");
  }
  if (def.level < 2) {
    throw new EngineError("invalid_leader", "隊長にはレベル2以上のユニットを選んでください");
  }
  return def;
}

let idCounter = 0;

function newUnitId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // crypto非対応環境向けフォールバック(テスト用)
  idCounter += 1;
  return `unit-${Date.now()}-${idCounter}`;
}

// ユニット生成(初期リーダー・雇用・疫病の死体化で共通)。
// 特性はここでランダム付与され、maxHp / maxMoves に固定される。
function makeUnitState(
  def: UnitDef,
  owner: number,
  pos: HexCoord,
  rng: Rng,
  opts?: { isLeader?: boolean; fresh?: boolean },
): UnitState {
  const traits = assignTraits(def, rng);
  const maxHp = traitMaxHp(def, traits);
  const maxMoves = traitMoves(def, traits);
  return {
    id: newUnitId(),
    unitDefId: def.id,
    owner,
    pos,
    hp: maxHp,
    maxHp,
    movesLeft: opts?.fresh ? maxMoves : 0,
    maxMoves,
    attacksLeft: opts?.fresh ? 1 : 0,
    isLeader: opts?.isLeader ?? false,
    traits,
    poisoned: false,
    xp: 0,
  };
}

// 撃破時の経験値(レベル×8、レベル0は4)
export function killXp(victimLevel: number): number {
  return victimLevel === 0 ? 4 : victimLevel * 8;
}

// 必要経験値に達していればレベルアップを適用する(繰り越しあり)。
// advancesToが1つなら自動昇格、2つ以上はpendingPromotionに積んでプレイヤー選択を待つ。
// なければAMLA: 最大HP+3と全回復。
function maybeLevelUp(
  unit: UnitState,
  events: GameEvent[],
  pendingPromotion: Array<{ unitId: string; choices: string[] }>,
): void {
  for (let guard = 0; guard < 4; guard++) {
    const def = getUnitDef(unit.unitDefId);
    const required = maxXpFor(def, unit.traits);
    if (unit.xp < required) return;
    unit.xp -= required;
    if (def.advancesTo && def.advancesTo.length > 1) {
      pendingPromotion.push({ unitId: unit.id, choices: def.advancesTo });
      events.push({ type: "pendingLevelUp", unitId: unit.id, choices: def.advancesTo });
      return; // 選択が確定するまでチェーンを止める
    }
    const fromDefId = unit.unitDefId;
    if (def.advancesTo && def.advancesTo.length === 1) {
      const nextDef = getUnitDef(def.advancesTo[0]);
      unit.unitDefId = nextDef.id;
      unit.maxHp = traitMaxHp(nextDef, unit.traits);
      unit.maxMoves = traitMoves(nextDef, unit.traits);
    } else {
      unit.maxHp += 3;
    }
    unit.hp = unit.maxHp; // レベルアップで全回復
    unit.poisoned = false;
    events.push({
      type: "levelUp",
      unitId: unit.id,
      fromDefId,
      toDefId: unit.unitDefId,
      amla: !def.advancesTo || def.advancesTo.length === 0,
    });
  }
}

// 旧スキーマのレコード(特性・村導入前)を読めるようにデフォルト値を埋める
function normalizeState(state: MatchState): void {
  state.villageOwners ??= {};
  state.fogEnabled ??= false;
  state.pendingPromotion ??= [];
  for (const u of state.units) {
    const def = getUnitDef(u.unitDefId);
    u.traits ??= [];
    u.maxHp ??= traitMaxHp(def, u.traits);
    u.maxMoves ??= traitMoves(def, u.traits);
    u.poisoned ??= false;
    u.xp ??= 0;
  }
}

// マッチ開始時の初期状態: 各プレイヤーのリーダーを keep に配置
export function createInitialState(
  params: CreateMatchParams,
  rng: Rng = Math.random,
): MatchState {
  const { players, mapId } = params;
  if (players.length !== 2) {
    throw new EngineError("invalid_players", "2人のプレイヤーが必要です");
  }
  if (params.maxTurns !== undefined && (!Number.isInteger(params.maxTurns) || params.maxTurns < 1)) {
    throw new EngineError("invalid_max_turns", "最長ターン数は1以上の整数で指定してください");
  }
  const map = mapById(mapId);
  const meta = mapMeta(map);

  const units: UnitState[] = players.map((p, index) => {
    const leaderDef = resolveLeaderDef(p.factionId, p.leaderUnitId);
    return makeUnitState(leaderDef, index, meta.keeps[index], rng, {
      isLeader: true,
      fresh: true,
    });
  });

  return {
    mapId,
    scheduleId: params.scheduleId ?? "standard_cycle",
    startIndex: params.startIndex ?? 0,
    turnNumber: 1,
    activePlayer: 0,
    players: players.map((p) => ({
      userId: p.userId,
      factionId: p.factionId,
      gold: STARTING_GOLD,
      recruitUnitIds: p.recruitUnitIds,
    })),
    units,
    villageOwners: {},
    fogEnabled: params.fog ?? false,
    pendingPromotion: [],
    status: "active",
    turnVersion: 0,
    maxTurns: params.maxTurns,
  };
}

// 収入の内訳: 基本2 + 村×2 − 維持費(非リーダーのレベル合計のうち村数を超えた分)
export interface IncomeBreakdown {
  base: number;
  villages: number; // 領有する村の数
  villageGold: number; // 村からの収入合計
  upkeep: number; // 維持費の総量(非リーダーのレベル合計)
  upkeepPaid: number; // 実際に支払う維持費(村数を超えた分)
  total: number;
}

export function computeIncome(state: MatchState, playerIndex: number): IncomeBreakdown {
  const villages = Object.values(state.villageOwners ?? {}).filter(
    (o) => o === playerIndex,
  ).length;
  const upkeep = state.units
    .filter((u) => u.owner === playerIndex && !u.isLeader)
    .reduce((sum, u) => sum + getUnitDef(u.unitDefId).level, 0);
  const upkeepPaid = Math.max(0, upkeep - villages);
  return {
    base: BASE_INCOME,
    villages,
    villageGold: villages * VILLAGE_GOLD,
    upkeep,
    upkeepPaid,
    total: BASE_INCOME + villages * VILLAGE_GOLD - upkeepPaid,
  };
}

function findUnit(state: MatchState, unitId: string): UnitState {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) throw new EngineError("unit_not_found", "ユニットが見つかりません");
  return unit;
}

function unitAt(state: MatchState, coord: HexCoord): UnitState | undefined {
  return state.units.find((u) => hexEquals(u.pos, coord));
}

function removeDeadAndCheckVictory(
  state: MatchState,
  events: GameEvent[],
): void {
  const dead = state.units.filter((u) => u.hp <= 0);
  for (const u of dead) {
    events.push({ type: "unitKilled", unitId: u.id, unitDefId: u.unitDefId, owner: u.owner });
  }
  state.units = state.units.filter((u) => u.hp > 0);

  const deadLeaderOwners = dead.filter((u) => u.isLeader).map((u) => u.owner);
  if (deadLeaderOwners.length > 0) {
    // 自軍リーダーが倒れたプレイヤーの敗北(resolveCombatはどちらかが倒れた時点で
    // 打ち切るため、リーダー同士の相打ちは発生しない)
    const loser = deadLeaderOwners[0];
    state.status = "finished";
    state.winner = 1 - loser;
    events.push({ type: "matchFinished", winner: state.winner });
  }
}

// アクションを検証して適用する権威ロジック。
// クライアント(楽観的プレビュー)とサーバー(Lambdaでの確定)の両方で同じ関数を実行する。
export function applyAction(
  state: MatchState,
  actorUserId: string,
  action: Action,
  rng: Rng,
): ApplyResult {
  if (state.status !== "active") {
    throw new EngineError("match_finished", "このマッチは終了しています");
  }
  const actorIndex = state.players.findIndex((p) => p.userId === actorUserId);
  if (actorIndex < 0) {
    throw new EngineError("not_participant", "このマッチの参加者ではありません");
  }
  if (actorIndex !== state.activePlayer) {
    throw new EngineError("not_your_turn", "あなたのターンではありません");
  }

  const next: MatchState = structuredClone(state);
  normalizeState(next);
  const events: GameEvent[] = [];

  // 自軍ユニットに昇格先選択待ちがある場合はchooseLevelUpとsurrenderのみ許可
  const myPendingPromotion = next.pendingPromotion.filter(
    (p) => next.units.find((u) => u.id === p.unitId)?.owner === actorIndex,
  );
  if (myPendingPromotion.length > 0 && action.type !== "chooseLevelUp" && action.type !== "surrender") {
    throw new EngineError("pending_promotion", "昇格先を選択してください");
  }

  const map = mapById(next.mapId);
  const meta = mapMeta(map);
  const player = next.players[actorIndex];

  switch (action.type) {
    case "move": {
      const unit = findUnit(next, action.unitId);
      if (unit.owner !== actorIndex) {
        throw new EngineError("not_your_unit", "自軍のユニットではありません");
      }
      if (unit.movesLeft <= 0) {
        throw new EngineError("no_moves_left", "このユニットは移動済みです");
      }
      const unitDef = getUnitDef(unit.unitDefId);

      // 経路計画は「プレイヤーに見えている情報」だけで行う。
      // 全情報で再計算すると、隠れユニット(伏兵・潜水・霧の視界外)を避ける迂回路を
      // サーバーが勝手に選んでしまい、隠密ユニットの遮断が機能しなくなるため。
      // (クライアントのプレビューと同じ入力 → 同じ経路になる)
      const visionSet = computeVisionSet(next, actorIndex);
      const visibleUnits = next.units.filter(
        (u) => !isHiddenFrom(u, actorIndex, next, visionSet),
      );
      const reachable = computeReachable({
        unit,
        unitDef,
        units: visibleUnits,
        map,
      });
      if (!canMoveTo(reachable, action.target)) {
        throw new EngineError("unreachable", "そのヘックスには移動できません");
      }
      const node = reachable.get(hexKey(action.target))!;
      const path = reconstructPath(reachable, action.target)!;

      // 実行は全情報で1ヘックスずつ進め、隠れユニットに阻まれたらその場で停止する
      const hiddenEnemies = next.units.filter(
        (u) => u.owner !== actorIndex && isHiddenFrom(u, actorIndex, next, visionSet),
      );
      const hiddenPositions = new Set(hiddenEnemies.map((u) => hexKey(u.pos)));
      const hiddenZoc = new Set(
        hiddenEnemies.flatMap((u) => hexNeighbors(u.pos).map(hexKey)),
      );

      const travelled: { coord: HexCoord; remaining: number }[] = [
        { coord: unit.pos, remaining: unit.movesLeft },
      ];
      let interrupted = false;
      for (let i = 1; i < path.length; i++) {
        const step = path[i];
        const stepKey = hexKey(step);
        // 進行先に隠れユニット本体がいる: 手前で停止(発覚)
        if (hiddenPositions.has(stepKey)) {
          interrupted = true;
          break;
        }
        const cost = moveCostFor(unitDef, terrainAt(map, step), unit.slowed);
        const remaining = travelled[travelled.length - 1].remaining - cost;
        travelled.push({ coord: step, remaining });
        // 隠れユニットのZOCに進入: そこで移動終了(発覚)
        if (hiddenZoc.has(stepKey)) {
          travelled[travelled.length - 1].remaining = 0;
          interrupted = true;
          break;
        }
      }
      // 停止ヘックスが他ユニット(通過中の味方等)に占有されていたら、空くところまで戻る
      while (
        travelled.length > 1 &&
        next.units.some(
          (u) =>
            u.id !== unit.id &&
            hexEquals(u.pos, travelled[travelled.length - 1].coord),
        )
      ) {
        travelled.pop();
      }

      const final = travelled[travelled.length - 1];
      if (!interrupted) {
        // 通常移動: 可視情報での計算結果(可視ZOC込みの残り移動力)を採用
        final.remaining = node.remaining;
      }
      const from = unit.pos;
      const moved = !hexEquals(final.coord, from);
      if (moved) {
        unit.pos = final.coord;
        unit.movesLeft = Math.max(0, final.remaining);
        events.push({
          type: "moved",
          unitId: unit.id,
          from,
          to: final.coord,
          path: travelled.map((t) => t.coord),
        });
      }
      if (interrupted) {
        // 発覚: 停止位置は隠れユニットに隣接しているため、以後の閲覧で相手が見える
        // (霧の場合も同様: 隣接ヘックスは必ず視界内に入る)
        events.push({ type: "moveInterrupted", unitId: unit.id, at: final.coord });
      }

      // 村の占領: 自軍領有でない村に止まると領有し、移動終了
      const finalKey = hexKey(final.coord);
      if (
        moved &&
        terrainAt(map, final.coord).id === "village" &&
        next.villageOwners[finalKey] !== actorIndex
      ) {
        next.villageOwners[finalKey] = actorIndex;
        unit.movesLeft = 0;
        events.push({
          type: "villageCaptured",
          unitId: unit.id,
          at: final.coord,
          owner: actorIndex,
        });
      }
      break;
    }

    case "attack": {
      const attacker = findUnit(next, action.attackerId);
      const defender = findUnit(next, action.defenderId);
      if (attacker.owner !== actorIndex) {
        throw new EngineError("not_your_unit", "自軍のユニットではありません");
      }
      if (defender.owner === actorIndex) {
        throw new EngineError("friendly_fire", "味方は攻撃できません");
      }
      if (attacker.attacksLeft <= 0) {
        throw new EngineError("no_attacks_left", "このユニットは攻撃済みです");
      }
      if (hexDistance(attacker.pos, defender.pos) !== 1) {
        throw new EngineError("not_adjacent", "隣接していない相手は攻撃できません");
      }
      const attackerDef = getUnitDef(attacker.unitDefId);
      const attack = attackerDef.attacks[action.attackIndex];
      if (!attack) {
        throw new EngineError("invalid_attack", "無効な攻撃です");
      }
      const combatCtx = {
        attacker,
        attackerDef,
        defender,
        defenderDef: getUnitDef(defender.unitDefId),
        attack,
        attackerTerrain: terrainAt(map, attacker.pos),
        defenderTerrain: terrainAt(map, defender.pos),
        timeOfDay: timeOfDayForTurn(next.scheduleId, next.startIndex, next.turnNumber),
        units: next.units, // 奇襲(backstab)の位置判定用
      };
      // 妥当性検証を兼ねて期待値計算を通す(NaN等の異常データを実行前に弾く)
      predictCombat(combatCtx);
      const result = resolveCombat(combatCtx, rng);
      attacker.hp = result.attackerHpAfter;
      defender.hp = result.defenderHpAfter;
      if (result.attackerPoisoned) attacker.poisoned = true;
      if (result.defenderPoisoned) defender.poisoned = true;
      if (result.attackerSlowed) attacker.slowed = true;
      if (result.defenderSlowed) defender.slowed = true;
      attacker.attacksLeft = 0;
      attacker.movesLeft = 0; // 攻撃したユニットはそのターン移動できない
      events.push({
        type: "combat",
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerAttack: attack,
        result,
      });

      // 経験値: 生存して戦闘を終えると相手のレベル分、撃破すると killXp(レベル×8、L0は4)
      const defenderDefForXp = getUnitDef(defender.unitDefId);
      if (!result.attackerDied) {
        attacker.xp +=
          (result.defenderDied
            ? killXp(defenderDefForXp.level)
            : defenderDefForXp.level);
        maybeLevelUp(attacker, events, next.pendingPromotion);
      }
      if (!result.defenderDied) {
        defender.xp +=
          (result.attackerDied ? killXp(attackerDef.level) : attackerDef.level);
        maybeLevelUp(defender, events, next.pendingPromotion);
      }

      // 疫病: 倒した相手を歩く死体として自軍に加える(アンデッド特性・村の上での戦死には無効)。
      // 死体の種類は「倒された側」の陣営が決める(plagueCorpseUnitId未指定は歩く死体=人間)
      const plagueSpawns: { pos: HexCoord; owner: number; corpseUnitId: string }[] = [];
      if (
        result.defenderDied &&
        hasSpecial(attack, "plague") &&
        !hasTrait(defender.traits, "undead") &&
        terrainAt(map, defender.pos).id !== "village"
      ) {
        const victimFaction = getFaction(next.players[defender.owner].factionId);
        plagueSpawns.push({
          pos: defender.pos,
          owner: attacker.owner,
          corpseUnitId: victimFaction.plagueCorpseUnitId ?? "walking_corpse",
        });
      }
      if (
        result.attackerDied &&
        hasSpecial(result.retaliationAttack, "plague") &&
        !hasTrait(attacker.traits, "undead") &&
        terrainAt(map, attacker.pos).id !== "village"
      ) {
        const victimFaction = getFaction(next.players[attacker.owner].factionId);
        plagueSpawns.push({
          pos: attacker.pos,
          owner: defender.owner,
          corpseUnitId: victimFaction.plagueCorpseUnitId ?? "walking_corpse",
        });
      }

      removeDeadAndCheckVictory(next, events);

      if (next.status === "active") {
        for (const spawn of plagueSpawns) {
          const corpse = makeUnitState(
            getUnitDef(spawn.corpseUnitId),
            spawn.owner,
            spawn.pos,
            rng,
          );
          next.units.push(corpse);
          events.push({ type: "plagueSpawned", unit: corpse });
        }
      }
      break;
    }

    case "recruit": {
      const faction = getFaction(player.factionId);
      const def = faction.units.find((u) => u.id === action.unitDefId);
      if (!def) {
        throw new EngineError("not_recruitable", "この陣営では雇用できないユニットです");
      }
      // モードによる雇用制限(PlayerState.recruitUnitIds。未指定は制限なし)
      if (player.recruitUnitIds && !player.recruitUnitIds.includes(action.unitDefId)) {
        throw new EngineError("not_recruitable", "この対戦では雇用できないユニットです");
      }
      if (player.gold < def.cost) {
        throw new EngineError("not_enough_gold", "ゴールドが足りません");
      }
      const leader = next.units.find((u) => u.owner === actorIndex && u.isLeader);
      if (!leader || !hexEquals(leader.pos, meta.keeps[actorIndex])) {
        throw new EngineError("leader_not_on_keep", "リーダーが主城にいる必要があります");
      }
      const isOwnCastle = meta.castlesByPlayer[actorIndex].some((c) =>
        hexEquals(c, action.target),
      );
      if (!isOwnCastle) {
        throw new EngineError("invalid_recruit_hex", "自軍の城ヘックスにのみ配置できます");
      }
      if (unitAt(next, action.target)) {
        throw new EngineError("hex_occupied", "そのヘックスは既に埋まっています");
      }
      player.gold -= def.cost;
      // 特性はサーバー側の乱数でここで確定する(雇用したターンは行動不可)
      const unit = makeUnitState(def, actorIndex, action.target, rng);
      next.units.push(unit);
      events.push({ type: "recruited", unit });
      break;
    }

    case "chooseLevelUp": {
      const pendingIdx = next.pendingPromotion.findIndex((p) => p.unitId === action.unitId);
      if (pendingIdx < 0) {
        throw new EngineError("no_pending_promotion", "このユニットには昇格待ちの選択肢がありません");
      }
      const pending = next.pendingPromotion[pendingIdx];
      if (!pending.choices.includes(action.targetDefId)) {
        throw new EngineError("invalid_promotion_target", "無効な昇格先です");
      }
      const unit = findUnit(next, action.unitId);
      if (unit.owner !== actorIndex) {
        throw new EngineError("not_your_unit", "自軍のユニットではありません");
      }
      const fromDefId = unit.unitDefId;
      const promotedDef = getUnitDef(action.targetDefId);
      unit.unitDefId = promotedDef.id;
      unit.maxHp = traitMaxHp(promotedDef, unit.traits);
      unit.maxMoves = traitMoves(promotedDef, unit.traits);
      unit.hp = unit.maxHp;
      unit.poisoned = false;
      next.pendingPromotion.splice(pendingIdx, 1);
      events.push({ type: "levelUp", unitId: unit.id, fromDefId, toDefId: promotedDef.id, amla: false });
      maybeLevelUp(unit, events, next.pendingPromotion);
      break;
    }

    case "endTurn": {
      next.activePlayer = 1 - next.activePlayer;
      if (next.activePlayer === 0) {
        next.turnNumber += 1;
      }
      // ターン開始処理(手番が回ってきた側): 毒・回復・遅化解除 → リフレッシュ
      // 回復源(村8 / 再生8 / 隣接ヒーラー4or8 / 休息2)は加算せず最大値のみ適用する
      const myUnits = next.units.filter((u) => u.owner === next.activePlayer);
      for (const u of myUnits) {
        const def = getUnitDef(u.unitDefId);
        const onVillage = terrainAt(map, u.pos).id === "village";
        const healthy = hasTrait(u.traits, "healthy");
        const regenerates = hasAbility(def, "regenerates");
        const adjacentAllies = myUnits.filter(
          (a) => a.id !== u.id && hexDistance(a.pos, u.pos) === 1,
        );
        const adjacentCurer = adjacentAllies.some((a) =>
          hasAbility(getUnitDef(a.unitDefId), "cures"),
        );
        const adjacentHeal = adjacentAllies.reduce((best, a) => {
          const allyDef = getUnitDef(a.unitDefId);
          if (hasAbility(allyDef, "heals8")) return Math.max(best, 8);
          if (hasAbility(allyDef, "heals4")) return Math.max(best, 4);
          return best;
        }, 0);

        const hpBefore = u.hp;
        if (u.poisoned) {
          // 治療手段: 村 / 隣接する治癒(cures)持ち / 自身の再生。治療したターンは回復しない
          if (onVillage || adjacentCurer || regenerates) {
            u.poisoned = false;
          } else {
            // 毒ダメージ(壮健は半減)。毒では死なない(HP1未満にならない)
            u.hp = Math.max(1, u.hp - (healthy ? POISON_DAMAGE / 2 : POISON_DAMAGE));
            if (u.hp < hpBefore) {
              events.push({ type: "poisonDamage", unitId: u.id, amount: hpBefore - u.hp });
            }
          }
        } else {
          // 休息回復: 前の自分のターンに一切行動しなかった場合(壮健は行動しても回復)
          // 回復源(村8 / 再生8 / 隣接ヒーラー4or8 / 休息2)は加算せず最大値のみ適用する。
          // ログ用に「どの回復源が採用されたか」も併せて求める
          const rested = u.movesLeft === u.maxMoves && u.attacksLeft === 1;
          let heal = 0;
          let healSource: "village" | "regenerate" | "healer" | "rest" | null = null;
          const consider = (amount: number, source: NonNullable<typeof healSource>) => {
            if (amount > heal) {
              heal = amount;
              healSource = source;
            }
          };
          consider(rested || healthy ? REST_HEAL : 0, "rest");
          consider(adjacentHeal, "healer");
          consider(regenerates ? REGEN_HEAL : 0, "regenerate");
          consider(onVillage ? VILLAGE_HEAL : 0, "village");
          u.hp = Math.min(u.maxHp, u.hp + heal);
          if (u.hp > hpBefore) {
            events.push({
              type: "healed",
              unitId: u.id,
              amount: u.hp - hpBefore,
              source: healSource!,
            });
          }
        }
        u.movesLeft = u.maxMoves;
        u.attacksLeft = 1;
        u.slowed = false; // 遅化は治療手段不要、次の自ターン開始で必ず解除される
      }
      // 収入: 基本 + 村 − 維持費
      const income = computeIncome(next, next.activePlayer);
      next.players[next.activePlayer].gold += income.total;
      events.push({
        type: "turnEnded",
        nextPlayer: next.activePlayer,
        turnNumber: next.turnNumber,
        income: income.total,
      });
      // 最長ターン数(任意): 超過したら引き分けで終了。maxTurns未指定なら無制限
      if (next.maxTurns !== undefined && next.turnNumber > next.maxTurns) {
        next.status = "finished";
        next.winner = null;
        events.push({ type: "matchFinished", winner: null });
      }
      break;
    }

    case "surrender": {
      next.status = "finished";
      next.winner = 1 - actorIndex;
      events.push({ type: "matchFinished", winner: next.winner });
      break;
    }

    default: {
      const _exhaustive: never = action;
      throw new EngineError("unknown_action", `未知のアクションです: ${JSON.stringify(_exhaustive)}`);
    }
  }

  next.turnVersion += 1;
  return { state: next, events };
}
