"use client";

// mini-wesgame の陣営選択画面(2026-07-10)。トップ画面はここから始まり、
// 選ぶまで対局は作られない(選ぶたびに対局コンポーネントが新規マウントされるので、
// 「configだけ差し替えて内部stateが追従しない」という再戦バグの構造自体が起きない)。
// プレイヤーは常に先攻(index 0)、選んだ陣営が自軍になる。
import { getFaction, resolveLeaderDef } from "@parle-stroika/core-engine";
import { useTeamColoredIcon } from "@/lib/sprites";

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
        {OPTIONS.map((factionId) => (
          <FactionOptionButton key={factionId} factionId={factionId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function FactionOptionButton({
  factionId,
  onSelect,
}: {
  factionId: string;
  onSelect: (factionId: string) => void;
}) {
  const faction = getFaction(factionId);
  const leader = resolveLeaderDef(factionId);
  // プレイヤーは常にowner 0(青軍)固定なので、アイコンもチームカラー変換する
  // (2026-07-12: 生の素材色が赤系に見えるという指摘を受けて着色に変更)
  const icon = useTeamColoredIcon(leader.spriteKey, 0);
  return (
    <button className="faction-select-btn" onClick={() => onSelect(factionId)}>
      {icon && <img src={icon} alt="" style={{ imageRendering: "pixelated" }} />}
      <span>{faction.name}</span>
    </button>
  );
}
