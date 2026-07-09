// チームカラー置換(Wesnothのteam color仕組みの移植)。
//
// Wesnothの原画はマゼンタ19色のパレット(data/core/team-colors.cfgのmagenta)で
// チームカラー領域を塗っており、エンジンが陣営の色レンジに置換する。
// アルゴリズムはsrc/color_range.cppのrecolor_palette()の移植:
// - パレット先頭(F49AC1)の平均輝度(=197)を基準に、各色の輝度比で
//   min→mid→max のレンジへ線形補間する
// - 置換は「パレット色との完全一致」のみ(近似色の誤置換はしない)
//
// 実装はCanvasでピクセル置換し、blob URLとしてキャッシュする。
// プリロード時に生成し、描画側は teamColoredSrc() の同期lookupで差し替える。
// 生成に失敗した場合(CORS等)は原色のまま表示にフォールバックする。
import { recordImageSize, resolveAssetUrl } from "./assets";

// magenta=F49AC1,3F0016,... (先頭が基準色)
const MAGENTA_PALETTE = [
  "F49AC1", "3F0016", "55002A", "690039", "7B0045", "8C0051", "9E005D",
  "B10069", "C30074", "D6007F", "EC008C", "EE3D96", "EF5BA1", "F172AC",
  "F287B6", "F6ADCD", "F8C1D9", "FAD5E5", "FDE9F1",
];

interface ColorRange {
  mid: [number, number, number];
  max: [number, number, number];
  min: [number, number, number];
}

function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

// [color_range]のrgb=mid,max,min(team-colors.cfg)。owner番号順: 0=青(先攻)/1=赤(後攻)
const TEAM_RANGES: ColorRange[] = [
  { mid: hexRgb("2E419B"), max: hexRgb("FFFFFF"), min: hexRgb("0F0F0F") }, // blue
  { mid: hexRgb("FF0000"), max: hexRgb("FFFFFF"), min: hexRgb("000000") }, // red
];

// パレット色(packed RGB)→ 置換後[r,g,b] のマップをレンジごとに構築
function buildMapping(range: ColorRange): Map<number, [number, number, number]> {
  const first = hexRgb(MAGENTA_PALETTE[0]);
  const referenceAvg = Math.floor((first[0] + first[1] + first[2]) / 3);
  const mapping = new Map<number, [number, number, number]>();
  for (const hex of MAGENTA_PALETTE) {
    const [r, g, b] = hexRgb(hex);
    const avg = Math.floor((r + g + b) / 3);
    let out: [number, number, number];
    if (referenceAvg && avg <= referenceAvg) {
      const ratio = avg / referenceAvg;
      out = [0, 1, 2].map((i) =>
        Math.min(255, Math.floor(ratio * range.mid[i] + (1 - ratio) * range.min[i])),
      ) as [number, number, number];
    } else {
      const ratio = (255 - avg) / (255 - referenceAvg);
      out = [0, 1, 2].map((i) =>
        Math.min(255, Math.floor(ratio * range.mid[i] + (1 - ratio) * range.max[i])),
      ) as [number, number, number];
    }
    mapping.set((r << 16) | (g << 8) | b, out);
  }
  return mapping;
}

const mappings = TEAM_RANGES.map(buildMapping);

// `${src}#${team}` → blob URL(生成失敗はnullを記録し、以後原色フォールバック)
const recolorCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<void>>();

// 置換済みURLの同期lookup(未生成・失敗時はnull → 呼び出し側は原色srcを使う)
export function teamColoredSrc(src: string, team: number): string | null {
  return recolorCache.get(`${src}#${team}`) ?? null;
}

// チームカラー置換画像を生成してキャッシュする(プリロード時に呼ぶ)。
// 本番はCloudFront(別オリジン)配信のため crossOrigin="anonymous" で読み込む
// (バケット側はCORS許可済み。CORS不備でcanvasがtaintedになった場合は原色のまま)
export function recolorImage(src: string, team: number): Promise<void> {
  const key = `${src}#${team}`;
  if (recolorCache.has(key)) return Promise.resolve();
  const running = inFlight.get(key);
  if (running) return running;
  const mapping = mappings[team];
  if (!mapping || typeof window === "undefined") {
    recolorCache.set(key, null);
    return Promise.resolve();
  }
  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        let touched = false;
        for (let i = 0; i < px.length; i += 4) {
          const packed = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
          const replaced = mapping.get(packed);
          if (replaced) {
            px[i] = replaced[0];
            px[i + 1] = replaced[1];
            px[i + 2] = replaced[2];
            touched = true;
          }
        }
        if (!touched) {
          // チームカラー領域を持たない画像(飛び道具等)は原色を使う
          recolorCache.set(key, null);
          resolve();
          return;
        }
        ctx.putImageData(data, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) {
            recolorCache.set(key, null);
            resolve();
            return;
          }
          const url = URL.createObjectURL(blob);
          recordImageSize(url, img.naturalWidth, img.naturalHeight); // 原寸描画用
          recolorCache.set(key, url);
          resolve();
        });
      } catch {
        // tainted canvas等 → 原色フォールバック
        recolorCache.set(key, null);
        resolve();
      }
    };
    img.onerror = () => {
      recolorCache.set(key, null);
      resolve();
    };
    img.src = resolveAssetUrl(src);
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
