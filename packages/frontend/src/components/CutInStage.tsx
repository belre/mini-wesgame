"use client";

// 戦闘カットイン(A-6骨格): combatTimelineを購読する「もう一つのレンダラー」。
// 盤面=操作 / カットイン=演出 の役割分担(design_diorama.md)。
//
// 座標系の設計: 本盤面と同じ盤面px(hexCenter)をそのまま使い、SVGのviewBoxを
// 戦闘周辺に窓取りする。ステージは盤面px等倍(width=viewBox幅)で組み、
// 表示サイズへの拡大は外側の2D scale(パネル実幅に合わせるk)で行う。
//
// mini-wesgame(2026-07-09): 傾き(tilted)・視点反転(viewFlipped)は廃止し平面固定。
//
// 骨格の範囲: 背景の一枚絵(防御側地形単位のAI生成)はA-3のパイプライン確立後に
// 差し替える。スキップ操作・再生ポリシー(自分の攻撃とCPU戦のみ)は結線側で今後対応
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  displayDamage,
  getUnitDef,
  hexKey,
  hexNeighbors,
  inBounds,
  leadershipSupportersOf,
  summarizeCombatMoments,
  terrainAt,
  type GameMap,
  type TimeOfDayDef,
  type UnitState,
} from "@parle-stroika/core-engine";
import type { CombatFx, CombatPlaybackInput } from "@/hooks/useCombatAnimations";
import { imageNaturalSize, resolveAssetUrl, SPRITE_REGISTRY } from "@/lib/sprites";
import { HEX_WIDTH_PX, hexCenter } from "@/lib/board/geometry";
import { OWNER_COLORS, hpColor } from "@/lib/board/colors";
import { buildTerrainObjectItems, pickTerrainObjects } from "@/lib/board/objects";
import { UnitBody } from "./board/UnitBody";
import { TerrainObjectBillboard } from "./board/TerrainObjectBillboard";
import { TerrainTile } from "./board/TerrainTile";

// 戦闘情報プレート(FEの戦闘画面の情報帯に相当): 名前・Lv・使用攻撃・HP数値。
// HPはfx.hpOverridesで打撃に同期して減っていく(数字が動くのが「読む画面」の主役)。
// 左右は攻守ではなく敵味方で固定(自軍=左・敵軍=右)。誰が仕掛けたかは⚔/(反撃)の表記で読む
function CombatantPlate({
  unit,
  attackId,
  role,
  align,
  fx,
  leadership,
  timeOfDay,
}: {
  unit: UnitState;
  attackId?: string;
  role: "attacker" | "defender";
  align: "left" | "right";
  fx: CombatFx;
  leadership: boolean; // hasLeadershipSupport(unit, ...)の結果(CutInStageが計算済み)
  timeOfDay: TimeOfDayDef;
}) {
  const t = useTranslations("CombatantPlate");
  const def = getUnitDef(unit.unitDefId);
  const attack = attackId ? def.attacks.find((a) => a.id === attackId) : undefined;
  const maxHp = unit.maxHp ?? def.hp;
  const hpNow = Math.max(0, fx.hpOverrides.get(unit.id) ?? unit.hp);
  // 統率・時間帯・遅化の補正込みの見積り(UnitInfoPanelと同じdisplayDamage経由。
  // attack.damageを直接出すと、統率グローが光っているのに数字が+25%を反映しない
  // 食い違いが起きる。2026-07-09)
  const dmg = attack
    ? displayDamage(attack, def, timeOfDay, {
        attackerTraits: unit.traits,
        leadership,
        slowed: unit.slowed,
      })
    : 0;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "4px 10px",
        borderTop: `2px solid ${OWNER_COLORS[unit.owner] ?? "#888"}`,
        textAlign: align,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {def.name}
        <span style={{ color: "#8a94a3", fontWeight: 400, marginLeft: 4 }}>Lv{def.level}</span>
      </div>
      <div style={{ fontSize: 11, color: "#8a94a3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {attack
          ? `${role === "attacker" ? "⚔ " : ""}${attack.name} ${dmg}×${attack.count}${role === "defender" ? t("retaliationSuffix") : ""}`
          : role === "defender"
            ? t("cannotRetaliate")
            : ""}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: hpColor(hpNow / maxHp) }}>
        HP {hpNow}/{maxHp}
      </div>
    </div>
  );
}

