import type { CombatResult } from "./combat";
import type { GameEvent } from "./engine";
import { hexDistance } from "./hex";
import { computeVisionSet, isHiddenFrom } from "./visibility";
import type { AttackDef, HexCoord, MatchState } from "./types";

// 相手ターンのログ(索敵・雇用・被攻撃・昇格・自軍の回復/毒)。
// バックエンドは match#{id} / version#{n} に保存済みの state・events を、閲覧者の
// 最後の確認バージョンから最新まで並べて渡す(1バージョン = 1アクション)。
// 「一瞬だけ見えた」情報も落とさないよう、最終状態だけの差分ではなく1ステップずつ判定する。

export interface TurnLogStep {
  turnVersion: number;
  state: MatchState; // このアクション適用後の盤面
  events: GameEvent[];
}

// 被攻撃のリプレイ(カットイン再生)用の縮小DTO。
// UnitStateをそのままAPIに載せない — 再生に必要な情報だけに絞ってペイロードを抑える。
// 打撃列(strikes)と攻撃定義はattackedエントリが元々持つresult/attackerAttackを使う
export interface ReplayBystanderDto {
  unitDefId: string; // 見た目(スプライト)の解決に使う
  owner: number; // チームカラー
  pos: HexCoord;
}
// 戦闘の主役2体はHPバーの再生同期に開始HPが要る
export interface ReplayCombatantDto extends ReplayBystanderDto {
  hp: number; // 戦闘前HP
  maxHp: number;
}
export interface CombatReplayDto {
  attacker: ReplayCombatantDto;
  defender: ReplayCombatantDto;
  // 舞台に立ち得る周辺ユニット(書き割り)。防御側から距離2以内(攻撃は必ず隣接hex間
  // なので舞台=両者の周辺1hexはこの範囲に収まる)かつ、その時点で閲覧者に見えていたもの
  bystanders: ReplayBystanderDto[];
}

export type TurnLogEntry =
  | {
      id: string;
      type: "spotted";
      atVersion: number;
      unitId: string;
      unitDefId: string;
      pos: HexCoord;
      // 同じ相手ターン内で、このユニットが後に攻撃してきた場合はそのattackedエントリのidを指す。
      // 表示側で1行にまとめるかどうかは表示層の裁量とする
      followedByAttackId?: string;
    }
  | {
      id: string;
      type: "attacked";
      atVersion: number;
      attackerId: string;
      attackerUnitDefId: string;
      attackerPos: HexCoord;
      defenderId: string;
      defenderUnitDefId: string;
      defenderPos: HexCoord; // 戦闘発生ヘックス(=自分のユニットの位置)。画面上でジャンプ表示する際に使う
      attackerAttack: AttackDef;
      result: CombatResult;
      // カットインでのリプレイ再生用(戦闘前スナップショットの縮小DTO)。
      // 攻撃側が戦闘前の盤面から特定できない場合(通常は起きない)のみ省略される
      replay?: CombatReplayDto;
    }
  | {
      id: string;
      type: "recruited";
      atVersion: number;
      unitId: string;
      unitDefId: string;
      pos: HexCoord;
    }
  | {
      id: string;
      type: "leveledUp";
      atVersion: number;
      unitId: string;
      fromDefId: string;
      toDefId: string; // AMLAならfromと同じ
      amla: boolean;
      pos: HexCoord;
      // 昇格でUnitDef(≒最大HP)が丸ごと変わる。特性由来のmaxHp誤差は無視できる前提で、
      // 「敵ユニットが今どのUnitDefか」を追う手段としてこのエントリを使う想定
      // (詳細はdocs/architecture.md参照)
    }
  | {
      id: string;
      type: "healed";
      atVersion: number;
      unitId: string;
      unitDefId: string;
      amount: number;
      source: "village" | "regenerate" | "healer" | "rest";
      pos: HexCoord;
    }
  | {
      id: string;
      type: "poisonDamage";
      atVersion: number;
      unitId: string;
      unitDefId: string;
      amount: number;
      pos: HexCoord;
    };

