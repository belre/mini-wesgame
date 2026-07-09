// 縦列(同じx)でユニットのスプライトが上下に重なるとき、常に手前のユニットが
// タップを奪ってしまい奥のユニットを選びづらい問題の救済(BoardScreen.tsx onHexClick)。
// 直前タップとほぼ同じ画面位置への連続タップで、列の奥隣のユニットへ選択を切り替えられることを検証する。
//
// 開幕時は各プレイヤー1体(リーダー)のみで縦列の重なりが作れないため、増援を2体雇用して
// 同じ列(x固定・y隣接)に並べる。リーダー自身は主城上にいて「再タップで雇用シートを開く」
// 特別扱いがあるため検証対象からは外し(自軍の城ヘックスのうちx=1の列にある(1,1)(1,2)を使う)、
// 増援どうしの重なりだけを見る。
import { expect, test } from "@playwright/test";

const TUTORIAL_URL = "/tutorial/basic_battle";

async function recruitAt(page: import("@playwright/test").Page, x: number, y: number) {
  // リーダーは開幕時の主城ヘックス(2,2)に固定(基本地図valley_crossingのkeep位置)
  const leader = page.locator('g[data-unit-owner="0"][data-hex-x="2"][data-hex-y="2"]');
  await leader.tap();
  await leader.tap(); // 主城の再タップで雇用シートを開く(リーダー限定の特別扱い)

  const recruitItem = page.locator(".recruit-item:not([disabled])").first();
  await expect(recruitItem).toBeVisible();
  await recruitItem.click();

  const targetHex = page.locator(`g[data-hex-x="${x}"][data-hex-y="${y}"]`);
  await expect(targetHex).toBeVisible();
  await targetHex.tap();

  await expect(page.locator(".confirm-bar")).toHaveCount(0, { timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto(TUTORIAL_URL);
  await expect(page.getByTestId("board-viewport")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("loading-screen")).toHaveCount(0, { timeout: 30_000 });
  // ガイドカードはキュー式(同じターンで複数条件が同時に成立すると複数枚並ぶ)。
  // 全て閉じきるまでループする(1回だけ閉じると次のカードが残って盤面操作の邪魔になる)
  const closeGuide = page.getByRole("button", { name: "OK" });
  for (let i = 0; i < 10; i++) {
    if (!(await closeGuide.first().isVisible().catch(() => false))) break;
    await closeGuide.first().click();
  }
});

test("同一位置への連続タップで、縦列で重なった奥のユニットへ選択が移る", async ({ page }) => {
  // 自軍の城ヘックス列x=1(y=1,2,3が全て城)のうち隣接する2マスに増援を配置し、
  // リーダーとは無関係な「縦列で重なった2ユニット」を作る
  await recruitAt(page, 1, 1);
  await expect(page.locator('g[data-unit-owner="0"][data-unit-id]')).toHaveCount(2);
  await recruitAt(page, 1, 2);
  await expect(page.locator('g[data-unit-owner="0"][data-unit-id]')).toHaveCount(3);

  const reinforcement1 = page.locator('g[data-unit-owner="0"][data-hex-x="1"][data-hex-y="1"]');
  const reinforcement2 = page.locator('g[data-unit-owner="0"][data-hex-x="1"][data-hex-y="2"]');
  const box1 = (await reinforcement1.boundingBox())!;
  const box2 = (await reinforcement2.boundingBox())!;

  // 縦列の隣接ユニットはスプライト(72px)が行間(√3S≈62px)より背が高いため画面上で重なる。
  // この前提が崩れていたら不具合そのものが再現できないテストになるので明示的に検証する
  const overlapLeft = Math.max(box1.x, box2.x);
  const overlapRight = Math.min(box1.x + box1.width, box2.x + box2.width);
  const overlapTop = Math.max(box1.y, box2.y);
  const overlapBottom = Math.min(box1.y + box1.height, box2.y + box2.height);
  expect(
    overlapRight > overlapLeft && overlapBottom > overlapTop,
    "縦列の2ユニットが画面上で重なっている前提が崩れている",
  ).toBe(true);

  // タップ座標は「重なり領域の中心」ではなく増援1自身の中心(=そのユニット自身の当たり判定の
  // 中心)を使う。バウンディングボックスにはHPバー等の非クリック領域も含まれるため、
  // 重なり領域の中心が必ずしもどちらのユニットの当たり判定内に入るとは限らないため
  const px = Math.round(box1.x + box1.width / 2);
  const py = Math.round(box1.y + box1.height / 2);

  // 選択中のユニットは白いリング(stroke="#ffffff")を纏う(UnitBody: スプライト有りは追加の
  // リング円、フォールバック描画は本体円自身のstrokeが変わる。どちらもこのセレクタで拾える)。
  // 雇用した2体は同じ種類になり得るため名前(unit-panel)ではなく位置で見分ける
  const isSelected = async (x: number, y: number) =>
    (await page
      .locator(`g[data-unit-owner="0"][data-hex-x="${x}"][data-hex-y="${y}"] circle[stroke="#ffffff"]`)
      .count()) > 0;

  // 1回目のタップ: 重なりの中で自然にヒットしたユニットが選択される(手前優先の既存挙動)
  await page.touchscreen.tap(px, py);
  await expect(page.locator(".unit-panel")).toBeVisible();
  const firstAt11 = await isSelected(1, 1);
  const firstAt12 = await isSelected(1, 2);
  expect(firstAt11 !== firstAt12, "どちらか一方だけが選択されているはず").toBe(true);

  // 2回目のタップ(同じ画面位置): 奥隣のユニットへ選択が切り替わる
  await page.touchscreen.tap(px, py);
  await expect(page.locator(".unit-panel")).toBeVisible();
  const secondAt11 = await isSelected(1, 1);
  expect(secondAt11).toBe(!firstAt11);

  // 3回目のタップ(同じ画面位置): これ以上奥はいないので選択は変わらない
  await page.touchscreen.tap(px, py);
  await expect(page.locator(".unit-panel")).toBeVisible();
  const thirdAt11 = await isSelected(1, 1);
  expect(thirdAt11).toBe(secondAt11);
});
