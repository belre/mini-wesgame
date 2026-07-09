"use client";

// 雇用フロー Stage 2: どのユニットを雇うかはヘックス空間から切り離した
// ボトムシートのリストUIで選ぶ(計画書3.4)。
import { ABILITY_NAMES, SPECIAL_NAMES, type Faction } from "@parle-stroika/core-engine";
import { useTranslations } from "next-intl";

export default function RecruitSheet({
  faction,
  gold,
  onPick,
  onClose,
}: {
  faction: Faction;
  gold: number;
  onPick: (unitDefId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("RecruitSheet");
  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>
          {t("heading")} <span style={{ color: "var(--gold)" }}>{t("goldLabel", { gold })}</span>
        </h3>
        <button onClick={onClose}>{t("closeButton")}</button>
      </div>
      {faction.units
        .filter((u) => faction.recruitableUnitIds.includes(u.id))
        .map((u) => (
          <button
            key={u.id}
            className="recruit-item"
            disabled={gold < u.cost}
            onClick={() => onPick(u.id)}
          >
            <span>
              {u.name}
              {u.abilities && u.abilities.length > 0 && (
                <span style={{ color: "#7ec8e3", marginLeft: 6, fontSize: 12 }}>
                  {u.abilities.map((a) => ABILITY_NAMES[a]).join("・")}
                </span>
              )}
              <span className="dim" style={{ marginLeft: 8, fontSize: 12 }}>
                {t("statLine", { hp: u.hp, move: u.movement.points })}
                {u.movement.type === "fly" ? t("flying") : ""} /{" "}
                {u.attacks
                  .map(
                    (a) =>
                      `${a.name}${a.damage}×${a.count}${
                        a.specials?.length
                          ? `[${a.specials.map((s) => SPECIAL_NAMES[s]).join("・")}]`
                          : ""
                      }`,
                  )
                  .join("・")}
              </span>
            </span>
            <span style={{ color: "var(--gold)", whiteSpace: "nowrap" }}>{u.cost}</span>
          </button>
        ))}
    </div>
  );
}