const S = HEX_WIDTH_PX / 2;
// 表示ウィンドウ: 戦闘の2hexを中心に幅4hex分(遠隔攻撃の距離1でも両者が収まる)
const VIEW_W = HEX_WIDTH_PX * 4;
const VIEW_H = HEX_WIDTH_PX * 2.6;

export default function CutInStage({
  map,
  fx,
  current,
  myIndex = -1,
  timeOfDay,
}: {
  map: GameMap;
  fx: CombatFx;
  current: CombatPlaybackInput | null; // 再生中の戦闘(useCombatAnimationsのcurrent)。nullなら非表示
  // 閲覧者のプレイヤーindex。戦闘情報プレートの左右(自軍=左・敵軍=右)の判定に使う。
  // -1(観戦等)のときは攻撃側=左にフォールバック
  myIndex?: number;
  // 戦況要約(summarizeCombatMoments)のダメージ試算に使う。呼び出し側(useCutIn)が
  // board.turnNumber等から算出したものをそのまま渡す
  timeOfDay: TimeOfDayDef;
}) {
  // 表示スケール: ステージ(盤面px等倍)をパネル実幅に合わせる外側2D scale
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelW, setPanelW] = useState(560);
  useEffect(() => {
    const update = () => {
      if (panelRef.current) setPanelW(panelRef.current.clientWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [current !== null]);
  // 戦況要約(summarizeCombatMoments)の表示名。Web版は簡易な文字タグのみで、
  // 「強めの演出」は将来のExpo版側で作り込む想定(2026-07-09)。early returnより前で
  // フックを呼ぶ必要がある(Rules of Hooks)
  const tMoments = useTranslations("CutInMoments");

  if (!current) return null;

  const viewCenter = (c: { x: number; y: number }) => hexCenter(c);

  const a = viewCenter(current.attacker.pos);
  const d = viewCenter(current.defender.pos);
  const mid = { cx: (a.cx + d.cx) / 2, cy: (a.cy + d.cy) / 2 };
  const k = panelW / VIEW_W;

  // 平面固定(scale常に1)。パネル実幅への拡大は外側のCSS scale(k)で行う
  const proj = (p: { cx: number; cy: number }) => ({ ...p, scale: 1 });
  const unitProj = proj;

  // 舞台の地形: 攻撃側・防御側それぞれの周辺1hex(重複除去で6〜14hex)
  const seen = new Set<string>();
  const cells = [
    current.defender.pos,
    ...hexNeighbors(current.defender.pos),
    current.attacker.pos,
    ...hexNeighbors(current.attacker.pos),
  ].filter((c) => {
    const key = hexKey(c);
    if (seen.has(key) || !inBounds(map, c)) return false;
    seen.add(key);
    return true;
  });

  // ユニット: 戦闘の主役2体+舞台範囲に立つ周辺ユニット(書き割り。スナップショット由来)。
  // 表示位置はランジ(fx.positions)を優先し、重なり順は本盤面と同じ画家順
  // (投影後の画面yの昇順=奥から描く)
  const combatantIds = new Set([current.attacker.id, current.defender.id]);
  const bystanders = (current.bystanders ?? []).filter(
    (u) => !combatantIds.has(u.id) && seen.has(hexKey(u.pos)),
  );
  const displayPos = (u: UnitState) => fx.positions.get(u.id) ?? hexCenter(u.pos);
  const stageUnits = [current.attacker, current.defender, ...bystanders];

  // 統率ボーナス(2026-07-09): 提供元の周辺ユニットではなく、恩恵を受ける攻撃側/防御側
  // 本人に強めのフォーカス(後述のグロー)を出す方が分かりやすいというユーザー判断。
  // 判定にはステージ表示用に間引く前のcurrent.bystanders(全ユニットのスナップショット)を使う —
  // 隣接判定(leadershipSupportersOf)は舞台の可視範囲に関係なく成立するため
  const allUnitsForLeadershipCheck = [current.attacker, current.defender, ...(current.bystanders ?? [])];
  const attackerSupporters = leadershipSupportersOf(current.attacker, allUnitsForLeadershipCheck);
  const defenderSupporters = leadershipSupportersOf(current.defender, allUnitsForLeadershipCheck);
  const attackerLed = attackerSupporters.length > 0;
  const defenderLed = defenderSupporters.length > 0;
  // 実際にボーナスを効かせている提供元本人だけは、他の書き割りと違って減光しない
  // (統率が機能していることが分かる方が良いというユーザー判断。2026-07-09)
  const activeLeadershipSupporterIds = new Set(
    [...attackerSupporters, ...defenderSupporters].map((u) => u.id),
  );

  // 戦況要約(2026-07-09): 「今この戦闘で何が起きているか」を配列で受け取る。
  // 描画方法はここで決め切る必要はない(将来のExpo版は同じ配列を別の見せ方で使う想定)。
  // Web版は簡易表示(下のCOMBAT_MOMENT_LABELS)に留め、演出の作り込みは行わない
  const attackerDef = getUnitDef(current.attacker.unitDefId);
  const defenderDef = getUnitDef(current.defender.unitDefId);
  const attackDef = attackerDef.attacks.find((a) => a.id === current.attackerAttackId);
  const retaliationDef = defenderDef.attacks.find((a) => a.id === current.defenderAttackId);
  const moments = attackDef
    ? summarizeCombatMoments({
        attacker: current.attacker,
        attackerDef,
        defender: current.defender,
        defenderDef,
        attack: attackDef,
        retaliationAttack: retaliationDef ?? null,
        timeOfDay,
        units: allUnitsForLeadershipCheck,
        map,
      })
    : [];

  // 地形立体物(森の樹冠・山の岩塊・補給テント・旗)も本盤面と同じ部品と
  // 深度ソートで舞台に立てる(2026-07-08「カットインに地形が反映されてない」)。
  // 占有ヘックスの立体物はfadeModeに従って薄くなり、防御側が森に隠れていても読める
  const occupiedKeys = new Set(stageUnits.map((u) => hexKey(u.pos)));
  // 組み立てはHexGridと同じ共通実装(lib/board/objects.ts)。投影原点だけが違う(mid=戦闘の中点)
  const objectItems = buildTerrainObjectItems({
    map,
    cells,
    viewCenter,
    getObjects: (c, terrainId) => {
      const def = SPRITE_REGISTRY.getTerrainSprite(terrainId);
      return def ? pickTerrainObjects(def, map, c, terrainId) : undefined;
    },
  });
  const stageItems = [
    ...stageUnits.map((u) => ({ kind: "unit" as const, u, y: unitProj(displayPos(u)).cy })),
    ...objectItems,
  ].sort((a, b) => a.y - b.y);

  const viewBox = `${mid.cx - VIEW_W / 2} ${mid.cy - VIEW_H / 2} ${VIEW_W} ${VIEW_H}`;

  return (
    <div
      data-testid="cutin-stage"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(6, 8, 12, 0.55)",
        pointerEvents: "none", // 演出中も盤面操作をブロックしない(現行の非ブロック方針)
      }}
    >
      <div
        ref={panelRef}
        style={{
          width: "min(92%, 560px)",
          border: "1px solid #2a3242",
          borderRadius: 10,
          overflow: "hidden",
          // プレースホルダ背景。A-3確立後に防御側地形の一枚絵へ差し替える
          background: "linear-gradient(#1a2230, #0c0f14)",
          boxShadow: "0 8px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* 外側: 表示サイズ(高さはscale後の実寸)。内側: 盤面px等倍のステージをscale(k)で拡大 */}
        <div style={{ height: VIEW_H * k, overflow: "hidden" }}>
          <div
            style={{
              width: VIEW_W,
              height: VIEW_H,
              position: "relative",
              transform: `scale(${k})`,
              transformOrigin: "top left",
            }}
          >
            <svg viewBox={viewBox} width={VIEW_W} height={VIEW_H} style={{ display: "block" }}>
              {cells.map((c) => {
                const p = viewCenter(c);
                return (
                  <TerrainTile
                    key={hexKey(c)}
                    cx={p.cx}
                    cy={p.cy}
                    terrainId={terrainAt(map, c).id}
                    hexX={c.x}
                    hexY={c.y}
                  />
                );
              })}
            </svg>

            {/* ビルボードレイヤー: ユニット・エフェクト・数字は位置だけ投影する */}
            <svg
              viewBox={viewBox}
              width={VIEW_W}
              height={VIEW_H}
              style={{ display: "block", position: "absolute", left: 0, top: 0 }}
            >
              {stageItems.map((item) => {
                if (item.kind === "object") {
                  return (
                    <g
                      key={`obj-${item.key}`}
                      transform={`translate(${item.pp.cx} ${item.pp.cy}) scale(${item.pp.scale})`}
                      pointerEvents="none"
                    >
                      <TerrainObjectBillboard
                        obj={item.obj}
                        oi={item.oi}
                        hexX={item.c.x}
                        hexY={item.c.y}
                        hexOccupied={occupiedKeys.has(hexKey(item.c))}
                        ownerIndex={item.ownerIndex}
                      />
                    </g>
                  );
                }
                const u = item.u;
                const def = getUnitDef(u.unitDefId);
                const pp = unitProj(displayPos(u));
                const isCombatant = combatantIds.has(u.id);
                const maxHp = u.maxHp ?? def.hp;
                const ratio = (fx.hpOverrides.get(u.id) ?? u.hp) / maxHp;
                const hp = Math.max(0, Math.min(1, ratio));
                // 統率で恩恵を受けている本人かどうか(提供元の周辺ユニットではなく、
                // 攻撃側/防御側本人にグローを出す。上のattackerLed/defenderLed参照)
                const isLed =
                  (u.id === current.attacker.id && attackerLed) ||
                  (u.id === current.defender.id && defenderLed);
                return (
                  <g
                    key={u.id}
                    transform={`translate(${pp.cx} ${pp.cy}) scale(${pp.scale})`}
                    pointerEvents="none"
                    // 周辺ユニット(書き割り)は気配程度に減光し、一騎打ちの2体へ視線を集める。
                    // ただし実際に統率ボーナスを効かせている提供元本人は減光しない
                    // (機能していることが分かった方が良いというユーザー判断。2026-07-09)。
                    // 撃破された側はさらにfx.opacityOverridesでフェードアウトする(2026-07-10)
                    opacity={
                      (isCombatant || activeLeadershipSupporterIds.has(u.id) ? 1 : 0.4) *
                      (fx.opacityOverrides.get(u.id) ?? 1)
                    }
                  >
                    {/* 統率ボーナスの受益者へのフォーカス(2026-07-09)。提供元の周辺ユニットを
                        探させるより、恩恵を受ける本人を光らせた方が分かりやすいというユーザー判断。
                        スプライトの背後に置くグロー(パルスするだけの単純な円。CSSアニメで完結) */}
                    {isLed && (
                      <circle className="cutin-leadership-glow" cx={0} cy={0} r={S * 0.9} fill="#ffd75e" />
                    )}
                    <UnitBody
                      cx={0}
                      cy={0}
                      spriteKey={def.spriteKey}
                      owner={u.owner}
                      selected={false}
                      nameChar={def.name.charAt(0)}
                      override={fx.spriteOverrides.get(u.id) ?? null}
                      flipped={fx.flipOverrides.get(u.id) ?? u.owner === 1}
                    />
                    {/* HPバー(左肩縦・打撃同期)は戦闘の主役2体のみ。書き割りには出さない */}
                    {isCombatant && (
                      <>
                        <rect
                          x={-S * 0.72}
                          y={-S * 1.1}
                          width={5}
                          height={S * 1.1}
                          fill="#10141a"
                          rx={2}
                        />
                        <rect
                          x={-S * 0.72}
                          y={-S * 1.1 + S * 1.1 * (1 - hp)}
                          width={5}
                          height={S * 1.1 * hp}
                          fill={hpColor(ratio)}
                          rx={2}
                        />
                      </>
                    )}
                  </g>
                );
              })}

              {/* 飛び道具・詠唱halo等(描画順=配列順) */}
              {fx.effects.map((e) => {
                const pp = proj(e);
                const cy = pp.cy + e.dy; // 縦オフセットは投影・ビュー変換の後に適用(上は上のまま)
                const w = e.sizePx ?? imageNaturalSize(e.image)?.w ?? S * 2;
                const h = e.sizePx ?? imageNaturalSize(e.image)?.h ?? S * 2;
                return (
                  <image
                    key={e.key}
                    href={resolveAssetUrl(e.image)}
                    x={pp.cx - w / 2}
                    y={cy - h / 2}
                    width={w}
                    height={h}
                    transform={`rotate(${e.angleDeg} ${pp.cx} ${cy})`}
                    style={{ imageRendering: "pixelated" }}
                  />
                );
              })}

              {/* ダメージ数字。浮き上がり(dy)は投影・ビュー変換の後に引く=画面上で常に上方向 */}
              {fx.popups.map((p) => {
                const pp = proj(p);
                return (
                  <text
                    key={p.key}
                    x={pp.cx}
                    y={pp.cy - p.dy}
                    textAnchor="middle"
                    fontSize={16}
                    fontWeight={700}
                    fill={p.color}
                    opacity={p.alpha}
                    stroke="#10141a"
                    strokeWidth={0.6}
                  >
                    {p.text}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
        {/* 戦闘情報帯: 自軍=左・敵軍=右(攻守は⚔/(反撃)の表記で読む)。
            観戦等でどちらも自軍でない場合は攻撃側=左 */}
        {(() => {
          const roles = [
            {
              unit: current.attacker,
              attackId: current.attackerAttackId,
              role: "attacker" as const,
              leadership: attackerLed,
            },
            {
              unit: current.defender,
              attackId: current.defenderAttackId,
              role: "defender" as const,
              leadership: defenderLed,
            },
          ];
          const ordered =
            current.defender.owner === myIndex ? [roles[1], roles[0]] : roles;
          return (
            <div style={{ display: "flex", background: "rgba(10, 13, 18, 0.85)" }}>
              {ordered.map((p, i) => (
                <CombatantPlate
                  key={p.role}
                  unit={p.unit}
                  attackId={p.attackId}
                  role={p.role}
                  align={i === 0 ? "left" : "right"}
                  fx={fx}
                  leadership={p.leadership}
                  timeOfDay={timeOfDay}
                />
              ))}
            </div>
          );
        })()}
        {/* 戦況要約(2026-07-09): Web版は簡易表示のみ(小さなタグの並び)。
            演出の作り込み(強調・アニメーション等)は将来のExpo版の役割 */}
        {moments.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              padding: "4px 10px 8px",
              background: "rgba(10, 13, 18, 0.85)",
            }}
          >
            {moments.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "#1e2530",
                  border: "1px solid #313c4d",
                  color: "#e0b34f",
                }}
              >
                {tMoments(tag)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
