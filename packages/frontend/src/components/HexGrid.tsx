"use client";

// ヘックスグリッドのSVG描画(計画書3.4: 描画方式はSVG)。
// ヘックスごとに<polygon>を配置し、ハイライト等はReactの宣言的な状態管理をDOM差分に乗せる。
//
// 2026-07-08 分割リファクタ: このファイルは「盤面コンポーネント本体」のみ。
// - 幾何・配色・立体物の純関数 → lib/board/(geometry.ts / colors.ts / objects.ts)
// - 共有描画部品(UnitBody・TerrainObjectBillboard・TerrainTile) → components/board/
// CutInStage等の別レンダラーはHexGridではなく上記モジュールを直接importする
import {
  hasRemainingAction,
  hexKey,
  hexNeighbors,
  inBounds,
  maxXpFor,
  TERRAIN_BY_CHAR,
  type GameMap,
  type HexCoord,
  type UnitState,
} from "@parle-stroika/core-engine";
import {
  getUnitDef,
} from "@parle-stroika/core-engine";
import {
  imageNaturalSize,
  resolveAssetUrl,
  SPRITE_REGISTRY,
  type TerrainObjectDef,
} from "@/lib/sprites";
import type { CombatFx } from "@/hooks/useCombatAnimations";
import { S, boardPixelSize, hexCenter, hexPointsAt } from "@/lib/board/geometry";
import { OWNER_COLORS, OWNER_COLORS_LIGHT, hpColor } from "@/lib/board/colors";
import {
  buildTerrainObjectItems,
  hasActionableBehind,
  pickTerrainObjects,
} from "@/lib/board/objects";
import { MOUNTAIN_UNIT_LIFT, UnitBody } from "./board/UnitBody";
import { TerrainObjectBillboard } from "./board/TerrainObjectBillboard";
import { TerrainTile } from "./board/TerrainTile";

export interface HexGridProps {
  map: GameMap;
  units: UnitState[];
  villageOwners: Record<string, number>;
  activePlayer: number;
  hiddenUnitIds?: ReadonlySet<string>; // 相手から見えていない自軍ユニット(伏兵・潜水)
  selectedUnitId: string | null;
  moveTargets: ReadonlySet<string>;
  attackTargets: ReadonlySet<string>;
  recruitTargets: ReadonlySet<string>;
  draftTarget: HexCoord | null;
  movePath?: HexCoord[] | null; // 下書き移動の経路(始点→終点)
  visionSet?: ReadonlySet<string> | null; // 霧: 自軍の視界。null/未指定なら霧なし
  guideHexes?: ReadonlySet<string>; // チュートリアルのガイドでハイライトするヘックス
  // 移動アニメ中ユニットの表示位置(useMoveAnimations)。論理位置より優先して描画する
  animatedPositions?: ReadonlyMap<string, { cx: number; cy: number }>;
  // 戦闘演出(useCombatAnimations): フレーム上書き・HP表示の同期・ゴースト・ダメージ数字
  combatFx?: CombatFx;
  // 地形立体物の上書き(/dev/terrain の検収プレビュー専用)。terrainId→オブジェクト定義。
  // 指定された地形はコンテンツパック(TERRAIN_SPRITES)の定義より優先される
  devTerrainObjects?: Record<string, readonly TerrainObjectDef[]>;
  // ヘックス単位の上書き(同上)。undefinedを返したヘックスはdevTerrainObjects→
  // コンテンツパックの順にフォールバック。森の内側/端の比較などに使う
  devTerrainObjectsByHex?: (
    c: HexCoord,
    terrainId: string,
  ) => readonly TerrainObjectDef[] | undefined;
  // 地面レイヤーの上書き(同上)。terrainId→レイヤー列(本番と同じく
  // 各レイヤーは単一URLまたはバリアントURL配列)
  devTerrainGround?: Record<string, readonly (string | readonly string[])[]>;
  // screenPos: タップ時の画面座標(clientX/Y)。縦列の重なりで奥のユニットが選びにくい問題の
  // 救済(同一位置への連続タップで奥へフォーカスを移す)のためBoardScreen側で使う
  onHexClick: (coord: HexCoord, screenPos: { x: number; y: number }) => void;
}

