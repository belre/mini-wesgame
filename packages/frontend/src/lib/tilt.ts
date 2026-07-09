// 盤面の傾き(3D風)表示の投影計算。/dev/sprites で検証したモデルの共有版。
//
// 方式: 地形(polygon)はCSSの3D transform(perspective+rotateX、さらに平面rotate)だけで
// 傾け、hex.ts相当の座標計算は一切変えない。スプライト・文字まで一緒に傾けると見た目が
// 崩れる(画像が斜めに歪む・文字が読みづらい)ため、ユニット/文字は「地形と同じCSS変換を
// JS側で再現し、位置だけ投影先へ動かして向きは傾けない」(ビルボード)方式にする。
// CSSのperspective+rotateXの投影式をJS側でも再現しているので、見た目にズレが出たら
// 定数(TILT_DEG/PERSPECTIVE_PX)がCSS側(TiltStage)と一致しているか確認すること
export const TILT_DEG = 55;
export const TILT_RAD = (TILT_DEG * Math.PI) / 180;
export const PERSPECTIVE_PX = 1000;
export const TILT_TRANSFORM = `rotateX(${TILT_DEG}deg)`;

// 本番採用値(/dev/sprites のスライダーで調整して決定。2026-07-06):
// - 右斜め方向の平面回転: 10deg(当初15degだったが、プレイ評価で「少し強すぎる」となり緩和)
// - 足元の食い込み: -0.45×S(スプライトの足をヘックス境界に馴染ませる)
// - 上下位置の補正: 0px(補正なし)
export const BOARD_DIAGONAL_DEG = 10;

// ビュー変換: 「自陣を背にして戦場を見る」構図にするため、視点の陣営によって
// 盤面全体を180度回転(盤面中心の点対称)して描画する。論理座標(hex.ts)は不変で、
// 変換はHexGridの描画境界にだけ適用される(クリックは論理座標のまま)。
// 現行マップはkeep走査順=プレイヤー順でP0の陣地が盤面上側に来るため、
// P0(青)視点で反転する(反転により自陣が手前=カメラ側に来る)
export function boardViewFlippedFor(viewerIndex: number): boolean {
  return viewerIndex === 0;
}
export const BOARD_FOOT_OFFSET_RATIO = -0.45;
export const BOARD_TILT_Y_OFFSET_PX = 0;

// tilted=falseならそのまま返す(scale=1)。trueならCSSのrotateX+perspective、続けて
// 2D回転(diagonalDeg)と同じ投影を計算し、「transformOrigin: center center」を基準にした
// 投影後の座標を返す(向きの回転は含まない。スプライト自体は常に正立のまま位置だけ動かすため)。
// scaleはrotateX+perspectiveによる遠近の拡大率(奥ほど1未満)。スプライトのサイズや
// footOffsetを奥行きに応じて調整する際に使う
// SSR対策の丸め: Math.cos/sinは正確な丸めが仕様で保証されず、Node(SSR)とブラウザで
// 最終桁がズレることがある(HexGridのHEX_CORNERSが定数を使うのと同じ問題)。
// 投影結果はtransform文字列としてSSRのHTMLに乗るため、サブピクセル精度
// (座標0.01px・scale 1e-5)に丸めて両者の文字列を一致させる。見た目には影響しない
const roundCoord = (v: number) => Math.round(v * 100) / 100;
const roundScale = (v: number) => Math.round(v * 100000) / 100000;

export function projectTilt(
  p: { cx: number; cy: number },
  origin: { cx: number; cy: number },
  tilted: boolean,
  diagonalDeg: number,
): { cx: number; cy: number; scale: number } {
  if (!tilted) return { ...p, scale: 1 };
  const dx = p.cx - origin.cx;
  const dy = p.cy - origin.cy;
  const rotatedY = dy * Math.cos(TILT_RAD);
  const z = dy * Math.sin(TILT_RAD);
  const scale = PERSPECTIVE_PX / (PERSPECTIVE_PX - z);
  const stepped = { cx: dx * scale, cy: rotatedY * scale };
  const diagRad = (diagonalDeg * Math.PI) / 180;
  return {
    cx: roundCoord(origin.cx + stepped.cx * Math.cos(diagRad) - stepped.cy * Math.sin(diagRad)),
    cy: roundCoord(origin.cy + stepped.cx * Math.sin(diagRad) + stepped.cy * Math.cos(diagRad)),
    scale: roundScale(scale),
  };
}

// 傾けると地形(hex)は縦方向に圧縮されて見えるが、スプライトは向きを保つため縮まない。
// そのため素の投影位置のままだと足元とヘックスの境界にズレが出る。offsetPx分だけ上下に
// ずらして、足元をヘックスの境界に馴染ませる。offsetPxもp.scale倍しておくことで、
// 奥のユニットほど食い込み量も比例して小さくなる
export function withFootOffset(
  p: { cx: number; cy: number; scale: number },
  tilted: boolean,
  offsetPx: number,
): { cx: number; cy: number; scale: number } {
  return tilted ? { ...p, cy: p.cy + offsetPx * p.scale } : p;
}
