"use client";

// 対戦アセットの一括プリロードと進捗管理(Loading画面のデータ源)。
// 計画(何をロードすべきか)は lib/assets/matchAssets.ts の純関数に委譲し、
// このフックは「計画の実行 + 進捗/失敗の集計 + リトライ」だけを担う。
// - required(standing/idle)が揃った項目を完了と数える。攻撃フレームは
//   preloadSprite内でバックグラウンド継続(既存挙動のまま)
// - 失敗してもゲーム進行は妨げない方針: 呼び出し側は dismiss() で
//   「このまま開始」(円描画フォールバック)を選べる
import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchState } from "@parle-stroika/core-engine";
import {
  matchAssetKey,
  planMatchAssets,
  planSpritePacks,
  type MatchAssetItem,
} from "@/lib/assets/matchAssets";
import { loadSpritePacks, packsEnabled } from "@/lib/assets/spritePacks";
import { preloadSprite, preloadTerrainSprite } from "@/lib/sprites";

export interface MatchAssetsState {
  // loading: 取得中 / error: 取得完了したが失敗あり(リトライ or このまま開始を提示)
  // ready: 全項目取得済み、または dismiss() で続行を選択済み
  status: "loading" | "error" | "ready";
  loaded: number;
  total: number;
  failed: MatchAssetItem[];
  // パック配信(CDN)が構成されているのに取得に失敗した場合の通知文。
  // ゲームは個別URL取得で続行するため致命ではない(表示側でトースト等の軽い通知に使う)
  packWarning: string | null;
  retry: () => void;
  dismiss: () => void;
}

function preloadItem(item: MatchAssetItem): Promise<boolean> {
  return item.kind === "unit"
    ? preloadSprite(item.spriteKey, item.owner)
    : preloadTerrainSprite(item.terrainId);
}

export function useMatchAssets(
  state: Pick<MatchState, "players" | "mapId">,
): MatchAssetsState {
  // 計画は対戦中不変(陣営とマップで決まる)なので、その2つだけをキーにする
  const planKey = `${state.mapId}|${state.players.map((p) => p.factionId).join(",")}`;
  const plan = useMemo(
    () => {
      // パック取得はレンダー時に開始する(effectでは遅い): Reactは子のeffectを親より
      // 先に実行するため、effect開始だとHexGrid側のマウント時プリロードが
      // packsSettled()の張り替え前に走ってゲートが素通しになる。
      // loadSpritePacksは名前単位でキャッシュされるため再レンダーでも冪等
      void loadSpritePacks(planSpritePacks(state));
      return planMatchAssets(state);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planKey],
  );

  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState<MatchAssetItem[]>([]);
  const [packWarning, setPackWarning] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoaded(0);
    setFailed([]);
    setDone(false);
    const failures: MatchAssetItem[] = [];
    let count = 0;
    // パック(陣営単位の連結ファイル。A-4)を先にプリウォームする。
    // 成功すれば以後の個別プリロードはblob URL解決でネットワークに出ない。
    // 失敗・無効(環境変数未設定)なら従来どおり個別URL取得に劣化するだけなので
    // 結果は待つが成否は無視する(進捗UI・検証・チームカラー生成は既存のまま)
    void loadSpritePacks(planSpritePacks(state)).then((packsOk) => {
      // パック構成済みなのに失敗 = CDN側の問題。個別取得で続行しつつ表示側に知らせる
      if (alive && !packsOk && packsEnabled()) {
        setPackWarning("高速配信(CDN)への接続に失敗しました。通常の読み込みで続行します");
      }
      return Promise.all(
      plan.map((item) =>
        preloadItem(item).then((ok) => {
          if (!alive) return;
          if (!ok) failures.push(item);
          count += 1;
          setLoaded(count);
        }),
      ),
    );
    }).then(() => {
      if (!alive) return;
      // 失敗項目の表示順を計画順に揃える(Promise解決順に依存させない)
      const failedKeys = new Set(failures.map(matchAssetKey));
      setFailed(plan.filter((item) => failedKeys.has(matchAssetKey(item))));
      setDone(true);
    });
    return () => {
      alive = false;
    };
  }, [plan, attempt]);

  // 一度readyになった対戦では以後Loading画面を出さない(リトライ中の再表示は除く)
  const wasReady = useRef(false);
  const ready = done && (failed.length === 0 || dismissed);
  if (ready) wasReady.current = true;

  return {
    status:
      wasReady.current || ready ? "ready" : done ? "error" : "loading",
    loaded,
    total: plan.length,
    failed,
    packWarning,
    retry: () => setAttempt((n) => n + 1),
    dismiss: () => setDismissed(true),
  };
}
