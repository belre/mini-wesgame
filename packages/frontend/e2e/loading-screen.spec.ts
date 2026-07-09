// 対戦アセットLoading画面のE2E。
// - 正常系: Loading画面が消えてスプライトが描画される
// - 失敗系: 必須画像の404でエラーUI(失敗項目の列挙+リトライ/このまま開始)が出る。
//   リトライは実際に再取得する(失敗キャッシュが残らない)、
//   「このまま開始」は円描画フォールバックで盤面に入れる
// 対象はチュートリアル画面(API・DynamoDB不要のローカル完結モード)。
// 失敗はネットワーク層(route abort)で注入する — CDN障害・取得漏れと同じ経路
import { expect, test } from "@playwright/test";

const TUTORIAL_URL = "/tutorial/basic_battle";
// CPU側(アンデッド)のskeletonの必須(standing)画像。相手陣営も対戦開始時に
// まとめてプリロードする方針なので、これの失敗もLoading画面が検出できるべき
const BLOCKED = "**/sprites/skeleton/skeleton.png";

test("アセット取得が完了するとLoading画面が消え、スプライトが描画される", async ({ page }) => {
  await page.goto(TUTORIAL_URL);
  await expect(page.getByTestId("loading-screen")).toHaveCount(0, { timeout: 30_000 });
  // 地形・ユニットがスプライト(svg image)で描画されている(円フォールバックではない)。
  // Loading画面が消えるコミットとスプライトのimage描画コミットは同時とは限らないため
  // (チュートリアルはSSRを止めているぶん1コマ分ずれ得る)、自動リトライで待つ
  await expect(async () => {
    expect(await page.locator("svg image").count()).toBeGreaterThan(0);
  }).toPass({ timeout: 5_000 });
});

test("必須画像の取得失敗でエラーUIが出て、リトライで復帰する", async ({ page }) => {
  await page.route(BLOCKED, (route) => route.abort());
  await page.goto(TUTORIAL_URL);

  const screen = page.getByTestId("loading-screen");
  await expect(screen).toContainText("一部の画像を読み込めませんでした", { timeout: 30_000 });
  // 失敗した項目がユニット名で列挙される(skeletonの表示名はウォーリアー)
  await expect(screen).toContainText("ウォーリアー");

  // 障害復旧後のリトライで正常に抜ける(失敗が永久キャッシュされないことの検証)
  await page.unroute(BLOCKED);
  await screen.getByRole("button", { name: "リトライ" }).click();
  await expect(screen).toHaveCount(0, { timeout: 30_000 });
});

test("「このまま開始」で失敗を許容して盤面に入れる", async ({ page }) => {
  await page.route(BLOCKED, (route) => route.abort());
  await page.goto(TUTORIAL_URL);

  const screen = page.getByTestId("loading-screen");
  await screen
    .getByRole("button", { name: "このまま開始" })
    .click({ timeout: 30_000 });
  await expect(screen).toHaveCount(0);
  // 盤面は操作可能な状態で出ている(欠けたユニットは円フォールバック)
  await expect(page.getByTestId("board-viewport")).toBeVisible();
});
