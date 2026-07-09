"use client";

// スプライトパックのランタイムローダー(A-4 画像配信改善。2026-07-08 初回実装)。
//
// 位置づけ: 既存のロード機構(useMatchAssets → preloadSprite → loadImage)の
// 「下敷きのプリウォーム層」。パックを1fetchで取得し、中の各画像をblob URLとして
// lib/anim/assets.ts のパックレジストリに登録する。以後の loadImage / 描画は
// resolveAssetUrl() 経由でblob URLに解決され、個別のHTTPリクエストが発生しない。
// - パック無効(環境変数未設定)・取得失敗時は何もしない = 従来の個別URL取得に
//   そのまま劣化する(プリロードの検証・チームカラー生成・進捗UIは全て既存のまま)
// - パックの粒度は「陣営単位」(2026-07-08 ユーザー決定: 1回である必要はなく、
//   陣営ごとのAPIコールは許容)。terrainも将来同じ仕組みで別パックにできるが、
//   現状の採用済み地形はアプリ組み込み(dioramaImages.ts)なのでパック不要
//
// 配信(CDNアップロード)はユーザー担当。ビルド: scripts/build-sprite-packs.mts →
// public/packs/units-<factionId>.psp を NEXT_PUBLIC_SPRITE_PACK_BASE へ置く。
// 手順の全体像は docs/asset_delivery.md
import { registerPackedAsset } from "../anim/assets";
import { ASSET_BASE } from "../content/shared";
import { parsePack } from "./packFormat";

// 未設定(dev既定)= パック無効。"/packs" にするとローカルのpublic/packs/で試せる
const PACK_BASE = process.env.NEXT_PUBLIC_SPRITE_PACK_BASE ?? "";

// パック配信が構成されているか(失敗通知の要否判定に使う。無効=失敗ではない)
export function packsEnabled(): boolean {
  return PACK_BASE !== "";
}

// パック名ごとに1回だけ取得(失敗はキャッシュしない=次の対戦開始で再試行)
const packCache = new Map<string, Promise<boolean>>();

// 進行中のパック取得の合流点。preloadSprite はこれを待ってから個別URLに落ちる:
// ロスター外ユニット(CPUリーダー等)は useUnitSprite のマウント時プリロードが
// パック登録より先に走る競争条件があり、待たないと個別リクエストが漏れる(2026-07-08 実測)
let settled: Promise<unknown> = Promise.resolve();
export function packsSettled(): Promise<unknown> {
  return settled;
}

function contentType(path: string): string {
  return path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "image/png";
}

async function fetchPack(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${PACK_BASE}/${name}.psp`);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    for (const entry of parsePack(buf)) {
      const blob = new Blob([buf.slice(entry.offset, entry.offset + entry.size)], {
        type: contentType(entry.path),
      });
      // レジストリのキーは「定義に書かれているURL」= ASSET_BASE + path
      registerPackedAsset(`${ASSET_BASE}${entry.path}`, URL.createObjectURL(blob));
    }
    return true;
  } catch {
    return false;
  }
}

// 対戦に必要なパック(planSpritePacksが返すディレクトリID列)を取得して登録する。
// 戻り値は成否のみで、失敗しても呼び出し側は通常の個別プリロードを続行してよい(自動劣化)
export function loadSpritePacks(packIds: readonly string[]): Promise<boolean> {
  if (!PACK_BASE || typeof window === "undefined") return Promise.resolve(false);
  const names = [...new Set(packIds)].map((id) => `units-${id}`);
  const result = Promise.all(
    names.map((name) => {
      const cached = packCache.get(name);
      if (cached) return cached;
      const p = fetchPack(name).then((ok) => {
        if (!ok) packCache.delete(name);
        return ok;
      });
      packCache.set(name, p);
      return p;
    }),
  ).then((r) => r.every(Boolean));
  settled = result;
  return result;
}
