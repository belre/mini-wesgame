import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // ワークスペース内のTSソースをそのままバンドルする(ビルド成果物の事前生成を不要にする)
  transpilePackages: ["@parle-stroika/core-engine", "@parle-stroika/backend"],
  // モノレポのルートを明示(リポジトリ外の無関係なlockfileを誤検出させない)
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
};

// i18n(2026-07-09): URLルーティングは使わない(cookie保存のロケール切替のみ。
// /dev/*配下は翻訳対象外なので、[locale]セグメントで全ルートを分岐させる必要がない)
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
