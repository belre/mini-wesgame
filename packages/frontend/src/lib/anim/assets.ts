// アセットローディング層(ブラウザ依存・React非依存)。
// 画像のプリロードと原寸キャッシュを一元管理する。
import type { UnitSpriteDef } from "./model";

// 画像の原寸(naturalWidth/Height)キャッシュ。Wesnothのフレームは基本72x72だが、
// 攻撃ではみ出す絵(重歩兵のメイス168x104、剣士100x100等)はキャンバスが大きい。
// 72x72固定ボックスに収めると縮んで見えるため、プリロード時に原寸を記録し、
// 描画側(HexGrid/デモ)が1px=1盤面単位で原寸描画する
const imageSizeCache = new Map<string, { w: number; h: number }>();

export function imageNaturalSize(src: string): { w: number; h: number } | null {
  return imageSizeCache.get(src) ?? null;
}

// 生成画像(チームカラー置換後のobjectURL等)の原寸を登録する
export function recordImageSize(src: string, w: number, h: number): void {
  imageSizeCache.set(src, { w, h });
}

// スプライトパック(A-4: lib/assets/spritePacks.ts)が登録する「定義URL → blob URL」の
// 置換表。定義・キャッシュのキーは常に元のURLのままにし、実際のネットワーク/デコードだけ
// blob URLへ差し替える(パック無効時は恒等写像=従来動作)
const packedUrls = new Map<string, string>();

export function registerPackedAsset(src: string, objectUrl: string): void {
  packedUrls.set(src, objectUrl);
}

// 描画・ロードの直前でURLを解決する。定義に書かれたURLを引数にすること
// (blob URL化はここに閉じ込め、上位層は元URLだけを扱う)
export function resolveAssetUrl(src: string): string {
  return packedUrls.get(src) ?? src;
}

export function loadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // 原寸キャッシュのキーは元URL(呼び出し側は元URLで問い合わせるため)
      imageSizeCache.set(src, { w: img.naturalWidth, h: img.naturalHeight });
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = resolveAssetUrl(src);
  });
}

// スプライト定義が参照する画像URL。
// required: standing/idle(欠けたら円フォールバック) / optional: 攻撃系(欠けても表示続行)
export function spriteImageUrls(def: UnitSpriteDef): {
  required: string[];
  optional: string[];
} {
  return {
    required: [
      def.base,
      ...def.standing.map((f) => f.image),
      ...(def.idle ?? []).map((f) => f.image),
    ],
    optional: [
      ...(def.standingOverlays ?? []).flatMap((o) => o.frames.map((f) => f.image)),
      ...Object.values(def.attacks ?? {}).flatMap((a) => [
        ...a.frames.flatMap((f) => (f.overlay ? [f.image, f.overlay] : [f.image])),
        ...(a.missile?.image ? [a.missile.image] : []),
        ...(a.missile?.frames ?? []).map((f) => f.image),
        ...(a.extraTracks ?? []).flatMap((tr) => tr.frames.map((f) => f.image)),
      ]),
      ...(def.defend ? [def.defend.reaction] : []),
    ],
  };
}

// 全参照画像(デモのプリロード数表示などに使う)
export function allSpriteImages(def: UnitSpriteDef): string[] {
  const { required, optional } = spriteImageUrls(def);
  return [...required, ...optional];
}
