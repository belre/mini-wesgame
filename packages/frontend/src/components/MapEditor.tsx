"use client";

// 簡易マップエディタ(開発用 /dev/mapeditor)。
// - 盤面描画は本番と同じ HexGrid(ジオラマ表示・傾きトグル込み)を再利用し、
//   onHexClick を「選択地形で塗る」に差し替えただけ(描画と判定の分離の配当)
// - データは core-engine/src/data/maps/*.json と同スキーマ(id/name/description/
//   width/height/tiles)。保存はJSONダウンロード or クリップボード
// - 点対称ペイント: 非同期PvPのマップは盤面中心の点対称が基本(keepの走査順割当と
//   ビュー反転の前提)。ONにすると対称位置にも同時に塗る
// - 本番登録の手順: 保存したJSONを core-engine/src/data/maps/ に置き、
//   maps.ts で import 登録(ロード時に validateMap が整合性を検証する)
import { useMemo, useRef, useState } from "react";
import {
  FACTIONS,
  getUnitDef,
  hexKey,
  TERRAIN_BY_CHAR,
  TERRAINS,
  MAPS,
  type GameMap,
  type UnitState,
} from "@parle-stroika/core-engine";
import HexGrid from "./HexGrid";

const EMPTY_SET: ReadonlySet<string> = new Set();
const DEFAULT_W = 12;
const DEFAULT_H = 9;
const GRASS = "g";

function blankTiles(w: number, h: number): string[] {
  return Array.from({ length: h }, () => GRASS.repeat(w));
}

// 幅・高さ変更: 既存の絵を左上基準で保持し、増えた分は草原で埋める
function resizeTiles(tiles: string[], w: number, h: number): string[] {
  return Array.from({ length: h }, (_, y) => {
    const row = tiles[y] ?? "";
    return (row + GRASS.repeat(w)).slice(0, w);
  });
}

function setChar(row: string, x: number, ch: string): string {
  return row.slice(0, x) + ch + row.slice(x + 1);
}

