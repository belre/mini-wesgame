// i18n設定(2026-07-09): URLルーティングは使わない(サブパス方式にすると/dev/*も
// [locale]配下に入れる必要が出て構成が煩雑になる。/dev/*は翻訳対象外の開発用ページのため)。
// ロケールはcookie(ps_locale)で保持し、既存のログインcookie(ps_user)と同じ方式にする。
// 対象は日本語・英語の2言語(プレイヤー向け画面のみ。/dev/*は日本語のまま)
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const SUPPORTED_LOCALES = ["ja", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ja";
export const LOCALE_COOKIE = "ps_locale";

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
