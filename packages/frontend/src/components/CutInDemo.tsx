"use client";

// CutInStage(戦闘カットインの骨格)の検証デモ。
// 本物のマッチを作らず、エンジンのresolveCombatで実データの打撃列を生成して
// useCombatAnimations(第2インスタンス)→CutInStageの経路を単体で確認する。
// カットインは初の新規演出なので、見栄えの評価に必要な自由度をここに揃える:
// - 攻撃側・防御側のユニット選択(全陣営。スプライト定義のあるユニットのみ)
// - 攻撃の選択(近接/遠隔)と攻撃側の配置(防御側の周囲6方向)
// - 余韻: 再生終了後もカットインを保持する時間(最後のシーンを固めて表示)
import { useEffect, useRef, useState } from "react";
import {
  FACTIONS,
  getUnitDef,
  hexNeighbors,
  mapById,
  resolveCombat,
  terrainAt,
  TIME_OF_DAY_DEFS,
  type HexCoord,
  type UnitState,
} from "@parle-stroika/core-engine";
import { useCombatAnimations, type CombatFx, type CombatPlaybackInput } from "@/hooks/useCombatAnimations";
import { UNIT_SPRITES } from "@/lib/content";
import { hexCenter } from "@/lib/board/geometry";
import CutInStage from "./CutInStage";

const MAP = mapById("valley_crossing");
const DEFENDER_POS = { x: 4, y: 3 }; // 草原。周囲に城・村が入り地形の見栄えも確認できる

// 攻撃側の配置候補: 防御側の周囲6ヘックス(方向ラベルは画面座標の向きから導出)
const ATTACKER_CHOICES: { pos: HexCoord; label: string }[] = hexNeighbors(DEFENDER_POS).map(
  (pos) => {
    const o = hexCenter(DEFENDER_POS);
    const p = hexCenter(pos);
    const v = p.cy < o.cy ? "上" : "下";
    const h = p.cx < o.cx ? "左" : p.cx > o.cx ? "右" : "";
    return { pos, label: h + v };
  },
);

// 全陣営のユニット(スプライト定義があるもののみ)。optgroup用に陣営別
const UNIT_GROUPS: { faction: string; units: { id: string; name: string }[] }[] = Object.values(
  FACTIONS,
).map((f) => ({
  faction: f.name,
  units: f.units
    .filter((u) => UNIT_SPRITES[u.spriteKey])
    .map((u) => ({ id: u.id, name: u.name })),
}));

function makeUnit(
  id: string,
  owner: number,
  unitDefId: string,
  pos: { x: number; y: number },
): UnitState {
  const def = getUnitDef(unitDefId);
  return {
    id,
    unitDefId,
    owner,
    pos,
    hp: def.hp,
    maxHp: def.hp,
    movesLeft: def.movement.points,
    maxMoves: def.movement.points,
    attacksLeft: 1,
    isLeader: false,
    traits: [],
    poisoned: false,
    xp: 0,
  };
}

function UnitSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label}:
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 180 }}>
        {UNIT_GROUPS.map((g) => (
          <optgroup key={g.faction} label={g.faction}>
            {g.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}({u.id})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export default function CutInDemo() {
  const { fx, enqueue, current } = useCombatAnimations();
  const [attackerId, setAttackerId] = useState("spearman");
  const [defenderId, setDefenderId] = useState("orcish_grunt");
  const [attackIndex, setAttackIndex] = useState(0);
  const [dir, setDir] = useState(0); // ATTACKER_CHOICESのindex
  const [holdMs, setHoldMs] = useState(1200);
  const [tilted, setTilted] = useState(false); // 平面版と傾き版の見栄え比較用
  const [viewFlipped, setViewFlipped] = useState(false); // 青視点(180度回転)の検証用
  const [seed, setSeed] = useState(0);

  const attackerDef = getUnitDef(attackerId);
  const attacks = attackerDef.attacks;
  const safeAttackIndex = Math.min(attackIndex, attacks.length - 1);

  // 余韻: 再生終了時に最後のシーン(入力+fx)を固めてholdMsの間表示し続ける
  const lastSceneRef = useRef<{ input: CombatPlaybackInput; fx: CombatFx } | null>(null);
  const [held, setHeld] = useState<{ input: CombatPlaybackInput; fx: CombatFx } | null>(null);
  if (current) lastSceneRef.current = { input: current, fx }; // 再生中の最新フレームを常に確保
  useEffect(() => {
    if (current) {
      setHeld(null);
      return;
    }
    const last = lastSceneRef.current;
    if (!last) return;
    lastSceneRef.current = null;
    if (holdMs <= 0) return;
    setHeld(last);
    const t = setTimeout(() => setHeld(null), holdMs);
    return () => clearTimeout(t);
    // holdMsは「再生が終わった時点」の値を使う(スライダー変更で保持中の演出を動かさない)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const play = () => {
    const attackerPos = ATTACKER_CHOICES[dir].pos;
    const attacker = makeUnit("cutin-a", 0, attackerId, attackerPos);
    const defender = makeUnit("cutin-d", 1, defenderId, DEFENDER_POS);
    // 周辺ユニット(書き割り): 攻撃位置と被らない隣接ヘックスに敵味方を1体ずつ
    const bystanders = [
      makeUnit("cutin-b1", 0, "bowman", ATTACKER_CHOICES[(dir + 2) % 6].pos),
      makeUnit("cutin-b2", 1, "orcish_archer", ATTACKER_CHOICES[(dir + 4) % 6].pos),
    ];
    // 疑似乱数(再生ごとに変える): 決定論のLCGで命中パターンを揺らす
    let x = seed * 9301 + 49297;
    const rng = () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280;
    };
    setSeed((s) => s + 1);
    const attack = attacks[safeAttackIndex];
    const result = resolveCombat(
      {
        attacker,
        attackerDef,
        defender,
        defenderDef: getUnitDef(defenderId),
        attack,
        attackerTerrain: terrainAt(MAP, attackerPos),
        defenderTerrain: terrainAt(MAP, DEFENDER_POS),
        timeOfDay: TIME_OF_DAY_DEFS.dawn,
      },
      rng,
    );
    enqueue({
      attacker,
      defender,
      strikes: result.strikes,
      ghosts: [],
      attackerAttackId: attack.id,
      defenderAttackId: result.retaliationAttack?.id,
      bystanders,
    });
  };

  return (
    <main className="page">
      <h1>戦闘カットイン(CutInStage)の検証</h1>
      <div className="row" style={{ margin: "12px 0", gap: 10, flexWrap: "wrap" }}>
        <UnitSelect
          label="攻撃側"
          value={attackerId}
          onChange={(id) => {
            setAttackerId(id);
            setAttackIndex(0);
          }}
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          攻撃:
          <select value={safeAttackIndex} onChange={(e) => setAttackIndex(Number(e.target.value))}>
            {attacks.map((a, i) => (
              <option key={a.id} value={i}>
                {a.name}({a.range === "melee" ? "近接" : "遠隔"} {a.damage}×{a.count})
              </option>
            ))}
          </select>
        </label>
        <UnitSelect label="防御側" value={defenderId} onChange={setDefenderId} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          攻撃側の配置:
          <select value={dir} onChange={(e) => setDir(Number(e.target.value))}>
            {ATTACKER_CHOICES.map((c, i) => (
              <option key={c.label} value={i}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          余韻(終了後の保持): {holdMs}ms
          <input
            type="range"
            min={0}
            max={4000}
            step={250}
            value={holdMs}
            onChange={(e) => setHoldMs(Number(e.target.value))}
          />
        </label>
        <button onClick={() => setTilted((v) => !v)}>
          ステージ: {tilted ? "傾き(3D風)" : "平面"}
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={viewFlipped}
            onChange={(e) => setViewFlipped(e.target.checked)}
          />
          視点反転(青視点)
        </label>
        <button className="primary" onClick={play}>
          ⚔ 再生
        </button>
        <span className="dim" style={{ fontSize: 12 }}>
          連打するとキューに積まれて順番に再生される
        </span>
      </div>
      {/* board-wrap相当の相対コンテナ。本番ではBoardScreenのchildrenスロットに入る */}
      <div
        className="panel"
        style={{ position: "relative", height: 480, padding: 0, overflow: "hidden" }}
      >
        <div className="dim" style={{ padding: 12, fontSize: 13 }}>
          ここが盤面のつもり(カットインはこの上に重なる)。再生終了後は余韻の時間だけ最後のシーンを保持する。
        </div>
        <CutInStage
          map={MAP}
          fx={current ? fx : held?.fx ?? fx}
          current={current ?? held?.input ?? null}
          tilted={tilted}
          viewFlipped={viewFlipped}
          myIndex={0}
          timeOfDay={TIME_OF_DAY_DEFS.dawn}
        />
      </div>
    </main>
  );
}
