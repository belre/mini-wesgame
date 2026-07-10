import path from "node:path";
import { createRequire } from "node:module";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const require = createRequire(import.meta.url);
const { version } = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  // ワークスペース内のTSソースをそのままバンドルする(ビルド成果物の事前生成を不要にする)
  transpilePackages: ["@parle-stroika/core-engine", "@parle-stroika/backend"],
  // モノレポのルートを明示(リポジトリ外の無関係なlockfileを誤検出させない)
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // 盤面左下のバージョン表示(2026-07-10)向け。VERCEL_GIT_COMMIT_SHAはVercelの
  // デプロイで自動注入される(ローカルdevでは未設定→表示側でフォールバック)
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
  },
};

// i18n(2026-07-09): URLルーティングは使わない(cookie保存のロケール切替のみ。
// /dev/*配下は翻訳対象外なので、[locale]セグメントで全ルートを分岐させる必要がない)
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
