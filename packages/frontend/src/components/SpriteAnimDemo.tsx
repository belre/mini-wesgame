"use client";

// スプライトアニメーションの検証ページ(/dev/sprites)。
// Wesnoth AnimationWML(https://wiki.wesnoth.org/AnimationWML)のフレーム定義を
// 現行のSVG描画方式(HexGridと同じ座標系・重ね順)でそのまま再生できるかを実証する。
// データは lib/sprites.ts の UNIT_SPRITES(本番の盤面が使うのと同じ定義)を直接使う
// (このデモ専用のハードコードは持たない。本番データが変われば検証内容も自動で追従する)。
//
// 検証対象(Loyalist_Spearman.cfg の実データ):
// - standing_anim: stand-s-[1~7,6,7~2].png 各200ms のループ
// - idle_anim:     idle[1~4,3,2].png [100,100,100,400,100,100]ms を
//                  ランダム間隔で1回再生してstandingに戻る(Wesnothと同じ挙動)
// - 移動:          Wesnothエンジン既定の「1ヘックス200msスライド」。移動中もアニメ継続
// - 合成:          選択リング・HPバー・★・行動済み減光が画像の上に重なることを確認
// - 戦闘:          近接(spear・踏み込みあり)と遠隔(javelin・据え置き+飛び道具)の
//                  両方を切り替えて再生できる
//
// フレームPNGは packages/frontend/scripts/fetch-demo-sprites.mjs でWesnoth本家から取得する
// (GPLアセットのためリポジトリにはコミットしない)。
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { FACTIONS } from "@parle-stroika/core-engine";
import { UNIT_SPRITES } from "@/lib/sprites";
import {
  type AttackAnimDef,
  type UnitSpriteDef,
} from "@/lib/anim/model";
import {
  attackFrameAt,
  attackLungeAt,
  attackTrackStatesAt,
  missileStateAt,
} from "@/lib/anim/resolve";
import { TurnRing } from "./board/UnitBody";
import {
  allSpriteImages,
  imageNaturalSize,
  loadImage,
} from "@/lib/anim/assets";
import { recolorImage, teamColoredSrc } from "@/lib/anim/teamColor";
import { BOARD_DIAGONAL_DEG, TILT_RAD, projectTilt, withFootOffset } from "@/lib/tilt";
import TiltStage from "./TiltStage";

const S = 36; // ヘックス外接円半径(HexGrid.tsxと同じ)
const SQRT3 = Math.sqrt(3);

function hexCenter(x: number, y: number): { cx: number; cy: number } {
  return {
    cx: S + 1.5 * S * x,
    cy: SQRT3 * S * (y + 0.5 * (x & 1)) + (SQRT3 / 2) * S,
  };
}

// ヘックス頂点は cos/sin を使わず正確な定数で求める。
// Math.cos/sin は正確な丸めが仕様で要求されず、SSR(Node)とブラウザで最終桁が
// ズレて座標文字列が一致せずhydrationエラーになる(Math.sqrtは正確な丸めが保証される)。
// さらに小数2桁に丸めて文字列を安定・短縮する
const HEX_CORNERS: [number, number][] = [
  [1, 0],
  [0.5, SQRT3 / 2],
  [-0.5, SQRT3 / 2],
  [-1, 0],
  [-0.5, -SQRT3 / 2],
  [0.5, -SQRT3 / 2],
];
const round2 = (v: number) => Math.round(v * 100) / 100;

function hexPoints(x: number, y: number): string {
  const { cx, cy } = hexCenter(x, y);
  return HEX_CORNERS.map(
    ([dx, dy]) => `${round2(cx + S * dx)},${round2(cy + S * dy)}`,
  ).join(" ");
}

// ---- 本番データ(lib/sprites.ts)からの参照。デモ専用のハードコードは持たない ----

const DEFAULT_SPRITE_KEY = "units/loyalists/spearman";

// ---- 戦闘アニメーション([attack_anim]サブセット)の再生ロジック ----
// AnimationWMLの戦闘モデル: 時刻0 = 打撃の瞬間(impact)。start_timeは負値で
// 「打撃の何ms前から再生を始めるか」。offsetは進行方向への踏み込み量
// (0=自ヘックス中心、1=相手ヘックス中心。省略時は踏み込まない=遠隔攻撃)を
// 時間区間ごとに補間する。防御側はDEFENSE_ANIMマクロ相当の近似:
// 構え→被弾の瞬間だけリアクション(defend-2)。ダメージ数字の浮き上がりと
// HPバー減少は本ゲーム側のUI演出(Wesnothにもある)
const IMPACT_REACTION_MS = 180; // 被弾リアクションの表示時間(DEFENSE_ANIM近似)
const TIMELINE_END = 800; // 打撃後、ダメージ数字が消えるまでの余韻

// 攻撃アニメが未定義のユニット向け汎用近接: 立ちアニメのまま踏み込み→引きを行う
// (踏み込みカーブ自体はlib/anim/resolveのattackLungeAtが解決する)
// frames: [] = フレーム指定なし → 常に立ちアニメが表示される
const GENERIC_MELEE_ID = "__generic_melee__";
const GENERIC_MELEE: AttackAnimDef = {
  startTime: -300,
  frames: [],
};

// spriteKeyを陣営ごとにグループ化(UIのoptgroup用)
const SPRITE_KEYS_BY_FACTION: Record<string, string[]> = {};
for (const key of Object.keys(UNIT_SPRITES)) {
  const faction = key.split("/")[1] ?? "other";
  (SPRITE_KEYS_BY_FACTION[faction] ??= []).push(key);
}

