"use client";

// ユニット本体の描画部品。スプライト定義(lib/sprites.ts)があればアニメーション画像、
// なければ従来の円+頭文字。アニメのフレーム更新はこのコンポーネント単位で完結する
// (盤面全体は再レンダーされない)。アセット未取得の環境も自動で円にフォールバックする。
// HexGrid・CutInStage(カットイン)等、全レンダラー共通の部品。
// HexGrid肥大化の分割(2026-07-08リファクタ)で components/HexGrid.tsx から移設
import {
  imageNaturalSize,
  resolveAssetUrl,
  teamColoredSrc,
  useStandingOverlays,
  useUnitSprite,
  type WmlFrame,
} from "@/lib/sprites";
import { S } from "@/lib/board/geometry";
import { OWNER_COLORS } from "@/lib/board/colors";

// ユニットの足元影(ジオラマPhase A)。濃淡2枚の楕円で疑似的な柔らかい縁を作る
// (SVG filterのぼかしはid管理とレンダラー間の可搬性が面倒なため使わない)。
// チームカラー楕円・フォールバック円の下に敷き、接地感を出す
function FootShadow({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={cx} cy={cy + S * 0.44} rx={S * 0.72} ry={S * 0.26} fill="#000" opacity={0.16} />
      <ellipse cx={cx} cy={cy + S * 0.44} rx={S * 0.56} ry={S * 0.19} fill="#000" opacity={0.3} />
    </g>
  );
}

// 行動状態リング(2026-07-08): 頭上オーブではなく、チームカラー楕円と同じ足元の
// 「接地面」に統合する(GPT提案の「オーブより画面が汚れない」案を採用)。
// acted=falseは破線が回転して「行動可能」、acted=trueは実線で静止して「行動済み」
// (既存のopacity暗転と併用。二重の信号にすることでリングの回転に気付きにくくても判別できる)。
// acted=undefinedは自分のターン中の自軍ユニットではない(表示しない)。
// slowed=trueなら振動を重ねつつ色を専用色(遅化の🐌バッジと同じ紫系#c9a6e0)に切り替える
// (行動可能/済みの金・白より遅化を優先して見せる。2026-07-08)。回転(ellipse自身)と
// 振動(親<g>)は別要素のtransformにして重ねる — 同じ要素のtransformにrotateとtranslateを
// 両方CSSアニメで乗せると片方が上書きしてしまうため
// exportは/dev/spritesの検収用(SpriteAnimDemo.tsx)。本番はUnitBody内部でのみ使う
export function TurnRing({
  cx,
  cy,
  acted,
  slowed,
}: {
  cx: number;
  cy: number;
  acted: boolean;
  slowed?: boolean;
}) {
  const stroke = slowed ? "#c9a6e0" : acted ? "rgba(255,255,255,0.4)" : "#ffd75e";
  return (
    <g transform={`translate(${cx} ${cy})`} pointerEvents="none">
      <g className={slowed ? "turn-ring-shake" : undefined}>
        <ellipse
          className={acted ? "turn-ring" : "turn-ring turn-ring--ready"}
          rx={S * 0.56}
          ry={S * 0.18}
          fill="none"
          stroke={stroke}
          strokeWidth={acted ? 2 : 2.5}
          strokeDasharray={acted ? undefined : "9 7"}
        />
      </g>
    </g>
  );
}

// 岩場に乗ったユニット(=飛行のみ。岩場は地上侵入不可)の浮き上がり量。
// 「岩塊の上にとまっている」演出で、地形の高さを駒の位置が語る。
// 描画のみのオフセット: クリック判定は透明ヒット平面とスプライト自身のonClickが
// 受け持つため、浮かせても押し間違いは増えない(2026-07-08 検討)。
// 足元影は地面側に残す(浮いた本体と地上の影の分離が「高さ」の視覚根拠になる)
export const MOUNTAIN_UNIT_LIFT = S * 0.22;

