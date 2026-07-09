// 戦闘タイムラインコンパイラ: エンジンの戦闘結果(CombatResult.strikes)を
// 「時刻t → シーン状態」の純粋関数に変換する。
//
// - React/rAFに依存しない。時計を進めるのは呼び出し側(useCombatAnimationsのrAF、
//   将来的にはリプレイ再生など)の責務
// - 座標(hexCenter)とスプライト解決(spriteOf)は注入依存。盤面ジオメトリや
//   コンテンツ定義表の具体に結合しない
// - タイミング定数はhooks/animationTiming.tsが唯一の定義元(CPUのペース調整と共有)
import type { StrikeEvent, UnitState } from "@parle-stroika/core-engine";
import {
  MAX_PLAYED_STRIKES,
  STRIKE_WINDOW_MS,
  TAIL_MS,
} from "@/hooks/animationTiming";
import type { UnitSpriteDef, WmlFrame } from "./model";
import {
  attackFrameAt,
  attackLungeAt,
  attackTrackStatesAt,
  missileStateAt,
} from "./resolve";

export const IMPACT_AT_MS = 325; // 打撃枠内の打撃時刻(WMLのstart_time=-325に合わせる)
const REACTION_MS = 180; // 被弾リアクションの表示時間
const POPUP_MS = 800; // ダメージ数字が消えるまで

export interface CombatPlaybackInput {
  attacker: UnitState; // 戦闘前スナップショット(位置・HPは戦闘開始時点のもの)
  defender: UnitState;
  strikes: StrikeEvent[];
  ghosts: UnitState[]; // 戦闘で死亡し盤面から消えたユニット。演出中だけ描画する
  // 攻撃側/防御側それぞれが選択した攻撃のid(AttackDef.id。UNIT_SPRITES[].attacksのキー)。
  // 表示名(name)ではない(ローカライズされうるため識別子には使わない)。省略時は汎用ランジ
  attackerAttackId?: string;
  defenderAttackId?: string;
  // 戦闘前スナップショット時点の他ユニット(閲覧者に見えるもの)。演出には参加しない
  // 「書き割り」で、カットイン等のレンダラーが舞台範囲に立つものだけを描く。
  // 盤面の「今」ではなくスナップショットから取ること(再生中に盤面が先へ進んでいても
  // 舞台の整合性が保たれる)。盤面内アニメ(combatTimeline)はこのフィールドを使わない
  bystanders?: UnitState[];
}

export interface CombatPopup {
  key: string;
  // アンカー(対象ユニットのヘックス中心。盤面座標)。浮き上がりの上方向オフセットは
  // ここに焼き込まず dy に分離する — 盤面座標に足すとビュー変換(青視点の180度回転)で
  // 上下が裏返り、数字がユニットの下に出てしまうため。レンダラーは
  // 「投影・ビュー変換した後のy」から dy を引く(スクリーン空間で常に上方向)
  cx: number;
  cy: number;
  dy: number; // スクリーン空間の上方向オフセット(浮き上がり込み)
  text: string;
  color: string;
  alpha: number;
}

// 盤面に重ねて描くエフェクトスプライト(飛び道具・halo等の追加レイヤー)。
// sizePx未指定は原寸描画(imageNaturalSize)に任せる
export interface EffectSprite {
  key: string;
  // アンカー(盤面座標)。弾の弧の高さ(halo_y)等の縦オフセットはここに焼き込まず
  // dy に分離する — 盤面座標に足すとビュー変換(青視点の180度回転)で上下が裏返り、
  // 弧が下向きに出てしまうため。横オフセット(杖先フレア等)は反転時にミラーされるのが
  // 正しい(ユニットの向きも反転する)ので、cx側には焼き込んだままでよい
  cx: number;
  cy: number;
  dy: number; // スクリーン空間の縦オフセット(正=下)。レンダラーが投影・ビュー変換後に加算する
  angleDeg: number; // 進行方向(画像は「上向き」基準で描かれている前提の追加回転角)
  image: string;
  sizePx?: number; // 描画サイズ(px。盤面座標はWesnothの72pxヘックスと1:1)
}

export interface CombatFx {
  positions: ReadonlyMap<string, { cx: number; cy: number }>; // ランジ中の表示位置
  spriteOverrides: ReadonlyMap<string, WmlFrame>; // 攻撃/被弾フレームの上書き
  hpOverrides: ReadonlyMap<string, number>; // 打撃進行に同期したHP表示
  // 戦闘中の向き上書き(unitId → 左右反転するか)。通常時の向きは陣営既定
  // (先攻=右向き/後攻=左向き)だが、戦闘中は両者が互いに相手の方を向く。
  // 背を向けたまま踏み込む違和感を避けるため
  flipOverrides: ReadonlyMap<string, boolean>;
  ghosts: UnitState[];
  popups: CombatPopup[];
  effects: EffectSprite[]; // 飛び道具・halo等(描画順=配列順)
}

