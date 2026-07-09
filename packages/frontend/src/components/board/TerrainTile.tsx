"use client";

// 地形タイル本体。色polygonは常に描画する(クリック判定の実体と、
// スプライトの隙間/未取得時のフォールバック表示を兼ねる)。スプライトは
// pointerEvents="none"でその上に重ねるだけ(ユニットスプライトと同じ「画像は
// クリックを素通しし、下の要素が判定する」設計。画像だけにして色polygonを消すと、
// そのヘックスにクリックを受け止める要素が無くなり移動先選択が効かなくなる)。
// フックをこのコンポーネント単位で呼ぶことでRules of Hooksを満たす(親の.mapの中では呼ばない)。
// HexGrid・CutInStage等の全レンダラー共通の部品。
// HexGrid肥大化の分割(2026-07-08リファクタ)で components/HexGrid.tsx から移設
import { useImagesReady, useTerrainSprite } from "@/lib/sprites";
import { S, hexPointsAt, round2 } from "@/lib/board/geometry";
import { TERRAIN_COLORS } from "@/lib/board/colors";
import { variantIndex } from "@/lib/board/objects";

export function TerrainTile({
  cx,
  cy,
  terrainId,
  hexX,
  hexY,
  transitions,
  groundOverride,
  viewFlipped,
}: {
  cx: number;
  cy: number;
  terrainId: string;
  // バリアントレイヤーの決定的選択に使うヘックス論理座標
  hexX: number;
  hexY: number;
  // 地形遷移くさび(SVGのrotate角+素材。隣が異地形の辺だけ。素材は隣接地形別に
  // 差し替わることがある — edgeTransition.byNeighbor)
  transitions?: readonly { angle: number; src: string }[];
  // 地面レイヤーの上書き(/dev/terrain の検収プレビュー専用)。候補タイルを
  // 盤面全体に敷き詰めて継ぎ目・リピート感を見るために使う
  groundOverride?: readonly (string | readonly string[])[];
  // ビュー反転(180度回転)。盤面は紙の地図を180度回すのと同じ剛体回転なので、
  // ヘックスの位置(呼び出し側でviewCenter経由)だけでなく地面の絵自体も自分の中心で
  // 180度回す必要がある(丘のNE端/SW端のような向きを持つ絵が反転時に据え置きになる
  // バグの修正。2026-07-08)。ユニット等のビルボードは常に正立させたいので別扱い(mirror)
  viewFlipped?: boolean;
}) {
  const registryLayers = useTerrainSprite(terrainId);
  const overrideReady = useImagesReady(
    (groundOverride ?? []).flatMap((l) => (typeof l === "string" ? [l] : l)),
  );
  const spriteLayers =
    groundOverride?.length && overrideReady ? groundOverride : registryLayers;
  return (
    <>
      <polygon
        points={hexPointsAt({ cx, cy })}
        fill={TERRAIN_COLORS[terrainId] ?? "#444"}
        stroke="#10141a"
        strokeWidth={1.5}
      />
      {spriteLayers?.map((layer, i) => {
        // バリアントレイヤーは座標ハッシュで1枚選ぶ(saltはobjects系と衝突しない100番台)
        const src =
          typeof layer === "string"
            ? layer
            : layer[variantIndex(hexX, hexY, 100 + i, layer.length)];
        return (
          <image
            key={i}
            href={src}
            x={cx - S}
            y={cy - S}
            width={S * 2}
            height={S * 2}
            transform={viewFlipped ? `rotate(180 ${round2(cx)} ${round2(cy)})` : undefined}
            style={{ imageRendering: "pixelated" }}
            pointerEvents="none"
          />
        );
      })}
      {/* 地形遷移くさび: 隣が異地形の辺にだけ重ねる(くさびの素材は上辺向きが正準。
          六角形は60度回転で不変なのでSVGのrotateだけで全方向を賄う) */}
      {spriteLayers &&
        transitions?.map((t, i) => (
          <image
            key={`tr${i}`}
            href={t.src}
            x={cx - S}
            y={cy - S}
            width={S * 2}
            height={S * 2}
            transform={`rotate(${round2(t.angle)} ${round2(cx)} ${round2(cy)})`}
            style={{ imageRendering: "pixelated" }}
            pointerEvents="none"
          />
        ))}
    </>
  );
}
