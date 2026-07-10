import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini Wesgame",
  description: "非同期マルチプレイのターン制ウォーゲーム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // ページ全体のピンチズームは無効化し、盤面のパン&ズームに一本化する
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // i18n(2026-07-09): ロケールはcookie経由(src/i18n/request.ts)。/dev/*はこの下でも
  // 翻訳フックを使わなければ日本語のまま描画される(対象外という決定どおり)
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
