import path from "node:path";
import { createRequire } from "node:module";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const require = createRequire(import.meta.url);
const { version } = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  // ワークスペース内のTSソースをそのままバンドルする(ビルド成果物の事前生成を不要にする)
  transpilePackages: ["@parle-stroika/core-engine"],
  // モノレポのルートを明示(リポジトリ外の無関係なlockfileを誤検出させない)
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // 静的書き出し(2026-07-10): アプリはCPU戦+チュートリアルのみでバックエンド不要
  // (ロビー・API Routesは撤去済み)なので、Vercel/itch.io共通で完全に静的なHTMLへ
  // 書き出せる(i18n/request.tsのcookies()撤去とセットで初めて成立する)。
  output: "export",
  // itch.ioはzipの中身をドメイン直下ではなく不定のサブパス(アップロードのたびに変わる
  // CDN上のハッシュ付きパス)に展開して配信するため、Next既定の絶対パス(/_next/...)は
  // 404になる(Vercelはドメイン直下なので絶対パスのままで問題ない)。
  // ITCH_BUILD=1のときだけ相対パス化する。ただし単一のassetPrefixだけでは
  // ネストしたページ(dev/*・tutorial/*)の深さに対応できないため、
  // scripts/prepare-itch-build.mjsで各HTMLに<base href>を深さぶん注入して補う
  ...(process.env.ITCH_BUILD ? { assetPrefix: "./" } : {}),
  // 盤面左下のバージョン表示(2026-07-10)向け。VERCEL_GIT_COMMIT_SHAはVercelの
  // デプロイで自動注入される(ローカルdevでは未設定→表示側でフォールバック)
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
    // スプライトパック(.psp)のCDN既定値(2026-07-10)。GPLv3第6条(d)の
    // 「オブジェクト配信と同等アクセスのソース提供」を満たすために公開している
    // 別リポジトリ(github.com/belre/wesnoth-contents-delivery)をjsDelivr経由で配信する。
    // S3/CloudFrontと違いCORS設定が不要(常時 access-control-allow-origin: *)なため
    // 「AWS不要・Vercel単独」構成のままCDN化できる。.env.local等で明示的に上書きすれば
    // ローカルの public/packs/ 等に差し替え可能(未設定時のみこの既定値を使う)
    NEXT_PUBLIC_SPRITE_PACK_BASE:
      process.env.NEXT_PUBLIC_SPRITE_PACK_BASE ??
      "https://cdn.jsdelivr.net/gh/belre/wesnoth-contents-delivery@main/mini-wesgame",
    // 個別スプライト(terrain・base立ち絵・ユニット個別フレーム・halo・飛び道具)の
    // CDN既定値。理由はNEXT_PUBLIC_SPRITE_PACK_BASEと同じ(同じdelivery repoの
    // sprites/配下を指す。lib/content/shared.tsのT()が`${ASSET_BASE}/sprites/...`を組み立てる)
    NEXT_PUBLIC_ASSET_BASE:
      process.env.NEXT_PUBLIC_ASSET_BASE ??
      "https://cdn.jsdelivr.net/gh/belre/wesnoth-contents-delivery@main/mini-wesgame",
  },
};

// i18n(2026-07-09): URLルーティングは使わない(cookie保存のロケール切替のみ。
// /dev/*配下は翻訳対象外なので、[locale]セグメントで全ルートを分岐させる必要がない)
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
