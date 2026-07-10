// ユニットの組み込み1枚絵(フォールバック用)のURL解決。
// 2026-07-10リファクタ: 従来はGPLアセットをsrc/generated/へコピーし静的importで
// Next.jsバンドルに同梱していたが(CDN障害時もアプリ自身から配信できる設計)、
// terrain/ユニット個別フレームと足並みを揃えてASSET_BASE経由のCDN配信
// (wesnoth-contents-delivery。docs/asset_delivery.md参照)に統一した。
// ファイル名規則は旧scripts/generate-unit-base-images.mtsを踏襲:
// spriteKeyの"/"を"_"に置換 + ".png"(delivery repoのsprites/unit-base/配下と対応)
import { ASSET_BASE } from "./shared";
import { UNIT_SPRITES } from "./units";

export const UNIT_BASE_IMAGES: Record<string, string> = Object.fromEntries(
  Object.keys(UNIT_SPRITES).map((spriteKey) => [
    spriteKey,
    `${ASSET_BASE}/sprites/unit-base/${spriteKey.replaceAll("/", "_")}.png`,
  ]),
);
