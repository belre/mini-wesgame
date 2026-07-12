"use client";

// 雇用フロー Stage 2: どのユニットを雇うかはヘックス空間から切り離した
// ボトムシートのカードUIで選ぶ(計画書3.4)。アイコンはbase立ち絵
// (UNIT_BASE_IMAGES)を使う。プレイヤーは常にowner 0(青軍)固定なので、
// アイコンもチームカラー変換して見た目を統一する(2026-07-12: 生の素材色が
// 赤系に見えて自軍の雇用欄が敵陣営に見えるという指摘を受けて着色に変更)
import type { Faction, UnitDef } from "@parle-stroika/core-engine";
import { useTranslations } from "next-intl";
import { useTeamColoredIcon } from "@/lib/sprites";

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
  recruitUnitIds,
}: {
  faction: Faction;
  gold: number;
  // モードによる雇用制限(PlayerState.recruitUnitIds)。未指定は陣営の既定リスト
  recruitUnitIds?: string[];
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
        .filter((u) => (recruitUnitIds ?? faction.recruitableUnitIds).includes(u.id))
        .map((u) => (
          <RecruitCard key={u.id} unit={u} gold={gold} onPick={onPick} />
        ))}
    </div>
  );
}

function RecruitCard({
  unit,
  gold,
  onPick,
}: {
  unit: UnitDef;
  gold: number;
  onPick: (unitDefId: string) => void;
}) {
  // プレイヤーは常にowner 0固定(FactionSelectの前提と同じ)
  const icon = useTeamColoredIcon(unit.spriteKey, 0);
  return (
    <button
      className="recruit-card"
      data-unit-def-id={unit.id}
      disabled={gold < unit.cost}
      onClick={() => onPick(unit.id)}
    >
      {icon ? (
        <img className="recruit-card-icon" src={icon} alt="" />
      ) : (
        <div className="recruit-card-icon" />
      )}
      <span className="recruit-card-body">
        {unit.name}
        <span className="dim" style={{ marginLeft: 8, fontSize: 12 }}>
          {UNIT_ROLE_HINTS[unit.id] ?? ""}
        </span>
      </span>
      <span className="recruit-card-cost">{unit.cost}</span>
    </button>
  );
}