export const EMPTY_COMBAT_FX: CombatFx = {
  positions: new Map(),
  spriteOverrides: new Map(),
  hpOverrides: new Map(),
  flipOverrides: new Map(),
  ghosts: [],
  popups: [],
  effects: [],
};

// 注入依存(インターフェース)。盤面ジオメトリとスプライト解決の実装を差し替え可能にする
export interface CombatTimelineDeps {
  hexCenter(pos: { x: number; y: number }): { cx: number; cy: number };
  // unitDefId → スプライト定義(spriteKeyの解決とSpriteRegistryの合成は呼び出し側)
  spriteOf(unitDefId: string): UnitSpriteDef | undefined;
}

export interface CombatPlayback {
  totalMs: number;
  sceneAt(t: number): CombatFx;
}

export function compileCombatPlayback(
  input: CombatPlaybackInput,
  deps: CombatTimelineDeps,
): CombatPlayback {
  const played = input.strikes.slice(0, MAX_PLAYED_STRIKES);
  const total = played.length * STRIKE_WINDOW_MS + TAIL_MS;
  const targetOf = (s: StrikeEvent): UnitState =>
    s.actor === "attacker" ? input.defender : input.attacker;
  const impactTimeOf = (index: number): number =>
    index < played.length
      ? index * STRIKE_WINDOW_MS + IMPACT_AT_MS
      : total - TAIL_MS; // 省略した打撃(狂戦対策)は末尾でまとめて反映

  // 戦闘中は両者が互いに相手の方を向く(スプライトは右向きが原画。相手が左なら反転)。
  // 真上/真下(cxが同じ)は左右の情報がないため陣営既定(後攻=反転)のまま
  const flipOverrides = new Map<string, boolean>();
  {
    const ac = deps.hexCenter(input.attacker.pos);
    const dc = deps.hexCenter(input.defender.pos);
    const faceLeft = (self: { cx: number }, other: { cx: number }, fallback: boolean) =>
      other.cx < self.cx ? true : other.cx > self.cx ? false : fallback;
    flipOverrides.set(input.attacker.id, faceLeft(ac, dc, input.attacker.owner === 1));
    flipOverrides.set(input.defender.id, faceLeft(dc, ac, input.defender.owner === 1));
  }

  const sceneAt = (t: number): CombatFx => {
    const positions = new Map<string, { cx: number; cy: number }>();
    const spriteOverrides = new Map<string, WmlFrame>();
    const hpOverrides = new Map<string, number>();
    const popups: CombatPopup[] = [];
    const effects: EffectSprite[] = [];

    // HP: 開始時は戦闘前の値から、経過した打撃を順に累積反映する。
    // targetHpAfterは「その打撃で殴られた側」のHPしか持たないため、生命吸収(drain)による
    // 打撃側自身の回復は別途ここで加算しないと、殴った瞬間のHP回復が演出中は反映されない
    // (最終的な確定盤面には反映されるため、アニメが終わった瞬間だけ突然回復して見える)
    let attackerHp = input.attacker.hp;
    let defenderHp = input.defender.hp;
    for (let i = 0; i < input.strikes.length; i++) {
      if (t < impactTimeOf(i)) break; // これ以降の打撃はまだ発生していない
      const s = input.strikes[i];
      if (!s.hit) continue;
      if (s.actor === "attacker") {
        defenderHp = s.targetHpAfter;
        if (s.drained) attackerHp = Math.min(input.attacker.maxHp, attackerHp + s.drained);
      } else {
        attackerHp = s.targetHpAfter;
        if (s.drained) defenderHp = Math.min(input.defender.maxHp, defenderHp + s.drained);
      }
    }
    hpOverrides.set(input.attacker.id, attackerHp);
    hpOverrides.set(input.defender.id, defenderHp);

    // 現在の打撃: 踏み込み・攻撃フレーム・飛び道具・被弾リアクション
    if (t < played.length * STRIKE_WINDOW_MS) {
      const i = Math.min(played.length - 1, Math.floor(t / STRIKE_WINDOW_MS));
      const s = played[i];
      const ts = t - (i * STRIKE_WINDOW_MS + IMPACT_AT_MS); // 打撃基準時刻
      const actor = s.actor === "attacker" ? input.attacker : input.defender;
      const target = targetOf(s);
      const actorAttackId =
        s.actor === "attacker" ? input.attackerAttackId : input.defenderAttackId;
      const attackDef = actorAttackId
        ? deps.spriteOf(actor.unitDefId)?.attacks?.[actorAttackId]
        : undefined;
      const f = attackLungeAt(attackDef, ts);
      const a = deps.hexCenter(actor.pos);
      const b = deps.hexCenter(target.pos);
      const actorPos = {
        cx: a.cx + (b.cx - a.cx) * f,
        cy: a.cy + (b.cy - a.cy) * f,
      };
      positions.set(actor.id, actorPos);
      if (attackDef) {
        const frame = attackFrameAt(attackDef, ts);
        if (frame) spriteOverrides.set(actor.id, frame);
        // 進行方向の回転角。回転する弾は「上向き(北)」基準で描かれている前提。
        // 進行方向(0°=右・時計回り)に90°足すことで「上向き」基準の回転角になる
        const pathAngle = (Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180) / Math.PI + 90;
        // 飛び道具: missile.startTime+durationで命中(t=0)に到達する。
        // offset/offsetYカーブがあれば曲線軌道(魔法弾の引き込み→放出)、なければ直線移動
        if (attackDef.missile) {
          const m = missileStateAt(attackDef.missile, ts);
          if (m) {
            effects.push({
              key: `${actor.id}:missile`,
              cx: a.cx + (b.cx - a.cx) * m.progress,
              cy: a.cy + (b.cy - a.cy) * m.progress,
              // heightPxはWesnothの72pxヘックス基準px = 盤面座標(2S=72px)と1:1。
              // 弧の高さなのでスクリーン空間(dy)で渡す(反転視点でも上は上のまま)
              dy: m.heightPx,
              angleDeg: m.rotates ? pathAngle : 0,
              image: m.image,
              sizePx: m.size,
            });
          }
        }
        // 追加トラック(詠唱halo・杖先フレア・多層の弾など)
        attackTrackStatesAt(attackDef, ts).forEach((s, idx) => {
          const base =
            s.anchor === "unit"
              ? actorPos // ランジ中のユニット表示位置に追従する
              : {
                  cx: a.cx + (b.cx - a.cx) * s.progress,
                  cy: a.cy + (b.cy - a.cy) * s.progress,
                };
          effects.push({
            key: `${actor.id}:track${idx}`,
            cx: base.cx + s.xPx, // 横オフセットは焼き込み(反転時にミラーされるのが正しい)
            cy: base.cy,
            dy: s.yPx, // 縦オフセットはスクリーン空間(反転視点でも上は上のまま)
            angleDeg: s.rotates ? pathAngle : 0,
            image: s.image,
            sizePx: s.size,
          });
        });
      }
      if (s.hit && ts >= 0 && ts <= REACTION_MS) {
        const defendDef = deps.spriteOf(target.unitDefId)?.defend;
        if (defendDef) {
          spriteOverrides.set(target.id, {
            image: defendDef.reaction,
            duration: REACTION_MS,
          });
        }
      }
    }

    // ダメージ数字: 打撃ごとに浮き上がって消える
    played.forEach((s, i) => {
      const impact = impactTimeOf(i);
      if (t >= impact && t < impact + POPUP_MS) {
        const p = (t - impact) / POPUP_MS;
        const c = deps.hexCenter(targetOf(s).pos);
        popups.push({
          key: `${input.attacker.id}:${i}`,
          cx: c.cx,
          cy: c.cy,
          dy: 32 + p * 22,
          text: s.hit ? `-${s.damage}` : "回避",
          color: s.hit ? "#ff6b6b" : "#9aa4b0",
          alpha: 1 - p,
        });
        // 生命吸収: 殴った側自身のヘックスに回復量も表示する(付けないとダメージ数字しか
        // 見えず、回復していないように見えてしまう)
        if (s.hit && s.drained) {
          const actorPos = (s.actor === "attacker" ? input.attacker : input.defender).pos;
          const ac = deps.hexCenter(actorPos);
          popups.push({
            key: `${input.attacker.id}:${i}:drain`,
            cx: ac.cx,
            cy: ac.cy,
            dy: 32 + p * 22,
            text: `+${s.drained}`,
            color: "#8ee08e",
            alpha: 1 - p,
          });
        }
      }
    });

    return {
      positions,
      spriteOverrides,
      hpOverrides,
      flipOverrides,
      ghosts: input.ghosts,
      popups,
      effects,
    };
  };

  return { totalMs: total, sceneAt };
}
