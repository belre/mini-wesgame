// スマホ(タッチ)での傾き盤面操作のE2E。
// - hexのタップでユニット選択(移動ハイライトが出る)
// - 1本指スワイプでカメラがパンする(ページスクロールに取られない)
// - ドラッグ直後のタップ扱い(click)が選択を発火させない
// タッチはCDPのInput.dispatchTouchEventで実タッチイベントとして注入する
// (touch-action等のブラウザ既定挙動を通るため、マウス代替では再現しない不具合を検出できる)
import { expect, test, type Page } from "@playwright/test";

const TUTORIAL_URL = "/tutorial/basic_battle";

async function touchSwipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        },
      ],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

function cameraTranslate(transform: string): { x: number; y: number } {
  const m = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
}

test.beforeEach(async ({ page }) => {
  await page.goto(TUTORIAL_URL);
  // 盤面(傾きカメラ)が出るまで待つ。ガイドカードが被っていたら閉じる
  await expect(page.getByTestId("board-viewport")).toBeVisible({ timeout: 30_000 });
  // アセットLoading画面が消えるまで待つ(オーバーレイがタッチを吸ってしまうため)
  await expect(page.getByTestId("loading-screen")).toHaveCount(0, { timeout: 30_000 });
  const closeGuide = page.getByRole("button", { name: /OK|閉じる|次へ/ });
  if (await closeGuide.first().isVisible().catch(() => false)) {
    await closeGuide.first().click();
  }
});

test("開幕時に自軍リーダーが画面内に見える(初期カメラ)", async ({ page }) => {
  // ビュー反転で自陣が手前=盤面端に来るため、初期カメラが原点のままだと
  // スマホ幅ではリーダーが画面外になる(2026-07-06に実際に起きた不具合)
  const unit = page.locator('g[data-unit-owner="0"]').first();
  await expect(unit).toBeVisible();
  const box = (await unit.boundingBox())!;
  const vp = page.viewportSize()!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  expect(cx, `リーダー中心x=${cx}が画面幅${vp.width}の外`).toBeGreaterThan(0);
  expect(cx, `リーダー中心x=${cx}が画面幅${vp.width}の外`).toBeLessThan(vp.width);
  expect(cy, `リーダー中心y=${cy}が画面高${vp.height}の外`).toBeGreaterThan(0);
  expect(cy, `リーダー中心y=${cy}が画面高${vp.height}の外`).toBeLessThan(vp.height);
});

test("タップで自軍ユニットを選択でき、移動ハイライトが表示される", async ({ page }) => {
  const unit = page.locator('g[data-unit-owner="0"]').first();
  await expect(unit).toBeVisible();
  await unit.tap();
  // 移動範囲ハイライト(青)が地形レイヤーに現れる
  await expect(
    page.locator('polygon[fill="rgba(79,140,255,0.35)"]').first(),
  ).toBeVisible({ timeout: 5_000 });
});

test("1本指スワイプでカメラがパンする(ページスクロールに取られない)", async ({ page }) => {
  const viewport = page.getByTestId("board-viewport");
  const box = (await viewport.boundingBox())!;
  const camera = page.getByTestId("board-camera");
  const before = cameraTranslate(await camera.evaluate((el) => el.style.transform));

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await touchSwipe(page, { x: cx, y: cy }, { x: cx - 80, y: cy - 40 });

  const after = cameraTranslate(await camera.evaluate((el) => el.style.transform));
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(40);
});

test("ドラッグ直後のタップ扱いでユニットが選択されない", async ({ page }) => {
  // 自軍ユニットの上からスワイプを開始する(ドラッグ後のclickは抑止されるべき)
  const unit = page.locator('g[data-unit-owner="0"]').first();
  const ubox = (await unit.boundingBox())!;
  const sx = ubox.x + ubox.width / 2;
  const sy = ubox.y + ubox.height / 2;
  await touchSwipe(page, { x: sx, y: sy }, { x: sx - 100, y: sy });
  // 選択ハイライトが出ていないこと(ドラッグはパンであってタップではない)
  await page.waitForTimeout(300);
  expect(await page.locator('polygon[fill="rgba(79,140,255,0.35)"]').count()).toBe(0);
});
