"use client";

// 戦闘プレビュー: 共有コアエンジンの predictCombat をブラウザ内で直接呼ぶ。
// APIコールを介さず同じJSバンドル内の関数呼び出しとして完結させる(計画書3.3)。
//
// 表示方針(2026-07-09簡略化。docs/backlog.md「確率表現の見直し」): 数字の羅列だった
// 旧UI(攻撃名・特性ブラケット・与/被期待ダメージの2行)は情報過多だったため、
// 攻撃オプションは「攻撃名 ダメージ×回数 命中率」の1行(命中率は色で直感的に)に絞る。
// HPのbefore→afterバーも試したが、パネル全幅に大きく出るわりに伝わりにくいと
// ユーザー判断があり撤回(2026-07-09)。防御側HPは元通りテキスト表示のみにする
import {
  getUnitDef,
  killXp,
  mapById,
  predictCombat,
  terrainAt,
  timeOfDayForTurn,
  type MatchState,
  type UnitState,
} from "@parle-stroika/core-engine";
import { useTranslations } from "next-intl";
import { hitChanceColor } from "@/lib/board/colors";

export default function CombatPreviewPanel({
  board,
  attacker,
  defender,
  pending,
  onConfirm,
  onCancel,
}: {
  board: MatchState;
  attacker: UnitState;
  defender: UnitState;
  pending: boolean;
  onConfirm: (attackIndex: number) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("CombatPreviewPanel");
  const map = mapById(board.mapId);
  const attackerDef = getUnitDef(attacker.unitDefId);
  const defenderDef = getUnitDef(defender.unitDefId);
  const timeOfDay = timeOfDayForTurn(
    board.scheduleId,
    board.startIndex,
    board.turnNumber,
  );

  const predictions = attackerDef.attacks.map((attack) =>
    predictCombat({
      attacker,
      attackerDef,
      defender,
      defenderDef,
      attack,
      attackerTerrain: terrainAt(map, attacker.pos),
      defenderTerrain: terrainAt(map, defender.pos),
      timeOfDay,
      units: board.units, // 奇襲(backstab)の位置判定
    }),
  );

  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>
          {attackerDef.name} → {defenderDef.name}(HP {defender.hp}/
          {defender.maxHp ?? defenderDef.hp})
          <span style={{ color: "#b07fe0", marginLeft: 8, fontSize: 12 }}>
            {t("xpNote", { surviveXp: defenderDef.level, killXp: killXp(defenderDef.level) })}
          </span>
        </h3>
        <button onClick={onCancel}>{t("cancel")}</button>
      </div>
      {attackerDef.attacks.map((attack, index) => {
        const p = predictions[index];
        const hitPct = Math.round(p.hitChance * 100);
        return (
          <button
            key={attack.name + index}
            className="attack-option"
            disabled={pending}
            onClick={() => onConfirm(index)}
          >
            <span>
              {attack.name}{" "}
              <span className="dim" style={{ fontSize: 12 }}>
                {p.damagePerStrike}-{p.strikes}
              </span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: hitChanceColor(p.hitChance) }}>
              {hitPct}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
