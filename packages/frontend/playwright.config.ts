import { defineConfig, devices } from "@playwright/test";

// スマホでの傾き盤面操作(hexタップ・1本指パン・クリック抑止)を検証するE2E。
// 対象はチュートリアル画面(ログイン・API・DynamoDB不要のローカル完結モード)。
// ポートはdev(3010)と衝突しない3011を使う
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    ...devices["Pixel 7"], // タッチ有効・モバイルビューポート
    baseURL: "http://localhost:3011",
  },
  webServer: {
    command: "npx next dev -p 3011",
    url: "http://localhost:3011",
    reuseExistingServer: true,
    timeout: 120_000,
    // .env.localのNEXT_PUBLIC_SPRITE_PACK_BASE(CDN検証用)を無効化する。
    // 有効なままだとスプライトパックが個別画像fetchを迂回し、loading-screen.spec.tsが
    // 仕込む個別URLの404モックが素通りしてしまう(2026-07-08 実測)
    env: { NEXT_PUBLIC_SPRITE_PACK_BASE: "" },
  },
});
