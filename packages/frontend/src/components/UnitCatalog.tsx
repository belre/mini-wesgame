"use client";

// 全ユニットの一覧表(開発用 /dev/units)。バランス調整・検証比較のための
// カタログで、core-engine の FACTIONS(=ゲームの正データ)をそのまま表にする。
// 絵は組み込みbase立ち絵(unitBaseImages。fetch不要でオフラインでも出る)
import {
  ABILITY_NAMES,
  FACTIONS,
  IMPASSABLE,
  maxXpFor,
  SPECIAL_NAMES,
  TERRAIN_BY_CHAR,
  TERRAINS,
  TRAIT_NAMES,
  ZOMBIE_VARIATIONS,
  type UnitDef,
} from "@parle-stroika/core-engine";
import type { DefenseType } from "@parle-stroika/core-engine";
import { UNIT_BASE_IMAGES } from "@/generated/unitBaseImages";

const ALIGNMENT_NAMES: Record<string, string> = {
  lawful: "秩序",
  chaotic: "混沌",
  neutral: "中立",
};
const MOVE_TYPE_NAMES: Record<string, string> = { walk: "歩行", fly: "飛行", swim: "水棲" };
// defenseTypeがmovement.typeと別枠を持つ場合の表示名(cavalry/lightfoot)
const DEFENSE_TYPE_NAMES: Record<string, string> = { cavalry: "騎馬", lightfoot: "軽装" };
const DAMAGE_TYPE_NAMES: Record<string, string> = {
  blade: "斬撃",
  pierce: "刺突",
  impact: "打撃",
  fire: "火炎",
  cold: "冷気",
  arcane: "秘術",
};

const cell: React.CSSProperties = {
  border: "1px solid #2a3242",
  padding: "4px 8px",
  verticalAlign: "top",
  fontSize: 12,
  whiteSpace: "nowrap",
};

function AttackList({ unit }: { unit: UnitDef }) {
  return (
    <>
      {unit.attacks.map((a) => (
        <div key={a.id}>
          {a.name} <b>{a.damage}×{a.count}</b>{" "}
          <span style={{ color: "#8a94a3" }}>
            {a.range === "melee" ? "近接" : "遠隔"}・{DAMAGE_TYPE_NAMES[a.type] ?? a.type}
            {a.specials?.length ? `・${a.specials.map((s) => SPECIAL_NAMES[s] ?? s).join("・")}` : ""}
          </span>
        </div>
      ))}
    </>
  );
}

function Resistances({ unit }: { unit: UnitDef }) {
  const entries = Object.entries(unit.resistances).filter(([, v]) => v !== 0);
  if (entries.length === 0) return <span style={{ color: "#566" }}>—</span>;
  return (
    <>
      {entries.map(([t, v]) => (
        <div key={t} style={{ color: (v ?? 0) > 0 ? "#8ee08e" : "#e08a8a" }}>
          {DAMAGE_TYPE_NAMES[t] ?? t} {(v ?? 0) > 0 ? "+" : ""}{v}%
        </div>
      ))}
    </>
  );
}

