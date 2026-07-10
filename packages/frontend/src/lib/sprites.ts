"use client";

// スプライトのランタイム層: プリロードと再生フック。
// 3層構成の結節点で、このファイル自体はもうデータもモデルも持たない:
// - モデル(型+時間解決): lib/anim/ (React/DOM非依存の純粋関数)
// - コンテンツ(定義表): lib/content/ (陣営別ファイル。SpriteRegistryの実装を提供)
// - ランタイム(本ファイル): プリロード+Reactフック
//
// - アニメ用フレームの読み込み中・失敗時は組み込み1枚絵(バンドル同梱のbase立ち絵)を
//   表示する(それも出せない場合のみ従来の円描画)
// - 定義が無いspriteKeyは円描画のまま(ユニットごとに段階的にスプライト化できる)
import { useEffect, useState } from "react";
import {
  MISSILE_DEFAULT_SIZE,
  type AttackAnimDef,
  type MissileDef,
  type OffsetSeg,
  type SpriteRegistry,
  type TerrainObjectDef,
  type TerrainSpriteDef,
  type UnitSpriteDef,
  type WmlFrame,
} from "./anim/model";
import {
  attackFrameAt,
  attackLungeAt,
  attackOffsetAt,
  missileHeightAt,
  missileImageAt,
  missileProgressAt,
  missileRotates,
  missileStateAt,
  segmentValueAt,
} from "./anim/resolve";
import { imageNaturalSize, loadImage, resolveAssetUrl, spriteImageUrls } from "./anim/assets";
import { recolorImage, teamColoredSrc } from "./anim/teamColor";
import { packsSettled } from "./assets/spritePacks";
import { SPRITE_REGISTRY, TERRAIN_SPRITES, UNIT_SPRITES } from "./content";
// 組み込み1枚絵(フォールバック用)。fetch-demo-sprites.mjsが生成する(gitignore)。
// 静的importでバンドルに入りアプリ自身(/_next/static/)から配信されるため、
// CDN・public/spritesの取得に失敗した状況でも表示できる
import { UNIT_BASE_IMAGES } from "@/generated/unitBaseImages";

// 公認ファサード(2026-07-08 方針確定): スプライト関連(モデル型・解決関数・
// コンテンツ・ローディング)のimport元はこのファイルに統一する。
// かつて「段階的に直参照へ移行する」としていたが移行は進まず実態もファサード利用で
// 安定しているため、単一入口として公認した。直下のlib/anim/lib/contentを
// 直接importしない(盤面の幾何・配色はlib/board/が別途入口)
export {
  MISSILE_DEFAULT_SIZE,
  SPRITE_REGISTRY,
  teamColoredSrc,
  TERRAIN_SPRITES,
  UNIT_SPRITES,
  attackFrameAt,
  attackLungeAt,
  attackOffsetAt,
  imageNaturalSize,
  loadImage,
  missileHeightAt,
  missileImageAt,
  missileProgressAt,
  missileRotates,
  missileStateAt,
  resolveAssetUrl,
  segmentValueAt,
};
export type {
  AttackAnimDef,
  MissileDef,
  OffsetSeg,
  SpriteRegistry,
  TerrainObjectDef,
  TerrainSpriteDef,
  UnitSpriteDef,
  WmlFrame,
};

// ---- 地形タイル ----

const terrainPreloadCache = new Map<string, Promise<boolean>>();

// 地形定義の全画像URL(ground+objects、バリアント込み)。プリロードと整合性テストが共有する走査
export function terrainImageUrls(terrainId: string): readonly string[] {
  const def = SPRITE_REGISTRY.getTerrainSprite(terrainId);
  if (!def) return [];
  return [
    ...def.ground.flatMap((layer) => (typeof layer === "string" ? [layer] : layer)),
    ...(def.objects?.flatMap((o) => o.srcs) ?? []),
    ...(def.edgeTransition ? [def.edgeTransition.src] : []),
  ];
}

export function preloadTerrainSprite(terrainId: string): Promise<boolean> {
  const cached = terrainPreloadCache.get(terrainId);
  if (cached) return cached;
  const urls = terrainImageUrls(terrainId);
  if (urls.length === 0 || typeof window === "undefined") {
    return Promise.resolve(false);
  }
  const promise = Promise.all(urls.map(loadImage)).then((r) => {
    const ok = r.every(Boolean);
    // 失敗はキャッシュに残さない(Loading画面のリトライで再取得できるように)
    if (!ok) terrainPreloadCache.delete(terrainId);
    return ok;
  });
  terrainPreloadCache.set(terrainId, promise);
  return promise;
}

