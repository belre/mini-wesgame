// spriteKey → ユニットスプライト定義の統合表。
// content/index.ts から分離(2026-07-08): index.ts はジオラマ画像の静的import
// (dioramaImages.ts)を含むため、tsx実行のNodeスクリプト(build-sprite-packs)からは
// import できない。スクリプトが必要とするのはユニット定義だけなので、png import を
// 含まないこのモジュールを直接参照する
import type { UnitSpriteDef } from "../anim/model";
// mini版: 人間族(loyalists)とオーク(northerners)のみ。他陣営の定義は本家に残っている
import { SPRITES as LOYALIST_SPRITES } from "./loyalists";
import { SPRITES as NORTHERNER_SPRITES } from "./northerners";

export const UNIT_SPRITES: Record<string, UnitSpriteDef> = {
  ...LOYALIST_SPRITES,
  ...NORTHERNER_SPRITES,
};