// このユニットが movement.terrainOverrides / defenseOverrides で「そのユニット固有」に
// 上書きしている地形だけを一覧する(=兵科の一般則からの差分。cavalryのような
// defenseType丸ごとの切り替えはTerrainCatalogの騎馬列・(移動・防御:騎馬)表示で
// 既に見えているので、ここでは対象外)
function TerrainOverrideDiff({ unit }: { unit: UnitDef }) {
  const moveType = unit.movement.type;
  const defType: DefenseType = unit.defenseType ?? unit.movement.type;
  const terrainIds = [
    ...new Set([
      ...Object.keys(unit.movement.terrainOverrides ?? {}),
      ...Object.keys(unit.defenseOverrides ?? {}),
    ]),
  ];
  if (terrainIds.length === 0) return <span style={{ color: "#566" }}>—</span>;
  return (
    <>
      {terrainIds.map((terrainId) => {
        const terrain = TERRAINS[terrainId];
        const moveOverride = unit.movement.terrainOverrides?.[terrainId];
        const defOverride = unit.defenseOverrides?.[terrainId];
        const moveBase = terrain.moveCost[moveType];
        const defBase = terrain.defenseBonus[defType];
        return (
          <div key={terrainId}>
            <b>{terrain.name}</b>:{" "}
            {moveOverride !== undefined && (
              <span style={{ color: moveOverride < moveBase ? "#8ee08e" : "#e08a8a" }}>
                移動{moveOverride >= IMPASSABLE ? "不可" : moveOverride}(通常{moveBase >= IMPASSABLE ? "不可" : moveBase})
              </span>
            )}
            {moveOverride !== undefined && defOverride !== undefined && " / "}
            {defOverride !== undefined && (
              <span style={{ color: defOverride > defBase ? "#8ee08e" : "#e08a8a" }}>
                防御{defOverride}%(通常{defBase}%)
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

// 表示順序(2026-07-08 ユーザー指定。比較しやすいグループ順: 開けた地形→建物→水系→
// トーチカ→砂系→洞窟→通行不能)。TERRAINS(正データ)自体の並びは変えない
// (docs/terrain_audit/*.csv の地形順はTERRAIN_BY_CHAR基準のため影響を受けない)
const TERRAIN_DISPLAY_ORDER = [
  "grassland", "hills", "mountains", "forest",
  "village", "castle", "keep",
  "swamp", "shallow_water", "reef", "deep_water",
  "tochka",
  "sand", "desert",
  "cave",
  "obstacle", "void",
];

// 地形×移動型のマトリクス(移動コストと防御率)。ユニット表と並ぶ
// 「生きた仕様書」のもう片輪 — TERRAINS(正データ)を表示用の順序でレンダリングする
function TerrainCatalog() {
  const charOf = new Map(Object.entries(TERRAIN_BY_CHAR).map(([ch, id]) => [id, ch]));
  const orderedTerrains = TERRAIN_DISPLAY_ORDER.map((id) => TERRAINS[id]);
  const cost = (v: number) =>
    v >= IMPASSABLE ? <span style={{ color: "#e08a8a", fontWeight: 700 }}>不可</span> : v;
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, borderBottom: "1px solid #2a3242", paddingBottom: 4 }}>
        地形(移動コスト / 防御率)
      </h2>
      <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0" }}>
        騎馬(cavalry)・軽装(lightfoot)は移動・防御ともに専用列を参照(本家mounted/elusivefoot準拠で
        歩行とは別枠)。軽装は岩場(mountains)にも例外的に進入できる。防御率=攻撃の外れやすさ(%)
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", marginTop: 4 }}>
          <thead>
            <tr style={{ background: "#161c26" }}>
              {["ID", "名前", "文字", "移動:歩行", "移動:飛行", "移動:水棲", "移動:騎馬", "移動:軽装", "防御:歩行", "防御:飛行", "防御:水棲", "防御:騎馬", "防御:軽装"].map((h) => (
                <th key={h} style={{ ...cell, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedTerrains.map((t) => (
              <tr key={t.id}>
                <td style={{ ...cell, color: "#8a94a3" }}>{t.id}</td>
                <td style={cell}><b>{t.name}</b></td>
                <td style={{ ...cell, textAlign: "center" }}>{charOf.get(t.id) ?? "—"}</td>
                <td style={cell}>{cost(t.moveCost.walk)}</td>
                <td style={cell}>{cost(t.moveCost.fly)}</td>
                <td style={cell}>{cost(t.moveCost.swim)}</td>
                <td style={cell}>{cost(t.moveCost.cavalry)}</td>
                <td style={cell}>{cost(t.moveCost.lightfoot)}</td>
                <td style={cell}>{t.defenseBonus.walk}%</td>
                <td style={cell}>{t.defenseBonus.fly}%</td>
                <td style={cell}>{t.defenseBonus.swim}%</td>
                <td style={cell}>{t.defenseBonus.cavalry}%</td>
                <td style={cell}>{t.defenseBonus.lightfoot}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// 疫病(plague)の死体フォーム一覧。Faction.plagueCorpseUnitIdが未配線の間は
// どの陣営からも参照されない「宙に浮いた」データなので、通常のFaction別ロスター
// (アンデッドの units 配列に物理的には同居している)からは除外し、ここで単独表示する
function ZombieCatalog() {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, borderBottom: "1px solid #2a3242", paddingBottom: 4 }}>
        疫病の死体フォーム(zombie.ts)
        <span style={{ color: "#8a94a3", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
          全{ZOMBIE_VARIATIONS.length}種・未配線(Faction.plagueCorpseUnitIdが空なので実戦では未使用)
        </span>
      </h2>
      <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0" }}>
        倒された側の種族に応じた死体フォーム。本家Wesnothのvariationを移植(HP・移動のみ差分、
        攻撃・耐性・コストは基本形walking_corpseと共通)
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ background: "#161c26" }}>
              {["絵", "ID", "名前", "Lv", "HP", "移動", "地形差分", "属性", "コスト", "攻撃", "耐性"].map((h) => (
                <th key={h} style={{ ...cell, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ZOMBIE_VARIATIONS.map((u) => {
              const img = UNIT_BASE_IMAGES[u.spriteKey];
              return (
              <tr key={u.id}>
                <td style={{ ...cell, textAlign: "center" }}>
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={u.name} width={36} height={36}
                      style={{ imageRendering: "pixelated", objectFit: "contain" }} />
                  ) : (
                    <span style={{ color: "#566" }}>—</span>
                  )}
                </td>
                <td style={{ ...cell, color: "#8a94a3" }}>{u.id}</td>
                <td style={cell}><b>{u.name}</b></td>
                <td style={cell}>{u.level}</td>
                <td style={cell}>{u.hp}</td>
                <td style={cell}>
                  {MOVE_TYPE_NAMES[u.movement.type] ?? u.movement.type} {u.movement.points}
                  {u.defenseType && DEFENSE_TYPE_NAMES[u.defenseType] && (
                    <span style={{ color: "#8a94a3" }}>(移動・防御:{DEFENSE_TYPE_NAMES[u.defenseType]})</span>
                  )}
                </td>
                <td style={cell}><TerrainOverrideDiff unit={u} /></td>
                <td style={cell}>{ALIGNMENT_NAMES[u.alignment] ?? u.alignment}</td>
                <td style={cell}>{u.cost}</td>
                <td style={{ ...cell }}><AttackList unit={u} /></td>
                <td style={cell}><Resistances unit={u} /></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function UnitCatalog() {
  return (
    <div style={{ minHeight: "100vh", background: "#0c0f14", color: "#dfe6f2", padding: 16 }}>
      <h1 style={{ fontSize: 18 }}>ゲームデータカタログ(/dev/units)</h1>
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        core-engine の正データ(TERRAINS / FACTIONS)をそのまま表示する「生きた仕様書」。
        バランス調整・検証比較用。ユニットの「雇用」=雇用可能 / 「隊長」=リーダー候補 /
        無印=昇格先専用。XPは特性補正前の必要経験値
      </p>
      <TerrainCatalog />
      <ZombieCatalog />
      {Object.values(FACTIONS).map((faction) => {
        const zombieIds = new Set(ZOMBIE_VARIATIONS.map((v) => v.id));
        const units = faction.units.filter((u) => !zombieIds.has(u.id));
        return (
        <section key={faction.id} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, borderBottom: "1px solid #2a3242", paddingBottom: 4 }}>
            {faction.name}
            <span style={{ color: "#8a94a3", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              {faction.id}(全{units.length}種)
            </span>
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", marginTop: 8 }}>
              <thead>
                <tr style={{ background: "#161c26" }}>
                  {["絵", "ID", "名前", "役割", "Lv", "HP", "移動", "地形差分", "属性", "コスト", "XP", "昇格先", "攻撃", "耐性", "能力", "特性"].map((h) => (
                    <th key={h} style={{ ...cell, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const img = UNIT_BASE_IMAGES[u.spriteKey];
                  const roles = [
                    faction.recruitableUnitIds.includes(u.id) ? "雇用" : null,
                    faction.availableLeaderUnitIds.includes(u.id) ? "隊長" : null,
                  ].filter(Boolean);
                  return (
                    <tr key={u.id}>
                      <td style={{ ...cell, textAlign: "center" }}>
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={u.name} width={36} height={36}
                            style={{ imageRendering: "pixelated", objectFit: "contain" }} />
                        ) : (
                          <span style={{ color: "#566" }}>—</span>
                        )}
                      </td>
                      <td style={{ ...cell, color: "#8a94a3" }}>{u.id}</td>
                      <td style={cell}><b>{u.name}</b></td>
                      <td style={cell}>{roles.join("・") || <span style={{ color: "#566" }}>—</span>}</td>
                      <td style={cell}>{u.level}</td>
                      <td style={cell}>{u.hp}</td>
                      <td style={cell}>
                        {MOVE_TYPE_NAMES[u.movement.type] ?? u.movement.type} {u.movement.points}
                        {u.defenseType && DEFENSE_TYPE_NAMES[u.defenseType] && (
                          <span style={{ color: "#8a94a3" }}>(移動・防御:{DEFENSE_TYPE_NAMES[u.defenseType]})</span>
                        )}
                      </td>
                      <td style={cell}><TerrainOverrideDiff unit={u} /></td>
                      <td style={cell}>{ALIGNMENT_NAMES[u.alignment] ?? u.alignment}</td>
                      <td style={cell}>{u.cost}</td>
                      <td style={cell}>{maxXpFor(u, [])}</td>
                      <td style={cell}>
                        {u.advancesTo?.length
                          ? u.advancesTo.join(", ")
                          : <span style={{ color: "#566" }}>AMLA</span>}
                      </td>
                      <td style={{ ...cell }}><AttackList unit={u} /></td>
                      <td style={cell}><Resistances unit={u} /></td>
                      <td style={cell}>
                        {u.abilities?.length
                          ? u.abilities.map((a) => ABILITY_NAMES[a] ?? a).join("・")
                          : <span style={{ color: "#566" }}>—</span>}
                      </td>
                      <td style={cell}>
                        {u.traitConfig
                          ? [
                              ...(u.traitConfig.forced ?? []).map((t) => `${TRAIT_NAMES[t] ?? t}(固定)`),
                              ...(u.traitConfig.pool?.length
                                ? [`候補${u.traitConfig.picks ?? 0}: ${u.traitConfig.pool.map((t) => TRAIT_NAMES[t] ?? t).join("/")}`]
                                : []),
                            ].join(" ")
                          : <span style={{ color: "#566" }}>なし</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        );
      })}
    </div>
  );
}
