"use client";

// 対戦アセットのLoading画面(盤面エリアを覆うオーバーレイ)。
// データは useMatchAssets が供給し、ここは表示だけを担う。
// 盤面自体は裏で通常どおりマウントされる(プリロードのキャッシュを共有するため
// 二重ダウンロードは起きない)。失敗時は「リトライ」と「このまま開始」を提示する
// (円描画フォールバックがあるため、アセットが欠けてもゲームは遊べる)
import { useTranslations } from "next-intl";
import type { MatchAssetsState } from "@/hooks/useMatchAssets";
import { matchAssetKey } from "@/lib/assets/matchAssets";

export function LoadingScreen({ assets }: { assets: MatchAssetsState }) {
  const t = useTranslations("LoadingScreen");
  if (assets.status === "ready") return null;
  const percent =
    assets.total === 0 ? 100 : Math.round((assets.loaded / assets.total) * 100);

  return (
    <div
      data-testid="loading-screen"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "#0c0f14",
        color: "#dfe6ee",
      }}
    >
      {assets.status === "loading" ? (
        <>
          <div style={{ fontSize: 14 }}>{t("preparing")}</div>
          <div
            style={{
              width: "min(280px, 70%)",
              height: 8,
              borderRadius: 4,
              background: "#232a35",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "#5a8de0",
                transition: "width 0.15s ease-out",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#8a94a3" }}>
            {assets.loaded} / {assets.total}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14 }}>{t("someFailed")}</div>
          <div
            style={{
              fontSize: 12,
              color: "#8a94a3",
              maxWidth: "min(320px, 80%)",
              maxHeight: 120,
              overflowY: "auto",
              textAlign: "center",
            }}
          >
            {assets.failed.map((item) => (
              <div key={matchAssetKey(item)}>
                {item.kind === "unit"
                  ? t("failedUnit", { label: item.label })
                  : t("failedTerrain", { label: item.label })}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={assets.retry} style={{ padding: "6px 16px" }}>
              {t("retryButton")}
            </button>
            <button
              onClick={assets.dismiss}
              style={{ padding: "6px 16px" }}
              title={t("dismissTitle")}
            >
              {t("dismissButton")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
