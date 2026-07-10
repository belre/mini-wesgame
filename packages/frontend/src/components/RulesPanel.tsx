"use client";

// ルール簡易説明パネル(2026-07-10)。宣伝デモとして「詳しい説明は無くても遊べる」を
// 保ちつつ、気になった人がいつでも見返せる一枚に留める(本格的なマニュアルは持たない)。
// タブ+自作SVGピクトグラムで1画面1トピックにする(画像アセット不要・PC/スマホの
// サイズ差もSVGなら気にしなくてよい、というユーザー方針2026-07-10)
import { useState } from "react";
import {
  CombatIllustration,
  GoalIllustration,
  MovementIllustration,
  RecruitingIllustration,
} from "./rules/RuleIllustrations";

type TabId = "goal" | "movement" | "combat" | "recruiting";

const TABS: { id: TabId; label: string }[] = [
  { id: "goal", label: "Goal" },
  { id: "movement", label: "Movement" },
  { id: "combat", label: "Combat" },
  { id: "recruiting", label: "Recruiting" },
];

const TAB_CONTENT: Record<TabId, { Illustration: () => React.JSX.Element; text: React.ReactNode }> = {
  goal: {
    Illustration: GoalIllustration,
    text: "Defeat the enemy commander to win. If your commander falls, you lose.",
  },
  movement: {
    Illustration: MovementIllustration,
    text: "Terrain costs movement points (grass is cheap, forest/hills cost more). Moving next to an enemy usually ends your move there (Zone of Control).",
  },
  combat: {
    Illustration: CombatIllustration,
    text: "Hit chance depends on the defender's terrain. Units also get a damage bonus by day (lawful) or by night (chaotic).",
  },
  recruiting: {
    Illustration: RecruitingIllustration,
    text: "Recruit units at your keep while you have gold. New recruits can act starting next turn. Income comes from villages you control.",
  },
};

export default function RulesPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("goal");
  const { Illustration, text } = TAB_CONTENT[tab];

  return (
    <div className="sheet rules-sheet">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>How to Play</h3>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "primary" : undefined}
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Illustration />
      <p style={{ fontSize: 13, marginTop: 12 }}>{text}</p>
    </div>
  );
}
