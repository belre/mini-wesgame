import path from "node:path";
import { defineConfig } from "vitest/config";

// e2e/(Playwright)はvitestの対象外。ユニットテストはtest/のみ
export default defineConfig({
  resolve: {
    // tsconfig.jsonのpaths("@/*" → "./src/*")と一致させる。src配下のファイルは
    // Next.js向けに"@/..."で書かれているため、テストからimportするとこの解決が要る
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
