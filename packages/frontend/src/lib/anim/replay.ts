// 相手ターンログの被攻撃エントリ → カットイン再生入力(CombatPlaybackInput)への変換。
// ログAPIはペイロード削減のため縮小DTO(ReplayCombatantDto/ReplayBystanderDto)を返すので、
// ここでUnitStateへ復元する(再生に関わらないフィールドはデフォルト埋め)。
// React/DOM非依存の純関数(テスト: test/replay.test.ts)
import {
  getUnitDef,
  type ReplayBystanderDto,
  type ReplayCombatantDto,
  type TurnLogEntry,
  type UnitState,
} from "@parle-stroika/core-engine";
import type { CombatPlaybackInput } from "./combatTimeline";

export type AttackedEntry = Extract<TurnLogEntry, { type: "attacked" }>;

function dtoToUnit(dto: ReplayCombatantDto | ReplayBystanderDto, id: string): UnitState {
  const hp = "hp" in dto ? dto.hp : getUnitDef(dto.unitDefId).hp;
  const maxHp = "maxHp" in dto ? dto.maxHp : hp;
  return {
    id,
    unitDefId: dto.unitDefId,
    owner: dto.owner,
    pos: dto.pos,
    hp,
    maxHp,
    movesLeft: 0,
    maxMoves: 0,
    attacksLeft: 0,
    isLeader: false,
    traits: [],
    poisoned: false,
    xp: 0,
  };
}

// 打撃列と攻撃定義はエントリが元々持つresult/attackerAttackを使う。
// replayペイロードが無いエントリ(攻撃側が戦闘前盤面から特定できなかった等)はnull
export function replayToPlayback(entry: AttackedEntry): CombatPlaybackInput | null {
  const r = entry.replay;
  if (!r) return null;
  return {
    attacker: dtoToUnit(r.attacker, entry.attackerId),
    defender: dtoToUnit(r.defender, entry.defenderId),
    strikes: entry.result.strikes,
    ghosts: [],
    attackerAttackId: entry.attackerAttack.id,
    defenderAttackId: entry.result.retaliationAttack?.id,
    bystanders: r.bystanders.map((b, i) => dtoToUnit(b, `replay-b${i}`)),
  };
}
