"use client";

// 地形タイル本体。色polygonは常に描画する(クリック判定の実体と、
// スプライトの隙間/未取得時のフォールバック表示を兼ねる)。スプライトは
// pointerEvents="none"でその上に重ねるだけ(ユニットスプライトと同じ「画像は
// クリックを素通しし、下の要素が判定する」設計。画像だけにして色polygonを消すと、
// そのヘックスにクリックを受け止める要素が無くなり移動先選択が効かなくなる)。
// フックをこのコンポーネント単位で呼ぶことでRules of Hooksを満たす(親の.mapの中では呼ばない)。
// HexGrid・CutInStage等の全レンダラー共通の部品。
// HexGrid肥大化の分割(2026-07-08リファクタ)で components/HexGrid.tsx から移設
import { resolveAssetUrl, useImagesReady, useTerrainSprite } from "@/lib/sprites";
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
        // 2026-07-09: imageRendering:pixelatedを外した。地形の*-tile.pngは
        // (本家エディタのパレットアイコン流用のため)ヘックス縁がアンチエイリアス無しの
        // ハードエッジで、pixelated(ニアレストネイバー)だと非整数倍率ズームで
        // 縁がギザギザに拡大されてしまう(ユーザー報告・目視確認済み)。
        // 通常のブラウザ既定(bilinear相当)でヘックス縁を滑らかにする
        //
        // 2026-07-10 追記(未解決): 地形アセットを本家の正しい戦闘用画像に差し替えたが
        // (castle=flat/road.png, keep=castle/cobbles-keep.png 等)、これらも元の
        // *-tile.pngと同じ「ヘックス形にアンチエイリアス無しでくり抜かれたハードエッジ
        // マスク」だったため、ジャギー自体は解消していない(ユーザー確認: 2026-07-10)。
        // 本家がこの手のハードエッジを画面に晒さずに済んでいるのは、異なる地形が
        // 隣接する境界を「6方向×convex/concave」の専用トランジション画像で覆っているため
        // (このハードエッジ自体を直接見せる場面が本家にはそもそも無い)。
        // mini-wesgameはこのトランジション機構を実装しておらず(edgeTransition型は
        // あるがTERRAIN_SPRITESのどのエントリにも未設定)、ジャギーの根本解消には
        // 本家同様の境界トランジション画像の実装が必要(規模が大きいため未着手)。
        // バリアントレイヤーは座標ハッシュで1枚選ぶ(saltはobjects系と衝突しない100番台)
        const src =
          typeof layer === "string"
            ? layer
            : layer[variantIndex(hexX, hexY, 100 + i, layer.length)];
        return (
          <image
            key={i}
            href={resolveAssetUrl(src)}
            x={cx - S}
            y={cy - S}
            width={S * 2}
            height={S * 2}
            pointerEvents="none"
          />
        );
      })}
      {/* 地形遷移くさび: 隣が異地形の辺にだけ重ねる(くさびの素材は上辺向きが正準。
          六角形は60度回転で不変なのでSVGのrotateだけで全方向を賄う)。
          2026-07-10: ここもimageRendering:pixelatedを外した。ニアレストネイバーのまま
          回転させると軸に整列しない角度で必ず階段状のジャギーが出るため
          (ベース地形と同じ理由。本家は回転を使わず6方向個別ファイルで対応している) */}
      {spriteLayers &&
        transitions?.map((t, i) => (
          <image
            key={`tr${i}`}
            href={resolveAssetUrl(t.src)}
            x={cx - S}
            y={cy - S}
            width={S * 2}
            height={S * 2}
            transform={`rotate(${round2(t.angle)} ${round2(cx)} ${round2(cy)})`}
            pointerEvents="none"
          />
        ))}
    </>
  );
}
