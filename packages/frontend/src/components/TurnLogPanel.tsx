"use client";

// 相手ターンログ(索敵・雇用・被攻撃・昇格・自軍の回復/毒)の表示。
// まずはシンプルな文字列羅列(演出は将来対応)。
import { getUnitDef, type TurnLogEntry } from "@parle-stroika/core-engine";
import { useTranslations, type useTranslations as UseTranslations } from "next-intl";

type T = ReturnType<typeof UseTranslations<"TurnLogPanel">>;

const HEAL_SOURCE_KEY: Record<Extract<TurnLogEntry, { type: "healed" }>["source"], string> = {
  village: "healSourceVillage",
  regenerate: "healSourceRegenerate",
  healer: "healSourceHealer",
  rest: "healSourceRest",
};

function unitName(unitDefId: string, t: T): string {
  if (!unitDefId) return t("unknownUnit");
  try {
    return getUnitDef(unitDefId).name;
  } catch {
    return t("unknownUnit");
  }
}

function hexLabel(pos: { x: number; y: number }): string {
  return `(x:${pos.x}, y:${pos.y})`;
}

function describe(entry: TurnLogEntry, t: T): string {
  if (entry.type === "spotted") {
    const name = unitName(entry.unitDefId, t);
    const text = entry.followedByAttackId
      ? t("spottedAmbush", { name })
      : t("spottedShadow", { name });
    return `${text} ${hexLabel(entry.pos)}`;
  }
  if (entry.type === "recruited") {
    return `${t("recruited", { name: unitName(entry.unitDefId, t) })} ${hexLabel(entry.pos)}`;
  }
  if (entry.type === "leveledUp") {
    const text = entry.amla
      ? t("leveledUpAmla", { name: unitName(entry.toDefId, t) })
      : t("leveledUpPromote", {
          from: unitName(entry.fromDefId, t),
          to: unitName(entry.toDefId, t),
        });
    return `${text} ${hexLabel(entry.pos)}`;
  }
  if (entry.type === "healed") {
    return `${t("healed", {
      name: unitName(entry.unitDefId, t),
      source: t(HEAL_SOURCE_KEY[entry.source] as Parameters<T>[0]),
      amount: entry.amount,
    })} ${hexLabel(entry.pos)}`;
  }
  if (entry.type === "poisonDamage") {
    return `${t("poisonDamage", { name: unitName(entry.unitDefId, t), amount: entry.amount })} ${hexLabel(entry.pos)}`;
  }
  const attackerName = unitName(entry.attackerUnitDefId, t);
  const defenderName = unitName(entry.defenderUnitDefId, t);
  const dealt = entry.result.strikes
    .filter((s) => s.actor === "attacker")
    .reduce((sum, s) => sum + s.damage, 0);
  const outcome = entry.result.defenderDied
    ? t("defeated", { name: defenderName })
    : t("tookDamage", { name: defenderName, amount: dealt });
  return `${t("attackedBy", { name: attackerName, attackName: entry.attackerAttack.name })} ${outcome} ${hexLabel(entry.defenderPos)}`;
}

export default function TurnLogPanel({
  entries,
  onDismiss,
  onPlayReplay,
}: {
  entries: TurnLogEntry[];
  onDismiss: () => void;
  // 被攻撃エントリのカットインリプレイ再生(replayペイロードがある行に▶を出す)
  onPlayReplay?: (entry: Extract<TurnLogEntry, { type: "attacked" }>) => void;
}) {
  const t = useTranslations("TurnLogPanel");
  if (entries.length === 0) return null;
  // リプレイ可能な被攻撃(発生順)。「まとめて再生」はキューに順に積むだけで連続再生になる
  const replayable = entries.filter(
    (e): e is Extract<TurnLogEntry, { type: "attacked" }> =>
      e.type === "attacked" && !!e.replay,
  );
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>📜 {t("heading")}</strong>
        {onPlayReplay && replayable.length > 0 && (
          <button
            className="primary"
            onClick={() => replayable.forEach(onPlayReplay)}
            title={t("replayAllTitle")}
          >
            {t("replayAllButton", { count: replayable.length })}
          </button>
        )}
        <button onClick={onDismiss}>{t("closeButton")}</button>
      </div>
      <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
        {entries.map((e) => (
          <li key={e.id}>
            {describe(e, t)}
            {e.type === "attacked" && e.replay && onPlayReplay && (
              <button
                onClick={() => onPlayReplay(e)}
                style={{ marginLeft: 8, fontSize: 11, padding: "0 8px" }}
                title={t("replayButtonTitle")}
              >
                {t("replayButton")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
