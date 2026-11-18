import { expect, test } from "@playwright/test";

test("the Back gesture closes a sheet and stays on the page", async ({ page }) => {
  await page.goto("/merge-pdf");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tools" }).click();
  await expect(page.getByRole("dialog", { name: "All tools" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/merge-pdf$/);
  // A normal Back still leaves the page afterwards.
  await page.goBack();
  await expect(page).not.toHaveURL(/merge-pdf$/);
});

test("closing a sheet with its button leaves no extra history step", async ({ page }) => {
  await page.goto("/");
  await page.goto("/merge-pdf");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/);
});

test("choosing a tool from the sheet then going back returns to the page that was open", async ({ page }) => {
  await page.goto("/merge-pdf");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("dialog").locator('a[href="/split-pdf"]').click();
  await expect(page).toHaveURL(/split-pdf/);
  await page.goBack();
  await expect(page).toHaveURL(/merge-pdf$/);
});

test("on a phone, dragging a sheet down closes it, and a short drag springs back", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "swipe closing is for phones");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Tools" }).click();
  const sheet = page.getByRole("dialog", { name: "All tools" });
  const handle = sheet.locator("[data-sheet-handle]").first();
  const box = await handle.boundingBox();
  if (!box) throw new Error("no handle");
  const x = box.x + 60;
  const y = box.y + 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 30, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 200, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
