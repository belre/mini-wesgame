// 時間解決: (定義, 時刻t) → 表示状態。すべて純粋関数。
// 本番の戦闘再生(combatTimeline.ts)と検証ページ(/dev/sprites)が同じ実装を使う
// (かつては両者に別実装があり、修正のたびに二重メンテが必要だった)。
import {
  MISSILE_DEFAULT_SIZE,
  type AnimTrack,
  type AttackAnimDef,
  type MissileDef,
  type OffsetSeg,
  type WmlFrame,
} from "./model";

// 区間補間: 時刻t(打撃基準)におけるOffsetSeg列の値。開始前は先頭のfrom、終了後はfallback
export function segmentValueAt(
  segs: OffsetSeg[],
  startTime: number,
  t: number,
  fallback: number,
): number {
  let acc = startTime;
  for (const seg of segs) {
    if (t < acc + seg.duration) {
      if (t < acc) return seg.from;
      return seg.from + (seg.to - seg.from) * ((t - acc) / seg.duration);
    }
    acc += seg.duration;
  }
  return fallback;
}

// 攻撃アニメ未定義・offset未定義の近接攻撃に使う汎用ランジ
// (踏み込みのみ。打撃時刻t=0に最大踏み込み0.5)
export const GENERIC_LUNGE: OffsetSeg[] = [
  { from: 0, to: 0, duration: 175 },
  { from: 0, to: 0.5, duration: 150 },
  { from: 0.5, to: 0, duration: 225 },
];
export const GENERIC_LUNGE_START_TIME = -325;

// 攻撃フレーム: 時刻tに表示するフレーム。範囲外はnull(=通常アニメのまま)
export function attackFrameAt(def: AttackAnimDef, t: number): WmlFrame | null {
  let acc = def.startTime;
  for (const f of def.frames) {
    if (t < acc + f.duration) return t >= acc ? f : null;
    acc += f.duration;
  }
  return null;
}

// 攻撃の踏み込み量(0=自ヘックス、1=相手ヘックス)。offset未定義は踏み込まない
export function attackOffsetAt(def: AttackAnimDef, t: number): number {
  if (!def.offset) return 0;
  return segmentValueAt(def.offset, def.startTime, t, 0);
}

// 攻撃側の表示位置の踏み込み解決(本番・デモ共通のポリシー):
// - 専用offsetがあればWMLどおり
// - offset未定義でも近接(missileなし)は汎用ランジ(打撃時刻t=0にピーク)
// - 遠隔(missileあり)は据え置き
// - 攻撃定義自体がない(未登録攻撃)も汎用ランジ(円ユニットにも演出が出る)
export function attackLungeAt(def: AttackAnimDef | undefined, t: number): number {
  if (def?.offset) return segmentValueAt(def.offset, def.startTime, t, 0);
  if (def?.missile) return 0;
  return segmentValueAt(GENERIC_LUNGE, GENERIC_LUNGE_START_TIME, t, 0);
}

// ---- 飛び道具 ----

// 飛び道具を進行方向へ回転させるか(rotate明示 > image=回転/frames=無回転の既定)
export function missileRotates(m: MissileDef): boolean {
  return m.rotate ?? !m.frames;
}

// 進行率(0=攻撃側,1=防御側)。offset未定義は線形
export function missileProgressAt(m: MissileDef, t: number): number {
  if (m.offset) return segmentValueAt(m.offset, m.startTime, t, 1);
  return Math.max(0, Math.min(1, (t - m.startTime) / m.duration));
}

// 高さ(px、負=上)。offsetY未定義は0
export function missileHeightAt(m: MissileDef, t: number): number {
  return m.offsetY ? segmentValueAt(m.offsetY, m.startTime, t, 0) : 0;
}

// 現在フレーム画像。framesはループ再生、なければimage
export function missileImageAt(m: MissileDef, t: number): string | null {
  if (m.frames && m.frames.length > 0) {
    const cycle = m.frames.reduce((sum, f) => sum + f.duration, 0);
    let tt = (((t - m.startTime) % cycle) + cycle) % cycle;
    for (const f of m.frames) {
      if (tt < f.duration) return f.image;
      tt -= f.duration;
    }
    return m.frames[0]!.image;
  }
  return m.image ?? null;
}

// 時刻tにおける飛び道具の表示状態(飛翔していない時刻はnull)。
// 座標系はレンダラー非依存: progressは攻撃側→防御側の比率、heightPxは72pxヘックス基準
export interface MissileState {
  progress: number;
  heightPx: number;
  image: string;
  rotates: boolean;
  size: number;
}

export function missileStateAt(m: MissileDef, t: number): MissileState | null {
  if (t < m.startTime || t > m.startTime + m.duration) return null;
  const image = missileImageAt(m, t);
  if (!image) return null;
  return {
    progress: missileProgressAt(m, t),
    heightPx: missileHeightAt(m, t),
    image,
    rotates: missileRotates(m),
    size: m.size ?? MISSILE_DEFAULT_SIZE,
  };
}

// ---- 並行トラック([halo_frame]等の追加レイヤー) ----

// 時刻tにおけるトラックの表示状態(区間外はnull)。座標系はレンダラー非依存:
// anchor "unit"はユニット表示位置からの相対px、"path"は攻撃側→防御側の進行率+相対px
export interface TrackState {
  image: string;
  anchor: "unit" | "path";
  progress: number; // pathのみ意味を持つ(unitは常に0)
  xPx: number;
  yPx: number;
  size?: number; // 未指定は原寸描画(imageNaturalSize)に任せる
  rotates: boolean;
}

export function trackStateAt(track: AnimTrack, t: number): TrackState | null {
  const cycle = track.frames.reduce((sum, f) => sum + f.duration, 0);
  if (cycle <= 0) return null;
  const windowMs = track.duration ?? cycle;
  if (t < track.startTime || t >= track.startTime + windowMs) return null;
  let tt = t - track.startTime;
  if (track.loop) {
    tt = tt % cycle;
  } else if (tt >= cycle) {
    return null;
  }
  let image: string | null = null;
  for (const f of track.frames) {
    if (tt < f.duration) {
      image = f.image;
      break;
    }
    tt -= f.duration;
  }
  if (!image) return null;
  return {
    image,
    anchor: track.anchor,
    progress:
      track.anchor === "path"
        ? track.offset
          ? segmentValueAt(track.offset, track.startTime, t, 1)
          : (t - track.startTime) / windowMs
        : 0,
    xPx: track.offsetX ? segmentValueAt(track.offsetX, track.startTime, t, 0) : 0,
    yPx: track.offsetY ? segmentValueAt(track.offsetY, track.startTime, t, 0) : 0,
    size: track.size,
    rotates: track.rotate ?? false,
  };
}

// 攻撃の追加トラック(extraTracks)の時刻tにおける表示状態の一覧
export function attackTrackStatesAt(def: AttackAnimDef, t: number): TrackState[] {
  const states: TrackState[] = [];
  for (const track of def.extraTracks ?? []) {
    const s = trackStateAt(track, t);
    if (s) states.push(s);
  }
  return states;
}
