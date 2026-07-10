"use client";

// mini-wesgame の陣営選択画面(2026-07-10)。トップ画面はここから始まり、
// 選ぶまで対局は作られない(選ぶたびに対局コンポーネントが新規マウントされるので、
// 「configだけ差し替えて内部stateが追従しない」という再戦バグの構造自体が起きない)。
// プレイヤーは常に先攻(index 0)、選んだ陣営が自軍になる。
import { getFaction, resolveLeaderDef } from "@parle-stroika/core-engine";
import { UNIT_BASE_IMAGES } from "@/lib/content/unitBaseImages";

export const HUMAN_FACTION_ID = "loyalists";
export const ORC_FACTION_ID = "northerners";

const OPTIONS = [HUMAN_FACTION_ID, ORC_FACTION_ID];

export default function FactionSelect({
  onSelect,
}: {
  onSelect: (factionId: string) => void;
}) {
  return (
    <div className="faction-select-screen">
      <h1 style={{ fontSize: 20 }}>Mini Wesgame</h1>
      <p className="dim" style={{ fontSize: 13 }}>Choose your faction</p>
      <div className="row" style={{ gap: 16, justifyContent: "center" }}>
        {OPTIONS.map((factionId) => {
          const faction = getFaction(factionId);
          const leader = resolveLeaderDef(factionId);
          const icon = UNIT_BASE_IMAGES[leader.spriteKey];
          return (
            <button
              key={factionId}
              className="faction-select-btn"
              onClick={() => onSelect(factionId)}
            >
              {icon && (
                <img src={icon} alt="" style={{ imageRendering: "pixelated" }} />
              )}
              <span>{faction.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