// WMLのdurationどおりにフレームを送るアニメーションフック。
// standingをループしつつ、3〜8秒のランダム間隔でidleを1回挟む(Wesnothのidle_anim挙動)。
// 再帰setTimeout方式: フレームごとに1回のstate更新(この盤面規模なら十分軽い)
function useWmlAnimation(enabled: boolean, def: UnitSpriteDef): { src: string; mode: string } {
  const [frame, setFrame] = useState({ src: def.base, mode: "standing" });
  useEffect(() => {
    if (!enabled) {
      setFrame({ src: def.base, mode: "base" });
      return;
    }
    let cancelled = false;
    let timer: number;
    let mode: "standing" | "idle" = "standing";
    const standing = def.standing;
    const idle = def.idle ?? [];
    let index = Math.floor(Math.random() * standing.length); // 複数ユニットの同期を崩す
    let nextIdleAt = performance.now() + 3000 + Math.random() * 5000;
    const tick = () => {
      if (cancelled) return;
      const seq = mode === "standing" ? standing : idle;
      const f = seq[index];
      setFrame({ src: f.image, mode });
      index += 1;
      if (index >= seq.length) {
        index = 0;
        if (mode === "idle") {
          mode = "standing";
        } else if (idle.length > 0 && performance.now() > nextIdleAt) {
          mode = "idle";
          nextIdleAt = performance.now() + 3000 + Math.random() * 5000;
        }
      }
      timer = window.setTimeout(tick, f.duration);
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  // def.baseをキーとして使うことでユニット切り替え時にアニメをリセットする
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, def.base]);
  return frame;
}

// 1ヘックス200msでpath(ヘックス列)に沿ってスライドさせる移動フック(rAF補間)
const MOVE_MS_PER_HEX = 200; // Wesnothエンジンの既定値
function useHexSlide(initial: { x: number; y: number }) {
  const [px, setPx] = useState(() => hexCenter(initial.x, initial.y));
  const [moving, setMoving] = useState(false);
  const rafRef = useRef(0);

  const slideAlong = (path: { x: number; y: number }[]) => {
    if (path.length < 2) return;
    const pts = path.map((h) => hexCenter(h.x, h.y));
    const total = (pts.length - 1) * MOVE_MS_PER_HEX;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    setMoving(true);
    const step = (now: number) => {
      // rAFのタイムスタンプはvsync時刻のため、直前に取ったperformance.now()より
      // 過去のことがある(負のtでpts[-1]参照になる)。0〜totalにクランプする
      const t = Math.max(0, Math.min(total, now - start));
      const seg = Math.max(0, Math.min(pts.length - 2, Math.floor(t / MOVE_MS_PER_HEX)));
      const f = t / MOVE_MS_PER_HEX - seg;
      const a = pts[seg];
      const b = pts[seg + 1];
      setPx({ cx: a.cx + (b.cx - a.cx) * f, cy: a.cy + (b.cy - a.cy) * f });
      if (t < total) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setMoving(false);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  return { px, moving, slideAlong };
}

// スプライト+ゲームUIオーバーレイ(選択リング・HPバー・★)の合成ユニット
function SpriteUnit({
  cx,
  cy,
  src,
  selected,
  acted,
  poisoned,
  slowed,
  leader,
  hpRatio,
  xpRatio,
  scale = 1,
  flip,
  owner = 0,
  hideBar,
  barPos,
}: {
  cx: number;
  cy: number;
  src: string;
  selected?: boolean;
  acted?: boolean;
  poisoned?: boolean;
  slowed?: boolean;
  leader?: boolean;
  hpRatio: number;
  xpRatio?: number;
  scale?: number; // 傾け時、奥のユニットほど小さく描くための倍率(密度圧縮の検証用)
  flip?: boolean; // 左右反転(スプライトは南東向きで描かれているため、左向き=攻撃側と向き合うのに使う)
  owner?: number; // チームカラー(0=青/1=赤)。プリロード時にrecolorImage済みであること
  hideBar?: boolean; // HPバーを情報レイヤー(UnitBar)側で描く場合にtrue
  barPos?: BarPos; // 内蔵バーの位置(hideBar=falseのとき有効)
}) {
  const s = S * scale;
  return (
    <g opacity={acted ? 0.55 : 1}>
      {acted !== undefined && (
        <TurnRing cx={cx} cy={cy + S * 0.42} acted={acted} slowed={slowed} />
      )}
      {selected && (
        <circle cx={cx} cy={cy} r={s * 0.58} fill="none" stroke="#fff" strokeWidth={3} />
      )}
      {/* Wesnothのユニット画像は基本72×72 = ヘックス幅(2S)。攻撃ではみ出す絵は
          キャンバスが大きいため原寸(スケール倍)で中心描画する(72固定だと縮んで見える) */}
      {(() => {
        const displaySrc = teamColoredSrc(src, owner) ?? src;
        const sz = imageNaturalSize(displaySrc);
        const bw = (sz?.w ?? S * 2) * scale;
        const bh = (sz?.h ?? S * 2) * scale;
        return (
          <image
            className={poisoned ? "status-poison-tint" : undefined}
            href={displaySrc}
            x={cx - bw / 2}
            y={cy - bh / 2}
            width={bw}
            height={bh}
            transform={flip ? `translate(${2 * cx},0) scale(-1,1)` : undefined}
            style={{ imageRendering: "pixelated" }}
            pointerEvents="none"
          />
        );
      })()}
      {leader && (
        <text x={cx} y={cy - s * 0.75} textAnchor="middle" fontSize={14 * scale} fill="#e0b34f">
          ★
        </text>
      )}
      {!hideBar && (
        <UnitBar cx={cx} cy={cy} hpRatio={hpRatio} xpRatio={xpRatio} scale={scale} pos={barPos} />
      )}
    </g>
  );
}

// HPバーの位置の検証パターン
type BarPos = "feet" | "head" | "side";
const BAR_POS_LABEL: Record<BarPos, string> = {
  feet: "足元",
  head: "頭上",
  side: "左上縦(本家風)",
};
const NEXT_BAR_POS: Record<BarPos, BarPos> = { feet: "head", head: "side", side: "feet" };

// HP/XPバー。重なり時の可読性の検証用に2軸で切り替えられる:
// - レイヤー(呼び出し側): 案1=全スプライトより上の情報レイヤー / 奥行きに従う(スプライト内)
// - 位置(pos): 足元(従来) / 案2=頭上(★より上の-1.25S) /
//   左上縦=本家Wesnoth式(ユニット左肩の縦バー。下から満ちる。XPは右隣の細い縦バー)
// XPバーの色・太さ(紫#b07fe0/3px)は本番HexGridと同じ
function UnitBar({
  cx,
  cy,
  hpRatio,
  xpRatio = 0,
  scale = 1,
  pos = "feet",
}: {
  cx: number;
  cy: number;
  hpRatio: number;
  xpRatio?: number;
  scale?: number;
  pos?: BarPos;
}) {
  const s = S * scale;
  if (pos === "side") {
    // 長め(1.1S)+ユニット寄り(-0.72S)。XPはHPのすぐ右(ユニット側)に細く並べる
    const w = 5 * scale;
    const h = s * 1.1;
    const x = cx - s * 0.72;
    const top = cy - s * 1.1;
    const xpX = x + w + 1.5 * scale;
    return (
      <g pointerEvents="none">
        <rect x={x} y={top} width={w} height={h} fill="#10141a" rx={2} />
        {/* 下から満ちる(本家と同じ)。上端の残量がひと目で分かる */}
        <rect x={x} y={top + h * (1 - hpRatio)} width={w} height={h * hpRatio} fill="#63c463" rx={2} />
        <rect x={xpX} y={top} width={3 * scale} height={h} fill="#10141a" rx={1.5} />
        <rect x={xpX} y={top + h * (1 - xpRatio)} width={3 * scale} height={h * xpRatio} fill="#b07fe0" rx={1.5} />
      </g>
    );
  }
  const y = pos === "head" ? cy - s * 1.25 : cy + s * 0.62;
  return (
    <g pointerEvents="none">
      <rect x={cx - s * 0.5} y={y} width={s} height={5 * scale} fill="#10141a" rx={2} />
      <rect x={cx - s * 0.5} y={y} width={s * hpRatio} height={5 * scale} fill="#63c463" rx={2} />
      <rect x={cx - s * 0.5} y={y + 6 * scale} width={s} height={3 * scale} fill="#10141a" rx={1.5} />
      <rect x={cx - s * 0.5} y={y + 6 * scale} width={s * xpRatio} height={3 * scale} fill="#b07fe0" rx={1.5} />
    </g>
  );
}

// 戦闘アニメーションの検証セクション。攻撃種を切り替えて再生できる。
// 近接(offset定義あり): 攻撃側が踏み込んで攻撃
// 遠隔(missile定義あり): 攻撃側は据え置きのまま飛び道具を飛ばす
// どちらも打撃の瞬間(t=0)に防御側のリアクション・HPバー減少・ダメージ数字を同期させる
const DEFAULT_DEFENDER_KEY = "units/northerners/orcish_grunt";

// 敵は3x3グリッドの中央(1,1)に固定し、自軍は周囲6ヘックスの任意位置に置ける
// (odd-qオフセット。x=1は奇数列=下にずれる)。右側からの攻撃の見え方も確認できる
const ENEMY_HEX = { x: 1, y: 1 };
const ALLY_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  nw: { x: 0, y: 1, label: "左上" },
  n:  { x: 1, y: 0, label: "上" },
  ne: { x: 2, y: 1, label: "右上" },
  se: { x: 2, y: 2, label: "右下" },
  s:  { x: 1, y: 2, label: "下" },
  sw: { x: 0, y: 2, label: "左下" },
};

function CombatDemo({
  loaded,
  tilted,
  yOffset,
  footOffsetRatio,
  diagonalDeg,
  depthScale,
  barPos,
  barTopLayer,
  atkDef,
}: {
  loaded: boolean;
  tilted: boolean;
  yOffset: number;
  footOffsetRatio: number;
  diagonalDeg: number;
  depthScale: boolean;
  barPos: BarPos;
  barTopLayer: boolean;
  atkDef: UnitSpriteDef;
}) {
  // 相手ユニット(独立して選択)。本番と同じく敵(owner=1)は常に左向き(反転)で描く
  const [defKey, setDefKey] = useState(DEFAULT_DEFENDER_KEY);
  const defDef = UNIT_SPRITES[defKey] ?? UNIT_SPRITES[DEFAULT_DEFENDER_KEY]!;
  // 自軍の配置(敵の周囲6ヘックス)と、攻守の入れ替え(敵側が攻撃する)
  const [allyDir, setAllyDir] = useState("nw");
  const [enemyActs, setEnemyActs] = useState(false);
  const actorDef = enemyActs ? defDef : atkDef; // 攻撃する側の定義
  const targetDef = enemyActs ? atkDef : defDef; // 受ける側の定義

  const attackIds = useMemo(() => Object.keys(actorDef.attacks ?? {}), [actorDef]);
  const [kind, setKind] = useState<string>(GENERIC_MELEE_ID);
  // 攻撃側が変わったとき(ユニット切り替え・入れ替え)は固有攻撃の先頭にリセット
  useEffect(() => {
    const ids = Object.keys(actorDef.attacks ?? {});
    setKind(ids[0] ?? GENERIC_MELEE_ID);
  }, [actorDef]);
  const [defLoaded, setDefLoaded] = useState(false);
  useEffect(() => {
    setDefLoaded(false);
    let alive = true;
    void Promise.all(
      allSpriteImages(defDef).map((u) =>
        loadImage(u).then((ok) => (ok ? recolorImage(u, 1) : undefined)),
      ),
    ).then(() => {
      if (alive) setDefLoaded(true);
    });
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defDef.base]);
  const ready = loaded && defLoaded;

  const [clock, setClock] = useState<number | null>(null);
  const [isHit, setIsHit] = useState(true);
  const [targetHp, setTargetHp] = useState(36);
  const rafRef = useRef(0);
  const standAlly = useWmlAnimation(true, atkDef);
  const standEnemy = useWmlAnimation(true, defDef);

  const animDef = useMemo(() => {
    if (kind === GENERIC_MELEE_ID) {
      // 汎用近接: ユニット固有の近接フレーム(あれば)+ attackLungeAtの汎用ランジ
      const firstMelee = Object.values(actorDef.attacks ?? {}).find((a) => !a.missile);
      return { ...GENERIC_MELEE, frames: firstMelee?.frames ?? [] };
    }
    return kind ? (actorDef.attacks?.[kind] ?? null) : null;
  }, [kind, actorDef]);
  const damage = 7; // デモ固定値(実際のダメージはエンジン側)
  // 被弾リアクションは攻撃を受ける側のもの
  const defendReaction = targetDef.defend?.reaction ?? null;

  const play = (hit: boolean) => {
    if (clock !== null || !ready || !animDef) return;
    setIsHit(hit);
    setTargetHp(36);
    const begin = performance.now();
    let applied = false;
    const step = (now: number) => {
      const t = Math.max(animDef.startTime, Math.min(TIMELINE_END, animDef.startTime + (now - begin)));
      if (!applied && hit && t >= 0) {
        applied = true;
        setTargetHp(36 - damage);
      }
      setClock(t);
      if (t < TIMELINE_END) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setClock(null);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const allyHex = ALLY_POSITIONS[allyDir]!;
  const allyC = hexCenter(allyHex.x, allyHex.y);
  const enemyC = hexCenter(ENEMY_HEX.x, ENEMY_HEX.y);
  // a=攻撃側の起点 / d=受ける側(踏み込み・飛び道具はa→dの座標系)
  const a = enemyActs ? enemyC : allyC;
  const d = enemyActs ? allyC : enemyC;
  const active = clock !== null;
  const frame = active && animDef ? attackFrameAt(animDef, clock) : null;
  const off = active && animDef ? attackLungeAt(animDef, clock) : 0;
  const actorPos = { cx: a.cx + (d.cx - a.cx) * off, cy: a.cy + (d.cy - a.cy) * off };
  const reaction = active && isHit && clock !== null && clock >= 0 && clock <= IMPACT_REACTION_MS;
  // 自軍/敵それぞれの表示位置とフレーム(攻撃側=攻撃フレーム+ランジ、受ける側=被弾リアクション)
  const allyPos = enemyActs ? allyC : actorPos;
  const enemyPos = enemyActs ? actorPos : enemyC;
  const allySrc = enemyActs
    ? (reaction && defendReaction ? defendReaction : standAlly.src)
    : (frame?.image ?? standAlly.src);
  const enemySrc = enemyActs
    ? (frame?.image ?? standEnemy.src)
    : (reaction && defendReaction ? defendReaction : standEnemy.src);
  const popupP = active && clock !== null && clock >= 0 ? clock / TIMELINE_END : null;
  // 戦闘中は両者が互いに相手の方を向く(本番のflipOverridesと同じルール)。
  // 通常時は陣営既定(自軍=右向き/敵=左向き)
  const faceLeft = (self: { cx: number }, other: { cx: number }, fallback: boolean) =>
    other.cx < self.cx ? true : other.cx > self.cx ? false : fallback;
  const allyFlip = active ? faceLeft(allyC, enemyC, false) : false;
  const enemyFlip = active ? faceLeft(enemyC, allyC, true) : true;

  // エフェクト(飛び道具+追加トラック)。本番のcombatTimelineと同じ解決関数を使う
  const pathAngle =
    (Math.atan2(d.cy - a.cy, d.cx - a.cx) * 180) / Math.PI +
    90 +
    (tilted ? diagonalDeg : 0);
  const effects =
    active && animDef && clock !== null
      ? [
          ...(animDef.missile
            ? (() => {
                const m = missileStateAt(animDef.missile!, clock);
                if (!m) return [];
                return [{
                  key: "missile",
                  cx: a.cx + (d.cx - a.cx) * m.progress,
                  // heightPxはWesnothの72pxヘックス基準px = 盤面座標(2S=72px)と1:1
                  cy: a.cy + (d.cy - a.cy) * m.progress + m.heightPx,
                  angleDeg: m.rotates ? pathAngle : 0,
                  image: m.image,
                  sizePx: m.size as number | undefined,
                }];
              })()
            : []),
          ...attackTrackStatesAt(animDef, clock).map((s, idx) => {
            const base =
              s.anchor === "unit"
                ? actorPos // ランジ中の攻撃側表示位置に追従
                : {
                    cx: a.cx + (d.cx - a.cx) * s.progress,
                    cy: a.cy + (d.cy - a.cy) * s.progress,
                  };
            return {
              key: `track${idx}`,
              cx: base.cx + s.xPx,
              cy: base.cy + s.yPx,
              angleDeg: s.rotates ? pathAngle : 0,
              image: s.image,
              sizePx: s.size,
            };
          }),
        ]
      : [];

  const width = 1.5 * S * 2 + 2 * S;
  const height = SQRT3 * S * 3.5 + S; // 3行(敵の上下のヘックスまで)
  const origin = { cx: width / 2, cy: height / 2 };
  // 表示レイアウト: 魔法弾は攻撃側の頭上-54px(+球の半径25px)まで上がるため、
  // そのままだとviewBox上端でクリップされる。上下左右に余白を取り、全体を1.5倍表示する。
  // パディングは上下・左右とも対称にすること(TiltStageの回転は要素中央基準なので、
  // 非対称にするとJS側の投影原点(width/2, height/2)とズレてビルボードの位置が狂う)
  const PAD_X = 24;
  const PAD_Y = 48;
  const ZOOM = 1.5;
  const viewBox = `${-PAD_X} ${-PAD_Y} ${width + PAD_X * 2} ${height + PAD_Y * 2}`;
  const dispW = (width + PAD_X * 2) * ZOOM;
  const dispH = (height + PAD_Y * 2) * ZOOM;
  const foot = (pt: { cx: number; cy: number }) =>
    withFootOffset(projectTilt(pt, origin, tilted, diagonalDeg), tilted, footOffsetRatio * S);
  const allyP = foot(allyPos);
  const enemyP = foot(enemyPos);
  const targetP = foot(d); // ダメージ数字は受ける側の(静止)ヘックスに出す
  const actorP = enemyActs ? enemyP : allyP; // swoosh重ね描き用


  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2>戦闘アニメーション([attack_anim] 実データ)</h2>
      <div className="row" style={{ margin: "8px 0" }}>
        <select
          value={kind}
          disabled={active}
          onChange={(e) => setKind(e.target.value)}
        >
          {attackIds.map((id) => {
            const atk = actorDef.attacks![id]!;
            const label = atk.offset ? "近接(踏み込みあり)" : atk.missile ? "遠隔(飛び道具あり)" : "攻撃";
            return <option key={id} value={id}>{id} — {label}</option>;
          })}
          <option value={GENERIC_MELEE_ID}>近接(汎用・立ちアニメで踏み込み)</option>
        </select>
        <label style={{ marginLeft: 8 }}>相手:</label>
        <select
          value={defKey}
          disabled={active}
          onChange={(e) => setDefKey(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          {Object.entries(SPRITE_KEYS_BY_FACTION).map(([faction, keys]) => (
            <optgroup key={faction} label={faction}>
              {keys.map((key) => {
                const unitName = key.split("/")[2] ?? key;
                return <option key={key} value={key}>{unitName}</option>;
              })}
            </optgroup>
          ))}
        </select>
        <label style={{ marginLeft: 8 }}>自軍の位置:</label>
        <select value={allyDir} disabled={active} onChange={(e) => setAllyDir(e.target.value)}>
          {Object.entries(ALLY_POSITIONS).map(([dir, pos]) => (
            <option key={dir} value={dir}>{pos.label}</option>
          ))}
        </select>
        <label style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={enemyActs}
            disabled={active}
            onChange={(e) => setEnemyActs(e.target.checked)}
          />
          敵側が攻撃
        </label>
        <button className="primary" disabled={active || !ready} onClick={() => play(true)}>
          ⚔ 攻撃(命中)
        </button>
        <button disabled={active || !ready} onClick={() => play(false)}>
          攻撃(回避される)
        </button>
        {animDef && (
          <span className="dim" style={{ fontSize: 12 }}>
            start_time={animDef.startTime}ms → 打撃(t=0)で被弾リアクション/HP/ダメージ数字が同期
          </span>
        )}
      </div>
      <div
        style={{
          position: "relative",
          width: dispW,
          height: dispH,
          transform: tilted ? `translateY(${yOffset}px)` : undefined,
          transition: "transform 0.3s ease",
        }}
      >
        <TiltStage tilted={tilted} diagonalDeg={diagonalDeg}>
          <svg viewBox={viewBox} width={dispW} height={dispH} style={{ display: "block" }}>
            {[0, 1, 2].map((x) =>
              [0, 1, 2].map((y) => (
                <polygon
                  key={`${x},${y}`}
                  points={hexPoints(x, y)}
                  fill={TERRAIN_FILL[(x + y) % 3]}
                  stroke="#10141a"
                  strokeWidth={1.5}
                />
              )),
            )}
          </svg>
        </TiltStage>
        {/* スプライト・文字は傾けない(ビルボード): 位置だけ地形と同じ投影先へ動かす */}
        <svg
          viewBox={viewBox}
          width={dispW}
          height={dispH}
          style={{ display: "block", position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        >
          {/* 本番と同じ向きの方針: 自軍(owner=0)は常に右向き、敵(owner=1)は常に左向き(反転)。
              重なり順も本番(HexGrid)と同じ画家順: 投影後の画面y(ランジ込みの足元)が
              小さい方=奥から先に描く。かつては「攻撃側を後に描く」固定順だったが、
              上側(奥)から攻撃すると奥のユニットが手前に被る誤りだった(2026-07-06修正)。
              HPバーは情報レイヤーとして両スプライトの上に第2パスで描く(案1の検証) */}
          {(() => {
            const combatUnits = [
              { key: "ally", cx: allyP.cx, cy: allyP.cy, src: allySrc, owner: 0,
                hp: enemyActs ? targetHp / 36 : 1, xp: 0.4, scale: allyP.scale, leader: true, flip: allyFlip },
              { key: "enemy", cx: enemyP.cx, cy: enemyP.cy, src: enemySrc, owner: 1,
                hp: enemyActs ? 1 : targetHp / 36, xp: 0.7, scale: enemyP.scale, leader: false, flip: enemyFlip },
            ].sort((a, b) => a.cy - b.cy);
            return (
              <>
                {combatUnits.map((u) => (
                  <SpriteUnit
                    key={u.key}
                    cx={u.cx}
                    cy={u.cy}
                    src={u.src}
                    leader={u.leader}
                    hpRatio={u.hp}
                    xpRatio={u.xp}
                    scale={depthScale ? u.scale : 1}
                    flip={u.flip}
                    owner={u.owner}
                    hideBar={barTopLayer}
                    barPos={barPos}
                  />
                ))}
                {barTopLayer &&
                  combatUnits.map((u) => (
                    <UnitBar
                      key={`bar-${u.key}`}
                      cx={u.cx}
                      cy={u.cy}
                      hpRatio={u.hp}
                      xpRatio={u.xp}
                      scale={depthScale ? u.scale : 1}
                      pos={barPos}
                    />
                  ))}
              </>
            );
          })()}
          {/* ~BLIT(swoosh)相当: 攻撃側と同位置に重ね描き(近接のみ) */}
          {frame?.overlay && (
            (() => {
              const s = S * (depthScale ? actorP.scale : 1);
              return (
                <image
                  href={frame.overlay}
                  x={actorP.cx - s}
                  y={actorP.cy - s}
                  width={s * 2}
                  height={s * 2}
                  style={{ imageRendering: "pixelated" }}
                  pointerEvents="none"
                />
              );
            })()
          )}
          {/* 戦闘エフェクト(飛び道具・詠唱halo等。sizePx未指定は原寸) */}
          {effects.map((e) => {
            const ep = projectTilt(e, origin, tilted, diagonalDeg);
            const w = e.sizePx ?? imageNaturalSize(e.image)?.w ?? S * 2;
            const h = e.sizePx ?? imageNaturalSize(e.image)?.h ?? S * 2;
            return (
              <image
                key={e.key}
                href={e.image}
                x={ep.cx - w / 2}
                y={ep.cy - h / 2}
                width={w}
                height={h}
                transform={`rotate(${e.angleDeg} ${ep.cx} ${ep.cy})`}
                style={{ imageRendering: "pixelated" }}
                pointerEvents="none"
              />
            );
          })}
          {/* ダメージ数字: 打撃後にふわっと浮き上がって消える(本ゲーム側のUI演出) */}
          {popupP !== null && (
            <text
              x={targetP.cx}
              y={targetP.cy - S * 0.9 - popupP * 22}
              textAnchor="middle"
              fontSize={16}
              fontWeight={700}
              fill={isHit ? "#ff6b6b" : "#9aa4b0"}
              opacity={1 - popupP}
              pointerEvents="none"
            >
              {isHit ? `-${damage}` : "回避!"}
            </text>
          )}
        </svg>
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
        本番組み込み時は、エンジンの戦闘結果(CombatResult.strikes: 打撃ごとのhit/damage列)を
        タイムラインに変換して攻守交互に再生する想定。狂戦(最大30ラウンド)は倍速・省略が必要。
        (この検証データは本番と同じ lib/sprites.ts の UNIT_SPRITES を参照している)
      </p>
    </div>
  );
}

const GRID_W = 20;
const GRID_H = 14;
const TERRAIN_FILL = ["#4e7a3a", "#2d5527", "#7a6a45"]; // 草原/森/丘っぽい色

// 偶数列→上右(x+1,y-1)→奇数列→下右(x+1,y+1)→偶数列... を繰り返す水平ジグザグ経路
const MOVE_PATH = [
  { x: 2, y: 6 },
  { x: 3, y: 5 },
  { x: 4, y: 6 },
  { x: 5, y: 5 },
  { x: 6, y: 6 },
  { x: 7, y: 5 },
  { x: 8, y: 6 },
  { x: 9, y: 5 },
  { x: 10, y: 6 },
  { x: 11, y: 5 },
  { x: 12, y: 6 },
];

// 盤面の傾き: 投影計算・地形コンテナは共有実装(lib/tilt.ts / TiltStage.tsx)を使う。
// デモ固有なのはスライダー調整用の既定値のみ(本番採用値はlib/tilt.tsのBOARD_*)
const DEFAULT_TILT_Y_OFFSET_PX = -24;
// スライダーの初期値は本番採用値(lib/tilt.tsのBOARD_DIAGONAL_DEG)に合わせる
const DEFAULT_DIAGONAL_DEG = BOARD_DIAGONAL_DEG;

// UNIT_SPRITES に未登録のユニット用: spriteKey → 基本画像パス
const SPRITE_FALLBACK: Record<string, string> = {
  "units/northerners/orcish_grunt":     "/sprites/orcish_grunt/grunt.png",
  "units/northerners/orcish_warrior":   "/sprites/orcish_warrior/warrior.png",
  "units/northerners/orcish_archer":    "/sprites/orcish_archer/archer.png",
  "units/northerners/orcish_crossbow":  "/sprites/orcish_crossbow/xbowman.png",
  "units/northerners/orcish_assassin":  "/sprites/orcish_assassin/assassin.png",
  "units/northerners/orcish_slayer":    "/sprites/orcish_slayer/slayer.png",
  "units/northerners/orcish_nightblade": "/sprites/orcish_nightblade/nightblade.png",
  "units/northerners/orcish_pillager":  "/sprites/orcish_pillager/pillager.png",
  "units/northerners/wolf_rider":       "/sprites/wolf_rider/wolf-rider.png",
  "units/northerners/troll":            "/sprites/troll/great-troll.png",
  "units/northerners/troll_whelp":      "/sprites/troll_whelp/whelp.png",
};

function getSpriteImg(spriteKey: string): string {
  return UNIT_SPRITES[spriteKey]?.base ?? SPRITE_FALLBACK[spriteKey] ?? "";
}

const FACTION_ORDER = ["loyalists", "drakes", "northerners", "rebels", "undead"] as const;

function SpriteGallery() {
  const [factionId, setFactionId] = useState<string>("loyalists");
  const faction = FACTIONS[factionId];
  if (!faction) return null;

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2>全兵科スプライト確認</h2>
      <div className="row" style={{ marginBottom: 10, flexWrap: "wrap", gap: 4 }}>
        {FACTION_ORDER.map((id) => (
          <button
            key={id}
            className={factionId === id ? "primary" : undefined}
            style={{ padding: "4px 12px" }}
            onClick={() => setFactionId(id)}
          >
            {FACTIONS[id]?.name ?? id}
          </button>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: 8,
        }}
      >
        {faction.units.map((unit) => {
          const img = getSpriteImg(unit.spriteKey);
          return (
            <div
              key={unit.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#1a2130",
                borderRadius: 6,
                padding: "6px 4px 4px",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  background: "#263040",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {img ? (
                  <img
                    src={img}
                    alt={unit.name}
                    width={72}
                    height={72}
                    style={{ imageRendering: "pixelated", objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ color: "#556", fontSize: 10 }}>no img</span>
                )}
              </div>
              <span style={{ fontSize: 10, marginTop: 4, textAlign: "center", color: "#9aa4b0", lineHeight: 1.3 }}>
                {unit.name}
              </span>
              <span style={{ fontSize: 9, color: "#556", textAlign: "center" }}>Lv{unit.level}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SpriteAnimDemo() {
  const [selectedSpriteKey, setSelectedSpriteKey] = useState(DEFAULT_SPRITE_KEY);
  const selectedDef = UNIT_SPRITES[selectedSpriteKey] ?? UNIT_SPRITES[DEFAULT_SPRITE_KEY]!;

  const [loaded, setLoaded] = useState(false);
  const [animEnabled, setAnimEnabled] = useState(true);
  const [tilted, setTilted] = useState(false);
  const [clickedHex, setClickedHex] = useState<string | null>(null);
  const [yOffset, setYOffset] = useState(DEFAULT_TILT_Y_OFFSET_PX);
  const [footOffsetRatio, setFootOffsetRatio] = useState(-1 / 3); // ヘックス半径Sに対する比率
  const [diagonalDeg, setDiagonalDeg] = useState(DEFAULT_DIAGONAL_DEG);
  const [depthScale, setDepthScale] = useState(true); // 奥のユニットを縮小するか(密度圧縮の検証)
  // HPバーの見え方の検証(重なり時の可読性): 位置(足元/頭上/左上縦)とレイヤー(最前面/奥行き)。
  // 既定は本番採用構成(左上縦+奥行きに従う。2026-07-06決定)
  const [barPos, setBarPos] = useState<BarPos>("side");
  const [barTopLayer, setBarTopLayer] = useState(false);
  // 行動状態リング(足元。2026-07-08)の検収用: u3の行動可能/行動済みを切り替えて
  // 破線の回転(行動可能)⇄実線の静止(行動済み)を目視確認する
  const [u3Acted, setU3Acted] = useState(true);
  // 状態異常の検収用(2026-07-08): u1(行動可能=リング回転中)で遅化の振動を、
  // u4でスプライト全体の毒(緑系色調補正)を確認する
  const [u1Slowed, setU1Slowed] = useState(false);
  const [u4Poisoned, setU4Poisoned] = useState(false);

  // アイソメトリックパン/ズーム(傾きあり時のみ使用)
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [viewScale, setViewScale] = useState(1.0);
  const viewScaleRef = useRef(1.0);
  const isPointerDown = useRef(false);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  // マルチタッチ: pointerIdごとの現在位置。1本=パン / 2本=ピンチズーム+重心パン
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef(0);
  const lastCentroid = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  // ちらつき防止: 選択ユニットの全フレームを先に読み込む(ユニット切り替え時もリセット)。
  // loadImage(sprites.ts)経由にすることで原寸キャッシュにも記録される
  useEffect(() => {
    setLoaded(false);
    let alive = true;
    void Promise.all(
      allSpriteImages(selectedDef).map((u) =>
        loadImage(u).then((ok) => (ok ? recolorImage(u, 0) : undefined)),
      ),
    ).then(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  // selectedDef.baseをキーとして使うことでユニット切り替え時に再実行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDef.base]);

  // 傾き切り替え時: 傾きON→2Dパンをリセット、傾きOFF→アイソメパン/ズームをリセット
  useEffect(() => {
    if (tilted) {
      transformRef.current?.resetTransform(0);
    } else {
      setViewOffset({ x: 0, y: 0 });
      viewScaleRef.current = 1.0;
      setViewScale(1.0);
    }
  }, [tilted]);

  // ホイールズーム: React の onWheel は passive 登録になるため imperatively 追加
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!tilted) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = Math.max(0.2, Math.min(4, viewScaleRef.current * factor));
      viewScaleRef.current = next;
      setViewScale(next);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [tilted]);

  // ユニット1: 移動デモ(移動中もアニメ継続)
  const anim1 = useWmlAnimation(animEnabled, selectedDef);
  const { px, moving, slideAlong } = useHexSlide(MOVE_PATH[0]);
  const [atGoal, setAtGoal] = useState(false);

  // ユニット2〜4: 複数同時再生の確認(開始位置をずらしてある)
  const anim2 = useWmlAnimation(animEnabled, selectedDef);
  const anim3 = useWmlAnimation(animEnabled, selectedDef);
  const anim4 = useWmlAnimation(animEnabled, selectedDef);

  // アイソメトリックパン: スクリーン空間のドラッグ量を地平面座標へ逆変換して viewOffset に積算
  const applyPanDelta = (dx_s: number, dy_s: number) => {
    const scale = viewScaleRef.current;
    const diagRad = (diagonalDeg * Math.PI) / 180;
    const dx_r = (dx_s * Math.cos(-diagRad) - dy_s * Math.sin(-diagRad)) / scale;
    const dy_r = (dx_s * Math.sin(-diagRad) + dy_s * Math.cos(-diagRad)) / scale;
    setViewOffset((prev) => ({ x: prev.x + dx_r, y: prev.y + dy_r / Math.cos(TILT_RAD) }));
  };
  const centroidAndDist = () => {
    const pts = [...activePointers.current.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { cx, cy, dist };
  };
  const onTiltPointerDown = (e: React.PointerEvent) => {
    // 注意: ここではsetPointerCaptureしない。キャプチャ中のclickはヘックスではなく
    // コンテナに再ターゲットされ、マウスの単純クリックでhexが選択できなくなる。
    // キャプチャは「ドラッグ/ピンチが実際に始まった時点」で取る
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 1) {
      isPointerDown.current = true;
      isDragging.current = false;
      didDrag.current = false;
      lastPointer.current = { x: e.clientX, y: e.clientY };
    } else {
      // 2本目以降: ピンチ開始。基準の距離と重心を取り直し、両ポインタをキャプチャ
      // (ピンチはclick対象にならないので、ここでのキャプチャは無害)
      for (const id of activePointers.current.keys()) {
        try {
          e.currentTarget.setPointerCapture(id);
        } catch {
          // 既に解放されたポインタ等は無視
        }
      }
      isDragging.current = false;
      const { cx, cy, dist } = centroidAndDist();
      lastCentroid.current = { x: cx, y: cy };
      pinchDist.current = dist;
      didDrag.current = true; // ピンチ後のclick誤発火を防ぐ
    }
  };
  const onTiltPointerMove = (e: React.PointerEvent) => {
    const p = activePointers.current.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (activePointers.current.size >= 2) {
      // ピンチ: 距離比でズーム + 重心の移動でパン
      const { cx, cy, dist } = centroidAndDist();
      if (pinchDist.current > 0 && dist > 0) {
        const next = Math.max(0.2, Math.min(4, viewScaleRef.current * (dist / pinchDist.current)));
        viewScaleRef.current = next;
        setViewScale(next);
      }
      pinchDist.current = dist;
      applyPanDelta(cx - lastCentroid.current.x, cy - lastCentroid.current.y);
      lastCentroid.current = { x: cx, y: cy };
      return;
    }
    if (!isPointerDown.current) return;
    const dx_s = e.clientX - lastPointer.current.x;
    const dy_s = e.clientY - lastPointer.current.y;
    if (!isDragging.current) {
      if (Math.hypot(dx_s, dy_s) < 6) return;
      isDragging.current = true;
      didDrag.current = true;
      // ドラッグ確定時に初めてキャプチャする(指/カーソルが要素外に出てもmove継続。
      // 以後のclickは抑止対象なので再ターゲットされても問題ない)
      e.currentTarget.setPointerCapture(e.pointerId);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      return;
    }
    lastPointer.current = { x: e.clientX, y: e.clientY };
    applyPanDelta(dx_s, dy_s);
  };
  const onTiltPointerUp = (e?: React.PointerEvent) => {
    if (e) {
      activePointers.current.delete(e.pointerId);
      // 2本→1本になったら、残った指を単独パンの起点に取り直す(ジャンプ防止)
      if (activePointers.current.size === 1) {
        const rest = [...activePointers.current.values()][0];
        lastPointer.current = { x: rest.x, y: rest.y };
        isPointerDown.current = true;
        isDragging.current = true;
        pinchDist.current = 0;
        return;
      }
      if (activePointers.current.size > 0) return;
    } else {
      activePointers.current.clear();
    }
    pinchDist.current = 0;
    isPointerDown.current = false;
    isDragging.current = false;
  };

  const width = 1.5 * S * (GRID_W - 1) + 2 * S;
  const height = SQRT3 * S * (GRID_H + 0.5) + S;

  // 手前・中間・奥に1体ずつ配置して、奥の圧縮(密度圧縮)を比較しやすくする
  const u2 = hexCenter(16, 2); // 手前
  const u3 = hexCenter(10, 7); // 中間
  const u4 = hexCenter(4, 12); // 奥
  const origin = { cx: width / 2, cy: height / 2 };
  const footOffsetPx = footOffsetRatio * S;
  // 傾きあり時: viewOffset 分シフトしてから投影することで地形レイヤーの <g transform> と同期する
  const vo = tilted ? viewOffset : { x: 0, y: 0 };
  const sh = (p: { cx: number; cy: number }) => ({ cx: p.cx + vo.x, cy: p.cy + vo.y });
  const pxP = withFootOffset(projectTilt(sh(px), origin, tilted, diagonalDeg), tilted, footOffsetPx);
  const u2P = withFootOffset(projectTilt(sh(u2), origin, tilted, diagonalDeg), tilted, footOffsetPx);
  const u3P = withFootOffset(projectTilt(sh(u3), origin, tilted, diagonalDeg), tilted, footOffsetPx);
  const u4P = withFootOffset(projectTilt(sh(u4), origin, tilted, diagonalDeg), tilted, footOffsetPx);

  return (
    <main className="page">
      <h1 style={{ marginBottom: 8 }}>スプライトアニメーション検証</h1>

      {/* ユニット選択 */}
      <div className="row" style={{ marginBottom: 12, alignItems: "center" }}>
        <label style={{ fontWeight: 600, marginRight: 6 }}>ユニット:</label>
        <select
          value={selectedSpriteKey}
          onChange={(e) => setSelectedSpriteKey(e.target.value)}
          style={{ maxWidth: 320 }}
        >
          {Object.entries(SPRITE_KEYS_BY_FACTION).map(([faction, keys]) => (
            <optgroup key={faction} label={faction}>
              {keys.map((key) => {
                const unitName = key.split("/")[2] ?? key;
                return <option key={key} value={key}>{unitName}</option>;
              })}
            </optgroup>
          ))}
        </select>
        <span className="dim" style={{ fontSize: 12 }}>
          {selectedDef.attacks ? `攻撃アニメ: ${Object.keys(selectedDef.attacks).join(", ")}` : "攻撃アニメなし"}
        </span>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button
          className="primary"
          disabled={moving || !loaded}
          onClick={() => {
            const path = atGoal ? [...MOVE_PATH].reverse() : MOVE_PATH;
            slideAlong(path);
            setAtGoal(!atGoal);
          }}
        >
          {moving ? "移動中..." : "移動(200ms/ヘックス)"}
        </button>
        <button onClick={() => setAnimEnabled((v) => !v)}>
          アニメ{animEnabled ? "停止(基本画像)" : "再開"}
        </button>
        <button onClick={() => setTilted((v) => !v)}>
          盤面の傾き{tilted ? "OFF" : "ON"}
        </button>
        {tilted && (
          <label className="row" style={{ gap: 6, alignItems: "center" }}>
            <span className="dim" style={{ fontSize: 12 }}>
              上下位置(y: {yOffset}px)
            </span>
            <input
              type="range"
              min={-80}
              max={20}
              step={1}
              value={yOffset}
              onChange={(e) => setYOffset(Number(e.target.value))}
            />
          </label>
        )}
        {tilted && (
          <label className="row" style={{ gap: 6, alignItems: "center" }}>
            <span className="dim" style={{ fontSize: 12 }}>
              足元の食い込み(foot: {footOffsetRatio.toFixed(2)}×S ={" "}
              {footOffsetPx.toFixed(0)}px)
            </span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={footOffsetRatio}
              onChange={(e) => setFootOffsetRatio(Number(e.target.value))}
            />
          </label>
        )}
        {tilted && (
          <label className="row" style={{ gap: 6, alignItems: "center" }}>
            <span className="dim" style={{ fontSize: 12 }}>
              右斜め(diagonal: {diagonalDeg}deg)
            </span>
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={diagonalDeg}
              onChange={(e) => setDiagonalDeg(Number(e.target.value))}
            />
          </label>
        )}
        {tilted && (
          <button onClick={() => setDepthScale((v) => !v)}>
            奥を縮小{depthScale ? "ON(密度圧縮を検証)" : "OFF(等倍のまま)"}
          </button>
        )}
        {/* HPバーの見え方の検証: 案1=最前面レイヤー / 案2=頭上 / 本家風=左上縦(組み合わせも試せる) */}
        <button onClick={() => setBarPos((v) => NEXT_BAR_POS[v])}>
          バー位置: {BAR_POS_LABEL[barPos]}
        </button>
        <button onClick={() => setBarTopLayer((v) => !v)}>
          バー: {barTopLayer ? "最前面" : "奥行きに従う"}
        </button>
        <button onClick={() => setU3Acted((v) => !v)}>
          u3の行動状態リング: {u3Acted ? "行動済み(静止)" : "行動可能(回転)"}
        </button>
        <button onClick={() => setU1Slowed((v) => !v)}>
          u1の遅化(リング振動): {u1Slowed ? "ON" : "OFF"}
        </button>
        <button onClick={() => setU4Poisoned((v) => !v)}>
          u4の毒(緑系色調): {u4Poisoned ? "ON" : "OFF"}
        </button>
        <span className="dim" style={{ fontSize: 12 }}>
          {loaded ? `${allSpriteImages(selectedDef).length}枚プリロード済み` : "読み込み中..."}
        </span>
      </div>

      <div
        ref={containerRef}
        className="panel"
        style={{
          padding: 0,
          overflow: "hidden",
          clipPath: "inset(0)",
          height: 460,
          cursor: tilted ? "grab" : undefined,
          // スマホ: 1本指ドラッグがページスクロールに取られてpointercancelされるのを防ぐ
          touchAction: tilted ? "none" : undefined,
        }}
        onPointerDown={tilted ? onTiltPointerDown : undefined}
        onPointerMove={tilted ? onTiltPointerMove : undefined}
        onPointerUp={tilted ? onTiltPointerUp : undefined}
        onPointerCancel={tilted ? onTiltPointerUp : undefined}
      >
        <TransformWrapper
          ref={transformRef}
          minScale={0.2}
          maxScale={3}
          limitToBounds={false}
          centerOnInit
          doubleClick={{ disabled: true }}
          panning={{ velocityDisabled: true, disabled: tilted }}
          wheel={{ disabled: tilted }}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ padding: 24 }}
          >
            <div
              style={{
                position: "relative",
                width,
                height,
                transform: tilted ? `scale(${viewScale}) translateY(${yOffset}px)` : undefined,
                transformOrigin: "center center",
                transition: tilted ? undefined : "transform 0.3s ease",
              }}
            >
              <TiltStage tilted={tilted} diagonalDeg={diagonalDeg}>
                {/* overflow="visible": viewOffset で SVG viewport 外に出た hex も描画する。
                    スプライト SVG も同様に visible にしているので両レイヤーは常に整合する。
                    panel の clip-path: inset(0) がスクリーン空間でまとめてクリップする */}
                <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} overflow="visible" style={{ display: "block" }}>
                  <g transform={tilted ? `translate(${viewOffset.x},${viewOffset.y})` : undefined}>
                    {Array.from({ length: GRID_H }, (_, y) =>
                      Array.from({ length: GRID_W }, (_, x) => (
                        <polygon
                          key={`${x},${y}`}
                          points={hexPoints(x, y)}
                          fill={
                            clickedHex === `${x},${y}`
                              ? "#ffd166"
                              : TERRAIN_FILL[(x + y * 2) % 3]
                          }
                          stroke="#10141a"
                          strokeWidth={1.5}
                          onClick={() => { if (!didDrag.current) setClickedHex(`${x},${y}`); }}
                          style={{ cursor: "pointer" }}
                        />
                      )),
                    )}
                    {/* 移動経路の目印 */}
                    {MOVE_PATH.map((h) => {
                      const { cx, cy } = hexCenter(h.x, h.y);
                      return <circle key={`${h.x},${h.y}`} cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.35)" />;
                    })}
                  </g>
                </svg>
              </TiltStage>
              {/* スプライトは傾けない(ビルボード): 位置だけ地形と同じ投影先へ動かす */}
              <svg
                viewBox={`0 0 ${width} ${height}`}
                width={width}
                height={height}
                overflow="visible"
                style={{ display: "block", position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
              >
                {/* 重なり順は本番(HexGrid)と同じ画家順: 投影後の画面yが小さい方=奥から描く。
                    HPバーは情報レイヤーとして全スプライトの上に第2パスで描く(案1の検証)。
                    u1=移動+選択リング+遅化切り替え可 / u2=通常 / u3=行動状態リング切り替え可
                    (既定は行動済み・減光) / u4=HP低+毒切り替え可 */}
                {(() => {
                  const gridUnits = [
                    { key: "u1", p: pxP, src: anim1.src, selected: true, leader: true, hp: 0.85, xp: 0.3, acted: false, slowed: u1Slowed, poisoned: false },
                    { key: "u2", p: u2P, src: anim2.src, selected: false, leader: false, hp: 1, xp: 0.8, acted: false, slowed: false, poisoned: false },
                    { key: "u3", p: u3P, src: anim3.src, selected: false, leader: false, hp: 0.5, xp: 0.55, acted: u3Acted, slowed: false, poisoned: false },
                    { key: "u4", p: u4P, src: anim4.src, selected: false, leader: false, hp: 0.2, xp: 0.1, acted: false, slowed: false, poisoned: u4Poisoned },
                  ].sort((a, b) => a.p.cy - b.p.cy);
                  return (
                    <>
                      {gridUnits.map((u) => (
                        <SpriteUnit
                          key={u.key}
                          cx={u.p.cx}
                          cy={u.p.cy}
                          src={u.src}
                          selected={u.selected}
                          leader={u.leader}
                          acted={u.acted}
                          slowed={u.slowed}
                          poisoned={u.poisoned}
                          hpRatio={u.hp}
                          xpRatio={u.xp}
                          scale={depthScale ? u.p.scale : 1}
                          hideBar={barTopLayer}
                          barPos={barPos}
                        />
                      ))}
                      {barTopLayer &&
                        gridUnits.map((u) => (
                          <UnitBar
                            key={`bar-${u.key}`}
                            cx={u.p.cx}
                            cy={u.p.cy}
                            hpRatio={u.hp}
                            xpRatio={u.xp}
                            scale={depthScale ? u.p.scale : 1}
                            pos={barPos}
                          />
                        ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
      {clickedHex && (
        <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>
          クリックしたヘックス: ({clickedHex}) — 傾けた状態でも意図した場所を拾えているか確認
        </p>
      )}

      <CombatDemo
        loaded={loaded}
        tilted={tilted}
        yOffset={yOffset}
        footOffsetRatio={footOffsetRatio}
        diagonalDeg={diagonalDeg}
        depthScale={depthScale}
        barPos={barPos}
        barTopLayer={barTopLayer}
        atkDef={selectedDef}
      />

      <SpriteGallery />

      <div className="panel" style={{ marginTop: 12, fontSize: 13 }}>
        <h2>確認ポイント</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
          <li>立ちアニメ(常時)と待機アニメ(数秒おきに槍を構え直す動き)が個別のタイミングで再生される</li>
          <li>「移動」ボタンで1ヘックス200msのスライド。移動中もフレームアニメが止まらない</li>
          <li>選択リング・HPバー・★・行動済み減光がスプライトの上に正しく合成される</li>
          <li>4体同時再生でもカクつかない(各ユニット独立のタイマー)</li>
          <li>
            近接(spear): 踏み込み(offset)→swoosh重ね描き(~BLIT相当)→打撃の瞬間(t=0)に
            被弾リアクション・HPバー・ダメージ数字が同期する。回避時はリアクションなし
          </li>
          <li>
            遠隔(javelin): 攻撃側は据え置きのまま投げ、飛び道具が南東の相手へ直線移動して
            命中の瞬間(t=0)にちょうど到達する。被弾リアクション/HP/ダメージ数字の同期は近接と共通
          </li>
          <li>
            盤面の傾き(検証中): 地形(polygon)だけCSSの3D transform(perspective + rotateX)
            で傾け、ユニット・文字は傾けたまま歪ませず、地形と同じ投影計算で位置だけ動かす
            (ビルボード)。ヘックスをクリックすると着色されるので、傾けた状態でもクリック判定が
            意図した場所を拾えているか確認できる。「上下位置」は盤面全体(地形+スプライト)を
            まとめて動かす調整、「足元の食い込み」はスプライトだけを地形に対して下へずらし、
            傾きで縦に圧縮されたヘックスの下端に足を合わせるための調整(飛び道具には掛からない)。
            「右斜め」は対称性を上げるための追加の平面回転で、rotateX(奥へのチルト)を先に
            適用してから重ねている(地形はCSSの入れ子div、スプライトはprojectTilt内で
            同じ順序を再現)。「奥を縮小」は、地形が奥ほど間隔が詰まる(密度圧縮)のに対して
            スプライトが同じ大きさのままだと奥の行で重なって見づらくなるため、
            projectTiltが計算しているrotateX+perspectiveの拡大率(scale)をスプライトの
            描画サイズにも適用して奥を小さくする検証(ON/OFFで見比べられる)
          </li>
        </ul>
        <p className="dim" style={{ fontSize: 12 }}>
          画像はWesnoth本家(GPL)から検証用に取得(コミットしない)。取得:
          <code style={{ marginLeft: 4 }}>node packages/frontend/scripts/fetch-demo-sprites.mjs</code>
        </p>
      </div>
    </main>
  );
}
