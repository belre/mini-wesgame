"use client";

// 地形立体物のビルボード(ジオラマPhase B)。木・岩・家屋等をユニットと同じ
// 深度ソートに参加させて描く。バリアントはヘックス座標から決定的に選択。
// 不透明度の規則(可読性フェード)は lib/board/objects.ts の
// objectOpacity() が正(単体テストあり)。
// HexGrid肥大化の分割(2026-07-08リファクタ)で components/HexGrid.tsx から移設
import { imageNaturalSize, useImagesReady, type TerrainObjectDef } from "@/lib/sprites";
import { S } from "@/lib/board/geometry";
import {
  OBJECT_BASELINE_RATIO,
  hashUnit,
  objectOpacity,
  variantIndex,
} from "@/lib/board/objects";

export function TerrainObjectBillboard({
  obj,
  oi,
  hexX,
  hexY,
  hexOccupied,
  ownerIndex,
}: {
  obj: TerrainObjectDef;
  oi: number; // 定義内のエントリ番号(バリアント選択のsalt)
  hexX: number;
  hexY: number;
  hexOccupied: boolean;
  // ownerVariant用: このヘックスの帰属プレイヤー(keepの走査順割当)。呼び出し側が解決する
  ownerIndex?: number;
}) {
  const ready = useImagesReady(obj.srcs);
  if (!ready) return null;
  const src =
    obj.ownerVariant && ownerIndex !== undefined && ownerIndex < obj.srcs.length
      ? obj.srcs[ownerIndex]
      : obj.srcs[variantIndex(hexX, hexY, oi, obj.srcs.length)];
  // 原寸が確定するまで描かない(フォールバック寸法で描くと、後の再描画で
  // 突然原寸に「成長」して見える)。ready後は通常すぐ確定している
  const sz = imageNaturalSize(src);
  if (!sz) return null;
  // mirror: ヘックス座標ハッシュで左右反転(x=-w/2の中心配置なのでscaleだけで済む)
  const flip = obj.mirror && hashUnit(hexX, hexY, oi * 7 + 3) > 0;
  return (
    <image
      href={src}
      x={-sz.w / 2}
      y={S * OBJECT_BASELINE_RATIO - sz.h}
      width={sz.w}
      height={sz.h}
      transform={flip ? "scale(-1 1)" : undefined}
      opacity={objectOpacity(obj, { hexOccupied })}
      style={{ imageRendering: "pixelated" }}
      pointerEvents="none"
    />
  );
}