export default function MapEditor() {
  const [mapId, setMapId] = useState("my_map");
  const [name, setName] = useState("新しいマップ");
  const [description, setDescription] = useState("");
  const [width, setWidth] = useState(DEFAULT_W);
  const [height, setHeight] = useState(DEFAULT_H);
  const [tiles, setTiles] = useState<string[]>(() => blankTiles(DEFAULT_W, DEFAULT_H));
  const [brush, setBrush] = useState("f");
  const [symmetric, setSymmetric] = useState(true);
  const [tilted, setTilted] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  // ユニット配置(プレビュー専用: マップJSONのスキーマ外なので保存されない)。
  // 「この地形密度で駒が読めるか」をエディタ内で確認するための書き割り
  const [mode, setMode] = useState<"terrain" | "unit">("terrain");
  const [unitOwner, setUnitOwner] = useState(0);
  const [unitDefId, setUnitDefId] = useState("spearman");
  const [placedUnits, setPlacedUnits] = useState<Map<string, { owner: number; unitDefId: string }>>(new Map());
  // undo: 直近50手のタイルスナップショット
  const history = useRef<string[][]>([]);

  const gameMap: GameMap = useMemo(
    () => ({ id: mapId, name, width, height, tiles }),
    [mapId, name, width, height, tiles],
  );

  const previewUnits: UnitState[] = useMemo(
    () =>
      [...placedUnits.entries()]
        .filter(([key]) => {
          const [x, y] = key.split(",").map(Number);
          return x < width && y < height;
        })
        .map(([key, u], i) => {
          const [x, y] = key.split(",").map(Number);
          const def = getUnitDef(u.unitDefId);
          return {
            id: `preview-${i}`,
            unitDefId: u.unitDefId,
            owner: u.owner,
            pos: { x, y },
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
        }),
    [placedUnits, width, height],
  );

  const paint = (c: { x: number; y: number }) => {
    if (mode === "unit") {
      // 同じ内容のユニットをもう一度クリック=撤去、それ以外=配置/上書き
      setPlacedUnits((prev) => {
        const next = new Map(prev);
        const key = hexKey(c);
        const cur = next.get(key);
        if (cur && cur.owner === unitOwner && cur.unitDefId === unitDefId) next.delete(key);
        else next.set(key, { owner: unitOwner, unitDefId });
        return next;
      });
      return;
    }
    history.current.push(tiles);
    if (history.current.length > 50) history.current.shift();
    setTiles((prev) => {
      const next = [...prev];
      next[c.y] = setChar(next[c.y], c.x, brush);
      if (symmetric) {
        const sx = width - 1 - c.x;
        const sy = height - 1 - c.y;
        if (sx !== c.x || sy !== c.y) next[sy] = setChar(next[sy], sx, brush);
      }
      return next;
    });
  };

  const undo = () => {
    const prev = history.current.pop();
    if (prev) setTiles(prev);
  };

  const resize = (w: number, h: number) => {
    const cw = Math.max(3, Math.min(30, w));
    const ch = Math.max(3, Math.min(30, h));
    history.current.push(tiles);
    setWidth(cw);
    setHeight(ch);
    setTiles((prev) => resizeTiles(prev, cw, ch));
  };

  const toJson = () =>
    JSON.stringify({ id: mapId, name, description, width, height, tiles }, null, 2);

  const loadJson = (text: string) => {
    try {
      const d = JSON.parse(text) as Partial<GameMap> & { description?: string };
      if (!Array.isArray(d.tiles) || typeof d.width !== "number" || typeof d.height !== "number") {
        throw new Error("width / height / tiles が必要です");
      }
      for (const [y, row] of d.tiles.entries()) {
        if (typeof row !== "string" || row.length !== d.width) {
          throw new Error(`${y}行目の幅が width と一致しません`);
        }
        for (const ch of row) {
          if (!TERRAIN_BY_CHAR[ch]) throw new Error(`不明なタイル文字: '${ch}'(${y}行目)`);
        }
      }
      if (d.tiles.length !== d.height) throw new Error("行数が height と一致しません");
      history.current = [];
      setMapId(typeof d.id === "string" ? d.id : "my_map");
      setName(typeof d.name === "string" ? d.name : "");
      setDescription(typeof d.description === "string" ? d.description : "");
      setWidth(d.width);
      setHeight(d.height);
      setTiles(d.tiles as string[]);
      setMessage("読み込みました");
    } catch (e) {
      setMessage(`読み込み失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const download = () => {
    const blob = new Blob([toJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${mapId || "map"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // 対戦マップとしての健全性チェック(保存は妨げない。警告表示のみ)
  const warnings = useMemo(() => {
    const all = tiles.join("");
    const w: string[] = [];
    const keeps = [...all].filter((ch) => TERRAIN_BY_CHAR[ch] === "keep").length;
    if (keeps !== 2) w.push(`フラッグ(k)が${keeps}個(対戦には2個必要。走査順でP0→P1に割当)`);
    const castles = [...all].filter((ch) => TERRAIN_BY_CHAR[ch] === "castle").length;
    if (keeps > 0 && castles === 0) w.push("陣地(c)がない(雇用の配置先が必要)");
    return w;
  }, [tiles]);

  return (
    <div style={{ minHeight: "100vh", background: "#0c0f14", color: "#dfe6f2", padding: 16 }}>
      <h1 style={{ fontSize: 18 }}>マップエディタ(/dev/mapeditor)</h1>
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        盤面をクリックで塗る。保存したJSONは core-engine/src/data/maps/ に置いて
        maps.ts で登録すると本番マップになる(ロード時に整合性検証あり)
      </p>

      {/* メタ情報とサイズ */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 13 }}>
        <label>id <input value={mapId} onChange={(e) => setMapId(e.target.value)} style={{ width: 130 }} /></label>
        <label>名前 <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 160 }} /></label>
        <label>説明 <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: 220 }} /></label>
        <label>幅 <input type="number" value={width} min={3} max={30}
          onChange={(e) => resize(Number(e.target.value), height)} style={{ width: 52 }} /></label>
        <label>高さ <input type="number" value={height} min={3} max={30}
          onChange={(e) => resize(width, Number(e.target.value))} style={{ width: 52 }} /></label>
      </div>

      {/* 地形パレット */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {Object.entries(TERRAIN_BY_CHAR).map(([ch, id]) => (
          <button
            key={ch}
            onClick={() => setBrush(ch)}
            style={{
              padding: "4px 10px",
              fontSize: 13,
              border: brush === ch ? "2px solid #7ea4f0" : "1px solid #2a3242",
              background: brush === ch ? "#1d2735" : "#12161f",
              color: "#dfe6f2",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {TERRAINS[id].name}
            <span style={{ color: "#8a94a3", marginLeft: 4 }}>{ch}</span>
          </button>
        ))}
      </div>

      {/* ユニット配置(プレビュー専用) */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 13 }}>
        <label>
          <input type="radio" checked={mode === "terrain"} onChange={() => setMode("terrain")} />
          地形を塗る
        </label>
        <label>
          <input type="radio" checked={mode === "unit"} onChange={() => setMode("unit")} />
          ユニットを置く(プレビュー専用・JSONには保存されない)
        </label>
        {mode === "unit" && (
          <>
            <select value={unitOwner} onChange={(e) => setUnitOwner(Number(e.target.value))}>
              <option value={0}>青(味方)</option>
              <option value={1}>赤(相手)</option>
            </select>
            <select value={unitDefId} onChange={(e) => setUnitDefId(e.target.value)}>
              {Object.values(FACTIONS).map((f) => (
                <optgroup key={f.id} label={f.name}>
                  {f.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span style={{ color: "#8a94a3" }}>同じ駒をもう一度クリックで撤去</span>
            <button onClick={() => setPlacedUnits(new Map())}>ユニット全撤去</button>
          </>
        )}
      </div>

      {/* 操作トグル */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8, fontSize: 13 }}>
        <label>
          <input type="checkbox" checked={symmetric} onChange={(e) => setSymmetric(e.target.checked)} />
          点対称ペイント(対戦マップ用: 盤面中心の対称位置にも塗る)
        </label>
        <label>
          <input type="checkbox" checked={tilted} onChange={(e) => setTilted(e.target.checked)} />
          傾き表示
        </label>
        <button onClick={undo}>元に戻す</button>
        <button onClick={() => { history.current.push(tiles); setTiles(blankTiles(width, height)); }}>
          全消去(草原)
        </button>
        <label>
          既存マップを開く:
          <select
            defaultValue=""
            onChange={(e) => {
              const m = MAPS[e.target.value];
              if (m) loadJson(JSON.stringify({ ...m, description: "" }));
              e.target.value = "";
            }}
          >
            <option value="" disabled>選択…</option>
            {Object.values(MAPS).map((m) => (
              <option key={m.id} value={m.id}>{m.name}({m.id})</option>
            ))}
          </select>
        </label>
      </div>

      {/* 健全性チェック */}
      {warnings.length > 0 && (
        <div style={{ color: "#e0b04a", fontSize: 13, marginBottom: 8 }}>
          ⚠ {warnings.join(" / ")}
        </div>
      )}

      {/* 盤面(本番と同じHexGrid。クリック=塗り) */}
      <div style={{ overflow: "auto", border: "1px solid #2a3242", borderRadius: 8, padding: 8, marginBottom: 12 }}>
        <HexGrid
          map={gameMap}
          units={previewUnits}
          villageOwners={{}}
          activePlayer={0}
          selectedUnitId={null}
          moveTargets={EMPTY_SET}
          attackTargets={EMPTY_SET}
          recruitTargets={EMPTY_SET}
          draftTarget={null}
          tilted={tilted}
          onHexClick={paint}
        />
      </div>

      {/* 入出力 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, fontSize: 13 }}>
        <button className="primary" onClick={download}>JSONをダウンロード</button>
        <button onClick={() => { void navigator.clipboard.writeText(toJson()); setMessage("コピーしました"); }}>
          クリップボードへコピー
        </button>
        {message && <span style={{ color: "#8a94a3" }}>{message}</span>}
      </div>
      <details>
        <summary style={{ cursor: "pointer", fontSize: 13 }}>JSONを直接貼り付けて読み込む</summary>
        <textarea
          placeholder='{"id":"...","name":"...","width":12,"height":9,"tiles":["gggg...", ...]}'
          rows={6}
          style={{ width: "100%", maxWidth: 720, background: "#12161f", color: "#dfe6f2", fontFamily: "monospace", fontSize: 12 }}
          onBlur={(e) => e.target.value.trim() && loadJson(e.target.value)}
        />
        <p style={{ fontSize: 12, opacity: 0.7 }}>貼り付けてフォーカスを外すと読み込み</p>
      </details>
    </div>
  );
}
