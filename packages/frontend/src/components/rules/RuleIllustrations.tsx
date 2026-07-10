"use client";

// RulesPanelの各タブのピクトグラム(2026-07-10)。自作SVG・画像アセット不要。
// 盤面の実ヘックス幾何(lib/board/geometry.ts の HEX_CORNERS)と同じ比率の
// flat-topヘックスを使い、盤面の絵と見た目のトーンを合わせる。
const SQRT3 = Math.sqrt(3);
// flat-topヘックスの頂点(単位円)。geometry.tsのHEX_CORNERSと同じ並び
const HEX_CORNERS: [number, number][] = [
  [1, 0],
  [0.5, SQRT3 / 2],
  [-0.5, SQRT3 / 2],
  [-1, 0],
  [-0.5, -SQRT3 / 2],
  [0.5, -SQRT3 / 2],
];

function hexPoints(cx: number, cy: number, s: number): string {
  return HEX_CORNERS.map(([dx, dy]) => `${cx + s * dx},${cy + s * dy}`).join(" ");
}

// 隣接ヘックス中心への6方向(geometry.tsのhexCenterの敷き詰め方と同じ比率:
// 横1.5s・縦√3s/2)。頂点方向(HEX_CORNERS)とは別物なので混同しないこと
const HEX_NEIGHBOR_DIRS: [number, number][] = [
  [0, -SQRT3],
  [1.5, -SQRT3 / 2],
  [1.5, SQRT3 / 2],
  [0, SQRT3],
  [-1.5, SQRT3 / 2],
  [-1.5, -SQRT3 / 2],
];

// 3つの山を持つ簡易クラウン(指揮官の象徴)。原点中心、幅約20・高さ約12
const CROWN_POINTS =
  "-9,5 -9,-1 -6,-6 -3,-1 0,-6 3,-1 6,-6 9,-1 9,5";

function Crown({ x, y, scale = 1, fill = "#fff" }: { x: number; y: number; scale?: number; fill?: string }) {
  return (
    <polygon
      points={CROWN_POINTS}
      fill={fill}
      stroke="#10141a"
      strokeWidth={1}
      strokeLinejoin="round"
      transform={`translate(${x} ${y}) scale(${scale})`}
    />
  );
}

const ILLUSTRATION_VIEWBOX = "0 0 220 130";
const ILLUSTRATION_HEIGHT = 150;

export function GoalIllustration() {
  return (
    <svg viewBox={ILLUSTRATION_VIEWBOX} width="100%" height={ILLUSTRATION_HEIGHT} role="img" aria-label="Defeat the enemy commander">
      <polygon points={hexPoints(58, 55, 30)} fill="#2e419b" stroke="#10141a" />
      <polygon points={hexPoints(162, 55, 30)} fill="#8c2a2a" stroke="#10141a" />
      <Crown x={58} y={55} scale={1.15} />
      <Crown x={162} y={55} scale={1.15} />
      {/* 撃破対象の合図: 赤い照準リング */}
      <circle cx={162} cy={55} r={19} fill="none" stroke="#ffd75e" strokeWidth={2.5} />
      <line x1={162} y1={30} x2={162} y2={38} stroke="#ffd75e" strokeWidth={2.5} />
      <line x1={162} y1={72} x2={162} y2={80} stroke="#ffd75e" strokeWidth={2.5} />
      <line x1={137} y1={55} x2={145} y2={55} stroke="#ffd75e" strokeWidth={2.5} />
      <line x1={179} y1={55} x2={187} y2={55} stroke="#ffd75e" strokeWidth={2.5} />
      <text x={58} y={115} textAnchor="middle" fontSize={11} fill="#9aa5b5">Your commander</text>
      <text x={162} y={115} textAnchor="middle" fontSize={11} fill="#9aa5b5">Defeat this</text>
    </svg>
  );
}