export function UnitBody({
  cx,
  cy,
  spriteKey,
  owner,
  selected,
  nameChar,
  override,
  flipped,
  lift = 0,
  acted,
  poisoned,
  slowed,
}: {
  cx: number;
  cy: number;
  spriteKey: string;
  owner: number;
  selected: boolean;
  nameChar: string;
  override?: WmlFrame | null; // 戦闘演出中のフレーム上書き(攻撃・被弾リアクション)
  // 左右反転。スプライトは南東(右)向きで描かれているため、後攻(owner=1)のユニットは
  // 常に反転して左向きにする(両軍が向き合う構図)。画像のみ反転し、HPバー等は反転しない
  flipped?: boolean;
  // 本体が浮き上がっている量(岩場の上の飛行ユニット等)。足元影だけ地面(cy+lift)に残す
  lift?: number;
  // 行動状態リング(自分のターン中の自軍ユニットだけ渡す。undefinedなら非表示)。
  // false=行動可能(回転) / true=行動済み(静止)
  acted?: boolean;
  // 毒: スプライト全体を緑系に色調補正する(本家Wesnothの毒表示に準拠。2026-07-08)
  poisoned?: boolean;
  // 遅化: 行動状態リングを振動させる(2026-07-08)
  slowed?: boolean;
}) {
  const spriteSrc = useUnitSprite(spriteKey, owner);
  const overlaySrcs = useStandingOverlays(spriteKey);
  // チームカラー置換済みなら差し替え(未生成・置換領域なしは原色のまま)
  const tc = (s: string) => teamColoredSrc(s, owner) ?? resolveAssetUrl(s);
  if (!spriteSrc) {
    return (
      <>
        <FootShadow cx={cx} cy={cy + lift} />
        {acted !== undefined && (
          <TurnRing cx={cx} cy={cy + S * 0.42} acted={acted} slowed={slowed} />
        )}
        <circle
          className={poisoned ? "status-poison-tint" : undefined}
          cx={cx}
          cy={cy}
          r={S * 0.52}
          fill={OWNER_COLORS[owner]}
          stroke={selected ? "#2E419B" : "#10141a"}
          strokeWidth={selected ? 3 : 1.5}
        />
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fontSize={S * 0.5}
          fill="#fff"
          pointerEvents="none"
        >
          {nameChar}
        </text>
      </>
    );
  }
  return (
    <>
      <FootShadow cx={cx} cy={cy + lift} />
      {acted !== undefined && (
        <TurnRing cx={cx} cy={cy + S * 0.42} acted={acted} slowed={slowed} />
      )}
      {/* チームカラーの下敷き(所属の識別。Wesnothの足元ellipseに相当) */}
      <ellipse
        cx={cx}
        cy={cy + S * 0.42}
        rx={S * 0.5}
        ry={S * 0.16}
        fill={OWNER_COLORS[owner]}
        opacity={0.85}
        stroke="#10141a"
        strokeWidth={1}
      />
      {/* タップ判定の実体。スプライト<image>は透明余白まで矩形で判定を奪うため
          pointerEvents="none"にしてあり、そのままだと足元ellipse以外のタップが
          背後の地形ヘックス(傾け時は上のヘックス)へ抜けてしまう。
          体の中心を覆う不可視円で親<g>のonClick(=このユニットのヘックス選択)を受ける */}
      <circle cx={cx} cy={cy} r={S * 0.55} fill="none" pointerEvents="all" />
      {selected && (
        <circle cx={cx} cy={cy} r={S * 0.58} fill="none" stroke="#2E419B" strokeWidth={3} />
      )}
      {/* Wesnothのユニット画像は基本72×72 = ヘックス幅(2S)。攻撃ではみ出す絵は
          キャンバスが大きい(重歩兵168x104等)ため、原寸(1px=1盤面単位)で中心描画する。
          72固定に縮めるとユニットが小さく見えるバグになる */}
      {(() => {
        const src = tc(override?.image ?? spriteSrc);
        const sz = imageNaturalSize(src);
        const w = sz?.w ?? S * 2;
        const h = sz?.h ?? S * 2;
        return (
          <image
            className={poisoned ? "status-poison-tint" : undefined}
            href={src}
            x={cx - w / 2}
            y={cy - h / 2}
            width={w}
            height={h}
            transform={flipped ? `translate(${2 * cx},0) scale(-1,1)` : undefined}
            style={{ imageRendering: "pixelated" }}
            pointerEvents="none"
          />
        );
      })()}
      {/* standingの多層レイヤー(松明の炎など)。戦闘フレーム上書き中は本体側の
          絵に演出が含まれるため重ねない */}
      {!override &&
        overlaySrcs.map((raw, i) => {
          const src = tc(raw);
          const sz = imageNaturalSize(src);
          const w = sz?.w ?? S * 2;
          const h = sz?.h ?? S * 2;
          return (
            <image
              key={`ov${i}`}
              className={poisoned ? "status-poison-tint" : undefined}
              href={src}
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              transform={flipped ? `translate(${2 * cx},0) scale(-1,1)` : undefined}
              style={{ imageRendering: "pixelated" }}
              pointerEvents="none"
            />
          );
        })}
      {/* ~BLIT(...)相当: 攻撃エフェクト等を同位置に重ね描き */}
      {override?.overlay && (() => {
        const src = tc(override.overlay);
        const sz = imageNaturalSize(src);
        const w = sz?.w ?? S * 2;
        const h = sz?.h ?? S * 2;
        return (
          <image
            href={src}
            x={cx - w / 2}
            y={cy - h / 2}
            width={w}
            height={h}
            transform={flipped ? `translate(${2 * cx},0) scale(-1,1)` : undefined}
            style={{ imageRendering: "pixelated" }}
            pointerEvents="none"
          />
        );
      })()}
    </>
  );
}
