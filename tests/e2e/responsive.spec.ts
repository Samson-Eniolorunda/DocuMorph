import { expect, test, type Page } from "@playwright/test";
import { TOOL_SLUGS, makePng, noHorizontalScroll, pdfFile, pick, targetsAre44 } from "./helpers";

const WIDTHS = [360, 390, 430, 768, 1280, 1536];
const PAGES = ["/", ...TOOL_SLUGS.map((s) => `/${s}`), "/privacy", "/terms", "/no-such-page"];

async function setTheme(page: Page, dark: boolean) {
  await page.addInitScript((d) => localStorage.setItem("theme", d ? "dark" : "light"), dark);
}

/** In every row of buttons the primary (accent) one is the rightmost; a lone button is not asked to be anywhere. */
async function primaryIsRightmost(page: Page) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const isBtn = (e: Element) => e.matches("button, a[class*='min-h-11'], a[class*='min-h-12']");
    for (const parent of document.querySelectorAll<HTMLElement>("main, [role=dialog], div, footer")) {
      const kids = [...parent.children].filter(
        (e) => isBtn(e) && (e as HTMLElement).offsetParent !== null,
      ) as HTMLElement[];
      if (kids.length < 2) continue;
      const primary = kids.filter((k) => /\bbg-accent\b/.test(k.className));
      if (primary.length !== 1) continue;
      const p = primary[0]!.getBoundingClientRect();
      for (const k of kids) {
        if (k === primary[0]) continue;
        const r = k.getBoundingClientRect();
        const sameRow = Math.abs(r.top - p.top) < 8;
        if ((sameRow && r.left > p.left) || (!sameRow && r.top > p.top))
          out.push(`${k.textContent?.trim().slice(0, 20)} is after ${primary[0]!.textContent?.trim().slice(0, 20)}`);
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
}

async function check(page: Page) {
  await noHorizontalScroll(page);
  await targetsAre44(page);
  await primaryIsRightmost(page);
}

for (const width of WIDTHS) {
  for (const dark of [false, true]) {
    test(`every page at ${width} px, ${dark ? "dark" : "light"}: no sideways scroll, 44 px targets, button order`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own widths");
      await setTheme(page, dark);
      await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
      for (const url of PAGES) {
        await page.goto(url);
        await check(page);
      }
    });

    test(`loaded states at ${width} px, ${dark ? "dark" : "light"}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own widths");
      await setTheme(page, dark);
      await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
      const loads: [string, () => Promise<Parameters<typeof pick>[1]>][] = [
        ["/merge-pdf", async () => [await pdfFile("a.pdf", 2), await pdfFile("b.pdf", 3)]],
        ["/split-pdf", async () => [await pdfFile("s.pdf", 4)]],
        ["/organise-pdf", async () => [await pdfFile("o.pdf", 4)]],
        ["/compress-pdf", async () => [await pdfFile("c.pdf", 2)]],
        ["/resize-image", async () => [{ name: "p.png", mimeType: "image/png", buffer: makePng(64, 64) }]],
        ["/word-to-pdf", async () => []],
      ];
      for (const [url, files] of loads) {
        await page.goto(url);
        const list = await files();
        if (list.length) {
          await pick(page, list);
          await page.waitForTimeout(500);
        }
        await check(page);
      }
    });
  }
}

test("sheets show a drag handle and keep the buttons in order at every phone width", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/merge-pdf");
    await page.getByRole("button", { name: "Tools" }).click();
    const sheet = page.getByRole("dialog", { name: "All tools" });
    await expect(sheet.locator("[data-sheet-handle]").first()).toBeVisible();
    await noHorizontalScroll(page);
    await targetsAre44(page);
    await primaryIsRightmost(page);
  }
});

test("reduced motion removes animations and transitions", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const long = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("*")]
      .filter((e) => {
        const s = getComputedStyle(e);
        return parseFloat(s.transitionDuration) > 0.01 || parseFloat(s.animationDuration) > 0.01;
      })
      .map((e) => e.tagName)
      .slice(0, 5),
  );
  expect(long).toEqual([]);
});

test("the viewport allows safe areas (viewport-fit=cover)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
});