// ユニットの足元影(ジオラマPhase A)。濃淡2枚の楕円で疑似的な柔らかい縁を作る
// (SVG filterのぼかしはid管理とレンダラー間の可搬性が面倒なため使わない)。
// チームカラー楕円・フォールバック円の下に敷き、接地感を出す
export default function HexGrid({
  map,
  units,
  villageOwners,
  activePlayer,
  hiddenUnitIds,
  selectedUnitId,
  moveTargets,
  attackTargets,
  recruitTargets,
  draftTarget,
  movePath,
  visionSet,
  guideHexes,
  animatedPositions,
  combatFx,
  devTerrainObjects,
  devTerrainObjectsByHex,
  devTerrainGround,
  onHexClick,
}: HexGridProps) {
  const { width, height } = boardPixelSize(map);

  // 戦闘で死亡したユニットは、演出が終わるまでゴーストとして描画を続ける
  const renderUnits = combatFx?.ghosts.length
    ? [...units, ...combatFx.ghosts.filter((g) => !units.some((u) => u.id === g.id))]
    : units;

  const cells: HexCoord[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      cells.push({ x, y });
    }
  }

  const viewCenter = (c: HexCoord) => hexCenter(c);
  // 平面固定(scale常に1)。billboardItems・戦闘演出のcx/cy/scale参照はそのまま
  const proj = (p: { cx: number; cy: number }) => ({ ...p, scale: 1 });
  const unitProj = proj;
  const displayPos = (u: UnitState) => animatedPositions?.get(u.id) ?? hexCenter(u.pos);
  // 手前のユニットが上に重なるよう、描画位置(画面y)の昇順=奥から描く。
  // スプライト(72px)は行間(√3S≈62px)より背が高く、上下の隣接で重なるため
  const spriteY = (u: UnitState) => unitProj(displayPos(u)).cy;

  // ビルボードの深度ソート(ジオラマPhase B): ユニットと地形立体物(森の木々等)を
  // 同じ列に混ぜて投影後yの昇順で描く。立体物はユニットよりわずかに手前に接地する
  // (OBJECT_FOOT_BIAS_RATIO)ため、同一ヘックスでは立体物が後=手前に描かれ、
  // ユニットの足元・下半身を隠す=本物の遮蔽になる(design_diorama.md「森の中」の解)
  const occupiedKeys = new Set(renderUnits.map((u) => hexKey(u.pos)));
  // 立体物はエントリ単位で深度ソートに参加する(1ヘックスに複数体置けるように。
  // それぞれがoffset+jitterで別の足元位置を持ち、独立に前後関係を持つ)
  // 操作性の救済(2026-07-08): 立体物(岩・木)は画面奥のヘックスの見える面積を
  // 細い帯まで削るため、「入口の一個後ろ」を押そうとすると狙い所が小さすぎる。
  // タップ判定自体は立体物の絵の下でも生きている(絵はpointerEvents無効)が、
  // ユーザーは見えている地面を狙うので、目標選択中はハイライトが見えることが操作性そのもの。
  // → 自分の真後ろ(画面上方向)の隣接ヘックスが行動対象(移動先・攻撃対象・雇用先)の間だけ、
  //   その立体物を薄くして奥のハイライトと地面を見せる。選択解除で即座に戻る
  const actionable = (k: string) =>
    moveTargets.has(k) || attackTargets.has(k) || recruitTargets.has(k);
  const objectItems = buildTerrainObjectItems({
    map,
    cells,
    viewCenter,
    // devプレビューの上書き(ヘックス単位→地形単位)→ コンテンツパック
    // (縁ロジック: 境界/内側・孤立でセットを選ぶ)の順に解決
    getObjects: (c, terrainId) => {
      const dev = devTerrainObjectsByHex?.(c, terrainId) ?? devTerrainObjects?.[terrainId];
      if (dev) return dev;
      const def = SPRITE_REGISTRY.getTerrainSprite(terrainId);
      return def ? pickTerrainObjects(def, map, c, terrainId) : undefined;
    },
    // 操作性の救済(2026-07-08): 真後ろのヘックスが行動対象の間だけ立体物を薄くし、
    // 奥のハイライトと地面を見せる(詳細は lib/board/objects.ts と skill: board-rendering)
    revealBehind: (c) => hasActionableBehind(map, c, viewCenter, actionable),
  });

  const billboardItems = [
    ...renderUnits.map((u) => ({ kind: "unit" as const, u, y: spriteY(u) })),
    ...objectItems,
  ].sort((a, b) => a.y - b.y);

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      {/* 地形レイヤー(クリック判定担当) */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ display: "block" }}
      >
      {cells.map((c) => {
        const key = hexKey(c);
        const terrainId = TERRAIN_BY_CHAR[map.tiles[c.y][c.x]];
        const { cx, cy } = viewCenter(c);
        const isDraft = draftTarget && hexKey(draftTarget) === key;
        const villageOwner =
          terrainId === "village" ? villageOwners[key] : undefined;
        // 地形遷移くさび: 隣が異地形(または盤外)の辺の方向(view空間の角度)。
        // くさび素材の正準は「上辺向き」なので、外向き法線の角度+90度がrotate値
        const edgeTransition = SPRITE_REGISTRY.getTerrainSprite(terrainId)?.edgeTransition;
        const transitions = edgeTransition
          ? hexNeighbors(c).flatMap((n) => {
              const nid = inBounds(map, n) ? TERRAIN_BY_CHAR[map.tiles[n.y][n.x]] : undefined;
              if (nid === terrainId) return [];
              // 除外指定の隣接(浅瀬→深水等)にはくさびを塗らない
              if (nid && edgeTransition.excludeNeighbors?.includes(nid)) return [];
              const q = viewCenter(n);
              const angle = (Math.atan2(q.cy - cy, q.cx - cx) * 180) / Math.PI + 90;
              // 隣接地形ごとの素材上書き(砂丘→浅瀬=浅瀬色くさび等)
              const src = (nid && edgeTransition.byNeighbor?.[nid]) ?? edgeTransition.src;
              return [{ angle, src }];
            })
          : undefined;
        return (
          <g
            key={key}
            data-hex-x={c.x}
            data-hex-y={c.y}
            onClick={(e) => onHexClick(c, { x: e.clientX, y: e.clientY })}
            style={{ cursor: "pointer" }}
          >
            <TerrainTile
              cx={cx}
              cy={cy}
              terrainId={terrainId}
              hexX={c.x}
              hexY={c.y}
              transitions={transitions}
              groundOverride={devTerrainGround?.[terrainId]}
            />
            {/* ヘックスのグリッド線(本家Wesnoth準拠: 対戦画面でも常時薄く表示)。
                地形画像レイヤーの上・ユニット/ハイライトの下に重ねる */}
            <polygon
              points={hexPointsAt({ cx, cy })}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              pointerEvents="none"
            />
            {/* 補給拠点の領有: 所有者の色で縁取り(平面=作戦図モードの補助。
                主表示は陣営色の小旗ビルボード)。地形の記号マーク(♣⌂▲🚩)は
                2026-07-08 廃止 — 樹冠・テント・岩塊・旗の実体が立った時点で二重表示 */}
            {villageOwner !== undefined && (
              <>
                <polygon
                  points={hexPointsAt({ cx, cy })}
                  fill="none"
                  stroke={OWNER_COLORS_LIGHT[villageOwner]}
                  strokeWidth={3}
                  pointerEvents="none"
                />
                {/* mini-wesgame: 占領旗アセットが無いため⌂マークで領有を示す */}
                <text
                  x={cx}
                  y={cy + 6}
                  textAnchor="middle"
                  fontSize={16}
                  fill={OWNER_COLORS_LIGHT[villageOwner]}
                  pointerEvents="none"
                >
                  ⌂
                </text>
              </>
            )}
            {moveTargets.has(key) && (
              <polygon
                points={hexPointsAt({ cx, cy })}
                fill="rgba(79,140,255,0.35)"
                stroke="rgba(79,140,255,0.8)"
                strokeWidth={1.5}
                pointerEvents="none"
              />
            )}
            {recruitTargets.has(key) && (
              <polygon
                points={hexPointsAt({ cx, cy })}
                fill="rgba(224,179,79,0.4)"
                stroke="rgba(224,179,79,0.9)"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}
            {attackTargets.has(key) && (
              <polygon
                points={hexPointsAt({ cx, cy })}
                fill="rgba(224,82,82,0.25)"
                stroke="#e05252"
                strokeWidth={3}
                pointerEvents="none"
              />
            )}
            {isDraft && (
              <polygon
                points={hexPointsAt({ cx, cy })}
                fill="rgba(79,140,255,0.65)"
                stroke="#fff"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}
            {/* チュートリアルのガイド: 注目してほしいヘックスを金色の破線で示す */}
            {guideHexes?.has(key) && (
              <polygon
                points={hexPointsAt({ cx, cy })}
                fill="rgba(255,215,94,0.18)"
                stroke="#ffd75e"
                strokeWidth={3}
                strokeDasharray="7 5"
                pointerEvents="none"
              />
            )}
            {/* 霧: 視界外のヘックスを暗くする(移動先として選ぶことは可能) */}
            {visionSet && !visionSet.has(key) && (
              <polygon
                points={hexPointsAt({ cx, cy })}
                fill="rgba(8,10,16,0.55)"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {/* 下書き移動の経路表示: どのヘックスを通って進むかを破線で示す */}
      {movePath &&
        movePath.length > 1 &&
        (() => {
          const pts = movePath.map((c) => viewCenter(c));
          const last = pts[pts.length - 1];
          const prev = pts[pts.length - 2];
          const angle = Math.atan2(last.cy - prev.cy, last.cx - prev.cx);
          const arrow = (a: number, r: number) =>
            `${last.cx + Math.cos(a) * r},${last.cy + Math.sin(a) * r}`;
          return (
            <g pointerEvents="none">
              <polyline
                points={pts.map((p) => `${p.cx},${p.cy}`).join(" ")}
                fill="none"
                stroke="#10141a"
                strokeWidth={6}
                opacity={0.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={pts.map((p) => `${p.cx},${p.cy}`).join(" ")}
                fill="none"
                stroke="#ffffff"
                strokeWidth={3}
                strokeDasharray="7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pts.slice(1, -1).map((p, i) => (
                <circle key={i} cx={p.cx} cy={p.cy} r={4} fill="#ffffff" stroke="#10141a" />
              ))}
              <polygon
                points={`${arrow(angle, 12)} ${arrow(angle + Math.PI * 0.78, 11)} ${arrow(angle - Math.PI * 0.78, 11)}`}
                fill="#ffffff"
                stroke="#10141a"
                strokeWidth={1.5}
              />
            </g>
          );
        })()}

      </svg>

      {/* ビルボードレイヤー: ユニット・ダメージ数字・エフェクトは位置だけ投影する。
          svg全体はクリック素通し、ユニットの<g>だけ判定を復活させる(unit head部をタップ
          しても論理ヘックスが選択される) */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ display: "block", position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      >
        {billboardItems.map((item) => {
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
                  hexOccupied={occupiedKeys.has(item.hexKey)}
                  revealBehind={item.revealBehind}
                  ownerIndex={item.ownerIndex}
                />
              </g>
            );
          }
          const u = item.u;
          const def = getUnitDef(u.unitDefId);
          // 移動アニメ中は補間された表示位置を使う(クリック判定は論理位置のまま)
          const pp = unitProj(displayPos(u));
          const acted = u.owner === activePlayer && !hasRemainingAction(u, units);
          const maxHp = u.maxHp ?? def.hp;
          // 戦闘演出中は打撃の進行に同期したHPを表示する(確定値は盤面stateに反映済み)
          const hpShown = combatFx?.hpOverrides.get(u.id) ?? u.hp;
          const ratio = hpShown / maxHp;
          const maxXp = maxXpFor(def, u.traits ?? []);
          const xpRatio = Math.min(1, (u.xp ?? 0) / maxXp);
          // バーの表示ポリシー(2026-07-06決定): 情報があるときだけ出す。
          // - HP: 満タンなら消す(「バーが見える=手負いがいる」を盤面の信号にする)。
          //   選択中・戦闘演出中(打撃同期でHPが動く間)は満タンでも表示
          // - XP: レベルアップ目前(残り9以下)のみ。9 = 生存(相手Lv1)+撃破(8×Lv1)で
          //   「次の1戦で昇級し得る」圏内。それ以外のXPはユニットパネルで確認する
          const inCombatAnim = !!combatFx?.hpOverrides.has(u.id);
          const showHpBar = ratio < 1 || u.id === selectedUnitId || inCombatAnim;
          const showXpBar = (u.xp ?? 0) >= maxXp - 9;
          // 山の上のユニット(飛行のみ)は本体を浮かせる。バー・選択リングごと持ち上げ、
          // 足元影(UnitBody内)だけliftで地面に戻す。深度ソートは地上のcyのまま
          const lift =
            TERRAIN_BY_CHAR[map.tiles[u.pos.y]?.[u.pos.x]] === "mountains"
              ? MOUNTAIN_UNIT_LIFT
              : 0;
          return (
            <g
              key={u.id}
              data-unit-id={u.id}
              data-unit-owner={u.owner}
              data-hex-x={u.pos.x}
              data-hex-y={u.pos.y}
              transform={`translate(${pp.cx} ${pp.cy - lift * pp.scale}) scale(${pp.scale})`}
              onClick={(e) => onHexClick(u.pos, { x: e.clientX, y: e.clientY })}
              style={{ cursor: "pointer" }}
              pointerEvents="visiblePainted"
              opacity={acted ? 0.55 : 1}
            >
              <UnitBody
                cx={0}
                cy={0}
                spriteKey={def.spriteKey}
                owner={u.owner}
                selected={u.id === selectedUnitId}
                nameChar={def.name.charAt(0)}
                override={combatFx?.spriteOverrides.get(u.id) ?? null}
                flipped={combatFx?.flipOverrides.get(u.id) ?? u.owner === 1}
                lift={lift}
                acted={u.owner === activePlayer ? acted : undefined}
                poisoned={u.poisoned}
                slowed={u.slowed}
              />
              {u.isLeader && (
                <text
                  x={0}
                  y={-S * 0.58}
                  textAnchor="middle"
                  fontSize={14}
                  fill="#e0b34f"
                  pointerEvents="none"
                >
                  ★
                </text>
              )}
              {/* ☠は右側(左肩はHP/XP縦バーの場所)。🌿(-0.35S)と縦に並ぶ */}
              {u.poisoned && (
                <text
                  x={S * 0.55}
                  y={S * 0.15}
                  textAnchor="middle"
                  fontSize={13}
                  fill="#8ee08e"
                  pointerEvents="none"
                >
                  ☠
                </text>
              )}
              {hiddenUnitIds?.has(u.id) && (
                <text
                  x={S * 0.55}
                  y={-S * 0.35}
                  textAnchor="middle"
                  fontSize={13}
                  pointerEvents="none"
                >
                  🌿
                </text>
              )}
              {/* HP/XPバー: 本家Wesnoth式の左肩の縦バー(下から満ちる)。
                  足元の横バーだと画家順で手前のユニットの絵に覆われて読めなくなるが、
                  左肩の縦の余白は縦隣接の重なりの影響を受けない(/dev/spritesで検証済み。2026-07-06)。
                  長さは乱戦(横・斜め隣接が密集する場面)での視認性のため短めにしてある(2026-07-09)。
                  元は頭上まで伸びていて、隣接ユニットのスプライトや自分のバーと重なりやすかった */}
              {(showHpBar || showXpBar) &&
                (() => {
                  const hp = Math.max(0, Math.min(1, ratio));
                  const barH = S * 0.7;
                  const barTop = -barH;
                  const hpX = -S * 0.72;
                  const xpX = hpX + 6.5;
                  return (
                    <g pointerEvents="none">
                      {showHpBar && (
                        <>
                          <rect x={hpX} y={barTop} width={5} height={barH} fill="#10141a" rx={2} />
                          <rect
                            x={hpX}
                            y={barTop + barH * (1 - hp)}
                            width={5}
                            height={barH * hp}
                            fill={hpColor(ratio)}
                            rx={2}
                          />
                        </>
                      )}
                      {/* XPバー(紫)。位置はHPバー表示の有無に関わらず固定(出る場所が一定=見分けやすい) */}
                      {showXpBar && (
                        <>
                          <rect x={xpX} y={barTop} width={3} height={barH} fill="#10141a" rx={1.5} />
                          <rect
                            x={xpX}
                            y={barTop + barH * (1 - xpRatio)}
                            width={3}
                            height={barH * xpRatio}
                            fill="#b07fe0"
                            rx={1.5}
                          />
                        </>
                      )}
                    </g>
                  );
                })()}
            </g>
          );
        })}

        {/* 戦闘のダメージ数字(打撃の瞬間に湧いて浮き上がりながら消える)。
            浮き上がり(dy)は投影・ビュー変換の後に引く=画面上で常に上方向 */}
        {combatFx?.popups.map((p) => {
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
              pointerEvents="none"
            >
              {p.text}
            </text>
          );
        })}

        {/* 戦闘エフェクト(飛び道具・詠唱halo等の追加レイヤー。描画順=配列順)。
            sizePx未指定は原寸(imageNaturalSize)で描く */}
        {combatFx?.effects.map((e) => {
          const pp = proj(e);
          const cy = pp.cy + e.dy; // 縦オフセットは投影・ビュー変換の後に適用(上は上のまま)
          const size = e.sizePx ?? imageNaturalSize(e.image)?.w ?? S * 2;
          const sizeH = e.sizePx ?? imageNaturalSize(e.image)?.h ?? S * 2;
          return (
            <image
              key={e.key}
              href={resolveAssetUrl(e.image)}
              x={pp.cx - size / 2}
              y={cy - sizeH / 2}
              width={size}
              height={sizeH}
              transform={`rotate(${e.angleDeg} ${pp.cx} ${cy})`}
              style={{ imageRendering: "pixelated" }}
              pointerEvents="none"
            />
          );
        })}
      </svg>
    </div>
  );
}