// beforeState = 閲覧者が最後に確認した時点(sinceVersion)の盤面。
// steps は sinceVersion の次のバージョンから最新まで、発生順に並んでいること。
export function computeTurnLog(
  beforeState: MatchState,
  steps: TurnLogStep[],
  viewerUserId: string,
): TurnLogEntry[] {
  const viewerIndex = beforeState.players.findIndex((p) => p.userId === viewerUserId);
  if (viewerIndex < 0) return [];

  const entries: TurnLogEntry[] = [];
  const spottedByUnitId = new Map<string, Extract<TurnLogEntry, { type: "spotted" }>>();
  const loggedUnitIds = new Set<string>(); // spotted/recruited(初回出現)の重複記録防止

  let prevState = beforeState;
  let prevVision = computeVisionSet(prevState, viewerIndex);

  for (const step of steps) {
    const vision = computeVisionSet(step.state, viewerIndex);
    // このステップで新規に生まれたユニット(雇用)。既存ユニットの「視界に入った」と区別する
    const recruitedUnitIds = new Set(
      step.events
        .filter((e): e is Extract<GameEvent, { type: "recruited" }> => e.type === "recruited")
        .map((e) => e.unit.id),
    );

    for (const unit of step.state.units) {
      if (unit.owner === viewerIndex) continue;
      if (loggedUnitIds.has(unit.id)) continue; // そのターン内は初回のみ記録
      const prevUnit = prevState.units.find((u) => u.id === unit.id);
      // 直前に存在しなかった(雇用等)ユニットは「未確認」として扱う
      const wasHidden = prevUnit
        ? isHiddenFrom(prevUnit, viewerIndex, prevState, prevVision)
        : true;
      const isHiddenNow = isHiddenFrom(unit, viewerIndex, step.state, vision);
      if (!wasHidden || isHiddenNow) continue;

      if (!prevUnit && recruitedUnitIds.has(unit.id)) {
        // 視界に入っているエリア(主塔等)で新しく雇用された場合は「視界に入った」ではなく
        // 「雇用された」として区別する(疫病による新規ユニット出現は対象外。現状は
        // 汎用のspottedにフォールバックする)
        entries.push({
          id: `recruited#${unit.id}#${step.turnVersion}`,
          type: "recruited",
          atVersion: step.turnVersion,
          unitId: unit.id,
          unitDefId: unit.unitDefId,
          pos: unit.pos,
        });
        loggedUnitIds.add(unit.id);
        continue;
      }

      const entry: Extract<TurnLogEntry, { type: "spotted" }> = {
        id: `spotted#${unit.id}#${step.turnVersion}`,
        type: "spotted",
        atVersion: step.turnVersion,
        unitId: unit.id,
        unitDefId: unit.unitDefId,
        pos: unit.pos,
      };
      entries.push(entry);
      spottedByUnitId.set(unit.id, entry);
      loggedUnitIds.add(unit.id);
    }

    step.events.forEach((event, index) => {
      if (event.type === "combat") {
        // 攻撃側は常に相手ターンの行動者。自分のユニットが的にされた場合のみログ化する
        const defender = prevState.units.find((u) => u.id === event.defenderId);
        if (!defender || defender.owner !== viewerIndex) return;
        const attacker = prevState.units.find((u) => u.id === event.attackerId);

        // リプレイ(カットイン再生)用: 戦闘前の盤面から縮小DTOを組み立てる。
        // 書き割りは防御側から距離2以内+その時点で閲覧者に見えていたもののみ(霧の情報漏れ防止)
        const replay: CombatReplayDto | undefined = attacker
          ? {
              attacker: {
                unitDefId: attacker.unitDefId,
                owner: attacker.owner,
                pos: attacker.pos,
                hp: attacker.hp,
                maxHp: attacker.maxHp,
              },
              defender: {
                unitDefId: defender.unitDefId,
                owner: defender.owner,
                pos: defender.pos,
                hp: defender.hp,
                maxHp: defender.maxHp,
              },
              bystanders: prevState.units
                .filter(
                  (u) =>
                    u.id !== attacker.id &&
                    u.id !== defender.id &&
                    hexDistance(u.pos, defender.pos) <= 2 &&
                    !isHiddenFrom(u, viewerIndex, prevState, prevVision),
                )
                .map((u) => ({ unitDefId: u.unitDefId, owner: u.owner, pos: u.pos })),
            }
          : undefined;

        const entry: Extract<TurnLogEntry, { type: "attacked" }> = {
          id: `attacked#${step.turnVersion}#${index}`,
          type: "attacked",
          atVersion: step.turnVersion,
          attackerId: event.attackerId,
          attackerUnitDefId: attacker?.unitDefId ?? "",
          attackerPos: attacker?.pos ?? defender.pos,
          defenderId: event.defenderId,
          defenderUnitDefId: defender.unitDefId,
          defenderPos: defender.pos,
          attackerAttack: event.attackerAttack,
          result: event.result,
          replay,
        };
        entries.push(entry);

        const spotted = spottedByUnitId.get(event.attackerId);
        if (spotted && spotted.followedByAttackId === undefined) {
          spotted.followedByAttackId = entry.id;
        }
        return;
      }

      if (event.type === "levelUp") {
        const unit = step.state.units.find((u) => u.id === event.unitId);
        if (!unit || unit.owner === viewerIndex) return;
        if (isHiddenFrom(unit, viewerIndex, step.state, vision)) return; // 隠れている敵の昇格は見せない
        entries.push({
          id: `leveledUp#${step.turnVersion}#${index}`,
          type: "leveledUp",
          atVersion: step.turnVersion,
          unitId: event.unitId,
          fromDefId: event.fromDefId,
          toDefId: event.toDefId,
          amla: event.amla,
          pos: unit.pos,
        });
        return;
      }

      // healed/poisonDamageは相手ターンの行動ではなく、相手のendTurnによって
      // 「閲覧者自身のターンが開始した」ことで発生する自軍側のイベント。
      // spotted/attacked/leveledUpとは逆に、閲覧者自身のユニットの場合のみログ化する
      if (event.type === "healed") {
        const unit = step.state.units.find((u) => u.id === event.unitId);
        if (!unit || unit.owner !== viewerIndex) return;
        entries.push({
          id: `healed#${step.turnVersion}#${index}`,
          type: "healed",
          atVersion: step.turnVersion,
          unitId: event.unitId,
          unitDefId: unit.unitDefId,
          amount: event.amount,
          source: event.source,
          pos: unit.pos,
        });
        return;
      }

      if (event.type === "poisonDamage") {
        const unit = step.state.units.find((u) => u.id === event.unitId);
        if (!unit || unit.owner !== viewerIndex) return;
        entries.push({
          id: `poisonDamage#${step.turnVersion}#${index}`,
          type: "poisonDamage",
          atVersion: step.turnVersion,
          unitId: event.unitId,
          unitDefId: unit.unitDefId,
          amount: event.amount,
          pos: unit.pos,
        });
      }
    });

    prevState = step.state;
    prevVision = vision;
  }

  return entries;
}