export function MovementIllustration() {
  // ZOC: 敵(赤)の周囲6ヘックスが色付き=進入した時点で移動終了。
  // 自軍(青)がZOCへ入って止まる矢印を添える。
  // 60度刻みの隣接方向はHEX_CORNERSと同じ定数を使う(生のcos/sinは使わない。
  // board-renderingスキルの規約と揃える。静的マークアップなのでSSR不一致は
  // 起きないが、可読性のためにも同じ書き方に統一する)
  const cx = 150, cy = 55, s = 24;
  return (
    <svg viewBox={ILLUSTRATION_VIEWBOX} width="100%" height={ILLUSTRATION_HEIGHT} role="img" aria-label="Zone of control">
      {HEX_NEIGHBOR_DIRS.map(([dx, dy], i) => {
        const nx = cx + s * dx;
        const ny = cy + s * dy;
        return (
          <polygon
            key={i}
            points={hexPoints(nx, ny, s)}
            fill="rgba(224,82,82,0.25)"
            stroke="#e05252"
            strokeDasharray="3 2"
          />
        );
      })}
      <polygon points={hexPoints(cx, cy, s)} fill="#8c2a2a" stroke="#10141a" />
      <circle cx={cx} cy={cy} r={6} fill="#ffd75e" />
      {/* 自軍ユニット(左端)から進入・停止 */}
      <circle cx={30} cy={55} r={8} fill="#2e419b" stroke="#10141a" strokeWidth={1.5} />
      <line x1={40} y1={55} x2={78} y2={55} stroke="#dfe6ee" strokeWidth={2} markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#dfe6ee" />
        </marker>
      </defs>
      <text x={30} y={90} textAnchor="middle" fontSize={11} fill="#9aa5b5">You</text>
      <text x={150} y={115} textAnchor="middle" fontSize={11} fill="#9aa5b5">Zone of Control</text>
    </svg>
  );
}

export function CombatIllustration() {
  return (
    <svg viewBox={ILLUSTRATION_VIEWBOX} width="100%" height={ILLUSTRATION_HEIGHT} role="img" aria-label="Combat">
      <polygon points={hexPoints(55, 50, 28)} fill="#2e419b" stroke="#10141a" />
      {/* 防御側は森(暗めの緑)= 防御ボーナス地形 */}
      <polygon points={hexPoints(165, 50, 28)} fill="#2f5233" stroke="#10141a" />
      <circle cx={55} cy={50} r={9} fill="#dfe6ee" stroke="#10141a" strokeWidth={1.5} />
      <circle cx={165} cy={50} r={9} fill="#e05252" stroke="#10141a" strokeWidth={1.5} />
      {/* 交戦の稲妻アイコン */}
      <polygon points="103,42 112,42 106,54 115,54 98,70 103,56 95,56" fill="#ffd75e" stroke="#10141a" strokeWidth={1} />
      <text x={165} y={30} textAnchor="middle" fontSize={11} fill="#dfe6ee">60% def</text>
      <text x={55} y={115} textAnchor="middle" fontSize={11} fill="#9aa5b5">Attacker</text>
      <text x={165} y={115} textAnchor="middle" fontSize={11} fill="#9aa5b5">Defender (forest)</text>
      {/* 昼夜補正 */}
      <circle cx={30} cy={20} r={7} fill="#ffd75e" />
      <text x={44} y={24} fontSize={10} fill="#9aa5b5">+dmg by day</text>
    </svg>
  );
}

export function RecruitingIllustration() {
  return (
    <svg viewBox={ILLUSTRATION_VIEWBOX} width="100%" height={ILLUSTRATION_HEIGHT} role="img" aria-label="Recruiting">
      <polygon points={hexPoints(60, 55, 30)} fill="#5a4a2f" stroke="#10141a" />
      {/* 主城(keep)の簡易アイコン: 塔+旗 */}
      <rect x={46} y={44} width={28} height={20} fill="#8a94a3" stroke="#10141a" />
      <rect x={50} y={38} width={5} height={8} fill="#8a94a3" stroke="#10141a" />
      <rect x={61} y={38} width={5} height={8} fill="#8a94a3" stroke="#10141a" />
      <line x1={60} y1={38} x2={60} y2={28} stroke="#dfe6ee" strokeWidth={2} />
      <polygon points="60,28 72,32 60,36" fill="#4f8cff" />
      {/* 新規ユニット出現 */}
      <circle cx={140} cy={55} r={9} fill="#2e419b" stroke="#10141a" strokeWidth={1.5} />
      <text x={140} y={30} textAnchor="middle" fontSize={11} fill="#dfe6ee">next turn</text>
      <line x1={92} y1={55} x2={122} y2={55} stroke="#dfe6ee" strokeWidth={2} markerEnd="url(#arrow2)" />
      <defs>
        <marker id="arrow2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#dfe6ee" />
        </marker>
      </defs>
      {/* 収入(村+ゴールド) */}
      <circle cx={190} cy={40} r={10} fill="#e0b34f" stroke="#10141a" strokeWidth={1.5} />
      <text x={190} y={44} textAnchor="middle" fontSize={11} fill="#10141a" fontWeight="bold">$</text>
      <text x={190} y={70} textAnchor="middle" fontSize={11} fill="#9aa5b5">income</text>
      <text x={60} y={115} textAnchor="middle" fontSize={11} fill="#9aa5b5">Your keep</text>
    </svg>
  );
}
