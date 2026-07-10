// i18n設定(2026-07-09): mini-wesgameはEnglish固定(唯一のロケール)。
// URLルーティングは使わない(サブパス方式にすると/dev/*も[locale]配下に入れる必要が出て
// 構成が煩雑になる)。next-intlの仕組み自体は残し、SUPPORTED_LOCALESを["en"]のみにすることで
// 対応する(将来多言語化する際はここへ追加するだけで良い)
//
// 2026-07-10: cookies()経由の保存済みロケール読み取りは撤去した。SUPPORTED_LOCALESが
// ["en"]のみのため元々no-op(isSupportedLocaleは"en"以外を弾く)だった上、
// cookies()はリクエスト時専用APIでoutput:"export"(itch.io配布用の静的書き出し)と
// 両立しない。多言語化する際はクライアント側でロケールを切り替える方式に置き換えること
// (LOCALE_COOKIE/isSupportedLocaleは将来の切替UIから参照される想定でエクスポートは残す)
import { getRequestConfig } from "next-intl/server";

export const SUPPORTED_LOCALES = ["en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "ps_locale";

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  return {
    locale: DEFAULT_LOCALE,
    messages: (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default,
  };
});
