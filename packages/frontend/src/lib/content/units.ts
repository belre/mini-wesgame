// spriteKey → ユニットスプライト定義の統合表。
// content/index.ts から分離(2026-07-08): index.ts はジオラマ画像の静的import
// (dioramaImages.ts)を含むため、tsx実行のNodeスクリプト(fetch-demo-sprites →
// generate-unit-base-images / build-sprite-packs)からは import できない。
// スクリプトが必要とするのはユニット定義だけなので、png import を含まない
// このモジュールを直接参照する
import type { UnitSpriteDef } from "../anim/model";
import { SPRITES as LOYALIST_SPRITES } from "./loyalists";
import { SPRITES as DRAKE_SPRITES } from "./drakes";
import { SPRITES as NORTHERNER_SPRITES } from "./northerners";
import { SPRITES as REBEL_SPRITES } from "./rebels";
import { SPRITES as UNDEAD_SPRITES } from "./undead";

export const UNIT_SPRITES: Record<string, UnitSpriteDef> = {
  ...LOYALIST_SPRITES,
  ...DRAKE_SPRITES,
  ...NORTHERNER_SPRITES,
  ...REBEL_SPRITES,
  ...UNDEAD_SPRITES,
};
