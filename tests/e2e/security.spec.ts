import { expect, test } from "@playwright/test";
import { pdfFile, pick } from "./helpers";

test("every page carries a fresh nonce policy and its scripts carry the nonce", async ({ request, page }) => {
  const a = await request.get("/");
  const b = await request.get("/");
  const nonce = (r: typeof a) => /'nonce-([^']+)'/.exec(r.headers()["content-security-policy"] ?? "")?.[1];
  expect(nonce(a)).toBeTruthy();
  expect(nonce(a)).not.toBe(nonce(b));
  expect(a.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  await page.goto("/");
  const bad = await page.evaluate(() => [...document.scripts].filter((s) => !s.nonce && !s.src).length);
  expect(bad).toBe(0);
});

test("pages and tools run with no policy violations, including pdf.js and its worker", async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) =>
      // @ts-expect-error a test hook read back below
      (window.__csp = window.__csp ?? []).push(
        `${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber} ${location.pathname}`,
      ),
    );
  });
  const read = () =>
    page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []).then((v) => violations.push(...v));

  for (const path of ["/", "/privacy", "/terms", "/word-to-pdf"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await read();
  }
  await page.goto("/organise-pdf");
  await pick(page, [await pdfFile("doc.pdf", 2)]);
  await expect(page.getByRole("button", { name: /^Page 2/ })).toBeVisible();
  await page.waitForTimeout(800);
  await read();
  await page.goto("/edit-pdf");
  await pick(page, [await pdfFile("doc.pdf", 1)]);
  await expect(page.locator('[data-page="1"] canvas')).toBeVisible();
  await page.waitForTimeout(500);
  await read();
  expect(violations).toEqual([]);
});