// 地形定義のロード完了を待つ共通フック。ready になるまで null
function useTerrainDef(terrainId: string) {
  const def = SPRITE_REGISTRY.getTerrainSprite(terrainId);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!def) return;
    let alive = true;
    void preloadTerrainSprite(terrainId).then((ok) => {
      if (alive && ok) setReady(true);
    });
    return () => {
      alive = false;
    };
  // 定義は毎レンダー同一参照とは限らないため、内容(URL列)で比較する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrainId, terrainImageUrls(terrainId).join("|")]);

  return ready && def ? def : null;
}

// 地面レイヤー列(下から順に重ね描き。要素はURLまたはバリアントURL配列)。
// null の間は呼び出し側が色polygonへフォールバック
export function useTerrainSprite(
  terrainId: string,
): readonly (string | readonly string[])[] | null {
  return useTerrainDef(terrainId)?.ground ?? null;
}

// 画像URL群のロード完了を待つ汎用フック(地形立体物ビルボード等)。空配列は即ready。
// loadImageはキャッシュされるため、プリロード済みなら初回レンダーから true になる
export function useImagesReady(srcs: readonly string[]): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (srcs.length === 0) return;
    let alive = true;
    void Promise.all(srcs.map(loadImage)).then((r) => {
      if (alive && r.every(Boolean)) setReady(true);
    });
    return () => {
      alive = false;
    };
  // URL列の内容で比較(配列は毎レンダー新参照になりうる)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs.join("|")]);
  return srcs.length === 0 || ready;
}

// ---- ユニットスプライトのプリロード(spriteKeyごとに1回。失敗したら以後フォールバック) ----

const preloadCache = new Map<string, Promise<boolean>>();

// owner(チームカラー)ごとにプリロード+マゼンタ置換画像の生成を行う
export function preloadSprite(spriteKey: string, owner: number): Promise<boolean> {
  const cacheKey = `${spriteKey}#${owner}`;
  const cached = preloadCache.get(cacheKey);
  if (cached) return cached;
  const def = SPRITE_REGISTRY.getUnitSprite(spriteKey);
  if (!def || typeof window === "undefined") {
    return Promise.resolve(false);
  }
  // standing/idle フレームのみ必須。攻撃フレームはベストエフォート(欠けても表示は続行)
  // 先にスプライトパックの取得完了を待つ(packsSettled): ロスター外ユニットの
  // マウント時プリロードがパック登録を追い越して個別リクエストに漏れるのを防ぐ
  const { required, optional } = spriteImageUrls(def);
  const promise = packsSettled().then(() => Promise.all([
    Promise.all(
      required.map((u) => loadImage(u).then((ok) => (ok ? recolorImage(u, owner).then(() => true) : false))),
    ).then((r) => r.every(Boolean)),
    // 攻撃系は結果を待たない(バックグラウンドでキャッシュ+チームカラー生成)
    Promise.all(optional.map((u) => loadImage(u).then(() => recolorImage(u, owner)))),
  ])).then(([requiredOk]) => {
    // 失敗はキャッシュに残さない(Loading画面のリトライで再取得できるように)
    if (!requiredOk) preloadCache.delete(cacheKey);
    return requiredOk;
  });
  preloadCache.set(cacheKey, promise);
  return promise;
}

// ---- アニメーション再生フック ----
// WMLのdurationどおりに再帰setTimeoutでフレームを送る(検証: /dev/sprites)。
// 戻り値が null の間は呼び出し側が従来の円描画にフォールバックする
const IDLE_MIN_WAIT_MS = 3000;
const IDLE_RAND_WAIT_MS = 5000;

// フォールバック用: 組み込み1枚絵をロード+チームカラー変換して返す。
// バンドル同梱URLなのでCDN障害時でもアプリが生きていれば成功する。
// プリロードと並行して呼ぶことで、アニメ用フレーム揃うまでの間の
// 表示(円アイコン化)を防ぐプレースホルダーとしても使う
async function loadBundledBase(spriteKey: string, owner: number): Promise<string | null> {
  const bundled = UNIT_BASE_IMAGES[spriteKey];
  if (!bundled || typeof window === "undefined") return null;
  if (!(await loadImage(bundled))) return null;
  await recolorImage(bundled, owner);
  return teamColoredSrc(bundled, owner) ?? bundled;
}

