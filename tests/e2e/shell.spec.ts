import { expect, test } from "@playwright/test";
import { TOOL_SLUGS, noHorizontalScroll, targetsAre44 } from "./helpers";

test("the tool list reaches all fourteen tools", async ({ page }) => {
  await page.goto("/");
  await noHorizontalScroll(page);
  const links = page.locator("main ul a");
  await expect(links).toHaveCount(14);
  for (const slug of TOOL_SLUGS) {
    await page.goto("/");
    await page.locator(`main a[href="/${slug}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}$`));
    await expect(page.locator("h1")).toBeVisible();
    await noHorizontalScroll(page);
  }
});

test("the Tools button opens a sheet listing every tool, with the current one marked", async ({ page }) => {
  await page.goto("/merge-pdf");
  await page.getByRole("button", { name: "Tools" }).click();
  const sheet = page.getByRole("dialog", { name: "All tools" });
  await expect(sheet.locator("ul a")).toHaveCount(14);
  await expect(sheet.locator('a[aria-current="page"]')).toHaveText(/Merge PDF/);
  await sheet.locator('a[href="/split-pdf"]').click();
  await expect(page).toHaveURL(/split-pdf/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the theme switch changes the page and is remembered", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const wasDark = (await html.getAttribute("class"))?.includes("dark") ?? false;
  await page.getByRole("button", { name: /Switch to/ }).click();
  await expect(html).toHaveClass(wasDark ? /^(?!.*dark)/ : /dark/);
  await page.reload();
  await expect(html).toHaveClass(wasDark ? /^(?!.*dark)/ : /dark/);
});

test("privacy and not-found pages", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator("h1")).toContainText("Privacy");
  await noHorizontalScroll(page);
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "See all tools" })).toBeVisible();
});

test("touch targets are at least 44 px on the home page and a tool page", async ({ page }, info) => {
  test.skip(info.project.name !== "phone");
  for (const url of ["/", "/merge-pdf", "/resize-image", "/word-to-pdf"]) {
    await page.goto(url);
    await targetsAre44(page);
  }
});

test("body text is 16 px", async ({ page }, info) => {
  test.skip(info.project.name !== "phone");
  await page.goto("/split-pdf");
  const size = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  expect(size).toBe("16px");
});
