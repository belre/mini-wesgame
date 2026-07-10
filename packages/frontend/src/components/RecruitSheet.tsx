"use client";

// 雇用フロー Stage 2: どのユニットを雇うかはヘックス空間から切り離した
// ボトムシートのカードUIで選ぶ(計画書3.4)。アイコンは組み込みbase立ち絵
// (UNIT_BASE_IMAGES)を使う。CDN取得を待たずに出せる+雇用前(まだowner確定の
// アニメスプライトを読む理由がない場面)なので、あえてチームカラー着色はしない
import type { Faction } from "@parle-stroika/core-engine";
import { useTranslations } from "next-intl";
import { UNIT_BASE_IMAGES } from "@/generated/unitBaseImages";

// HP/移動力/攻撃力の数値を並べるより、「何が得意なユニットか」を一言で
// ガイドする方が伝わりやすい、というユーザー方針(2026-07-10)。
// 現行ロスター(各陣営4種、game-data-editingスキルの「役割が被らない」構成)に
// 合わせた手書きの短文。ロスターを増やす際はここにも追記すること
const UNIT_ROLE_HINTS: Record<string, string> = {
  spearman: "Strikes first in melee",
  bowman: "Attacks from range",
  cavalryman: "Fast, hard-hitting cavalry",
  mage: "Ranged magic, steady aim",
  orcish_grunt: "Solid all-around fighter",
  orcish_archer: "Attacks from range",
  wolf_rider: "Very fast raider",
  troll_whelp: "Slow, but heals every turn",
};

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
        .map((u) => {
          const icon = UNIT_BASE_IMAGES[u.spriteKey];
          return (
            <button
              key={u.id}
              className="recruit-card"
              data-unit-def-id={u.id}
              disabled={gold < u.cost}
              onClick={() => onPick(u.id)}
            >
              {icon ? (
                <img className="recruit-card-icon" src={icon} alt="" />
              ) : (
                <div className="recruit-card-icon" />
              )}
              <span className="recruit-card-body">
                {u.name}
                <span className="dim" style={{ marginLeft: 8, fontSize: 12 }}>
                  {UNIT_ROLE_HINTS[u.id] ?? ""}
                </span>
              </span>
              <span className="recruit-card-cost">{u.cost}</span>
            </button>
          );
        })}
    </div>
  );
}