export function useUnitSprite(spriteKey: string, owner: number): string | null {
  const def = SPRITE_REGISTRY.getUnitSprite(spriteKey);
  const [ready, setReady] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  // 初期値から組み込みbase絵(原色)を同期的に採用する。teamColor置換待ちの
  // 1レンダー分(promise解決を待つ間)だけでも円アイコンに落ちるのを防ぐのが狙い
  // (baseはWesnothの標準寸法72x72前提なのでimageNaturalSize未確定でも寸法跳ねは起きない)
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(
    () => UNIT_BASE_IMAGES[spriteKey] ?? null,
  );

  useEffect(() => {
    if (!def) return;
    let alive = true;
    setReady(false);
    setFallbackSrc(UNIT_BASE_IMAGES[spriteKey] ?? null);
    // チームカラー版に差し替え(プリロードと並行)。原色→着色のワンテンポは許容し、
    // 円アイコンへの後退だけは避ける
    void loadBundledBase(spriteKey, owner).then((fallback) => {
      if (alive && fallback) setFallbackSrc(fallback);
    });
    void preloadSprite(spriteKey, owner).then((ok) => {
      if (alive && ok) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [spriteKey, owner, def]);

  useEffect(() => {
    if (!ready || !def) return;
    let cancelled = false;
    let timer: number;
    let mode: "standing" | "idle" = "standing";
    // 開始コマをランダムにして複数ユニットの同期(全員が同じ動き)を崩す
    let index = Math.floor(Math.random() * def.standing.length);
    let nextIdleAt =
      performance.now() + IDLE_MIN_WAIT_MS + Math.random() * IDLE_RAND_WAIT_MS;
    const tick = () => {
      if (cancelled) return;
      const seq = mode === "standing" ? def.standing : def.idle ?? def.standing;
      const frame = seq[index % seq.length];
      setSrc(resolveAssetUrl(frame.image));
      index += 1;
      if (index >= seq.length) {
        index = 0;
        if (mode === "idle") {
          mode = "standing";
        } else if (def.idle && performance.now() > nextIdleAt) {
          mode = "idle";
          nextIdleAt =
            performance.now() + IDLE_MIN_WAIT_MS + Math.random() * IDLE_RAND_WAIT_MS;
        }
      }
      timer = window.setTimeout(tick, frame.duration);
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, def]);

  // 正常時はアニメの現在フレーム、プリロード失敗時は組み込み1枚絵(静止)、
  // どちらも無ければnull(呼び出し側が円描画にフォールバック)
  return ready ? src : fallbackSrc;
}

// standingに重ねる独立周期のループレイヤー(pillagerの松明の炎など)の現在フレーム。
// 各レイヤーは本体standingとは別のタイマーで回る(WMLの多層[frame]相当)。
// 画像のロードに失敗したレイヤーは表示しない(本体の表示は維持)
export function useStandingOverlays(spriteKey: string): string[] {
  const def = SPRITE_REGISTRY.getUnitSprite(spriteKey);
  const overlays = def?.standingOverlays;
  const [srcs, setSrcs] = useState<string[]>([]);

  useEffect(() => {
    if (!overlays || overlays.length === 0) {
      setSrcs([]);
      return;
    }
    let cancelled = false;
    const timers: number[] = [];
    const current: (string | null)[] = overlays.map(() => null);
    void Promise.all(
      overlays.map(async (o) =>
        (await Promise.all(o.frames.map((f) => loadImage(f.image)))).every(Boolean),
      ),
    ).then((loadedOk) => {
      if (cancelled) return;
      overlays.forEach((o, layer) => {
        if (!loadedOk[layer]) return;
        let index = 0;
        const tick = () => {
          if (cancelled) return;
          const frame = o.frames[index % o.frames.length];
          current[layer] = resolveAssetUrl(frame.image);
          setSrcs(current.filter((s): s is string => s !== null));
          index += 1;
          timers[layer] = window.setTimeout(tick, frame.duration);
        };
        tick();
      });
    });
    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
    };
  }, [overlays]);

  return srcs;
}
