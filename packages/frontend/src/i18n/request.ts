// i18n設定(2026-07-09): mini-wesgameはEnglish固定(唯一のロケール)。
// URLルーティングは使わない(サブパス方式にすると/dev/*も[locale]配下に入れる必要が出て
// 構成が煩雑になる)。next-intlの仕組み自体は残し、SUPPORTED_LOCALESを["en"]のみにすることで
// 対応する(将来多言語化する際はここへ追加するだけで良い)
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const SUPPORTED_LOCALES = ["en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
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
