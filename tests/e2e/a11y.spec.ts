import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { TOOL_SLUGS, pdfFile, pick } from "./helpers";

const PAGES = ["/", "/privacy", "/no-such-page", ...TOOL_SLUGS.map((s) => `/${s}`)];

for (const theme of ["light", "dark"] as const) {
  for (const url of PAGES) {
    test(`axe: ${url} (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual(
        [],
      );
    });
  }
}

test("axe: editor with a document open, and each sheet", async ({ page }) => {
  await page.goto("/edit-pdf");
  await pick(page, [await pdfFile("a.pdf", 2)]);
  await page.locator('[data-page="1"] canvas').waitFor();
  const check = async () => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  };
  await check();
  await page.getByRole("button", { name: "More" }).click();
  await check();
  await page.keyboard.press("Escape");
  await page.getByRole("toolbar", { name: "Editing tools" }).getByRole("button", { name: "Sign" }).click();
  await page.waitForTimeout(400); // let the sheet finish its fade before measuring contrast
  await check();
});
