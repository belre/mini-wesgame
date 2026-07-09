// 言語切り替え(2026-07-09)。URLルーティングを使わないため、cookie更新→同じページへ
// 戻るだけのシンプルなフォーム2つ(現在の言語はボタンをdisabledにして示す)。
// action属性はServer Action(function参照)ではなく文字列URL(/api/set-locale)にする —
// function参照にすると、Next.jsのクライアント側ルーターキャッシュが同じパスへの
// redirect()を再取得せず、cookie更新前の古い言語のまま表示され続める不具合があった。
// 文字列URLの素のHTMLフォームPOSTならSPA横取りが起きず、ブラウザ本来のフルページ
// 遷移になるため確実に反映される(src/app/api/set-locale/route.ts参照)
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/request";

const LOCALE_LABEL: Record<Locale, string> = { ja: "日本語", en: "English" };

export function LocaleSwitcher({ locale, from = "/" }: { locale: Locale; from?: string }) {
  return (
    <div className="row" style={{ gap: 4 }}>
      {SUPPORTED_LOCALES.map((l) => (
        <form key={l} action="/api/set-locale" method="POST">
          <input type="hidden" name="locale" value={l} />
          <input type="hidden" name="from" value={from} />
          <button
            type="submit"
            disabled={l === locale}
            style={{ fontSize: 12, padding: "2px 8px" }}
          >
            {LOCALE_LABEL[l]}
          </button>
        </form>
      ))}
    </div>
  );
}
