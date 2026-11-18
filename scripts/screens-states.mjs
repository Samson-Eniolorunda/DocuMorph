// Screenshots of tool states (file chosen, working, done, error) at phone and desktop widths.
// Usage: node scripts/screens-states.mjs <outDir> [baseUrl]
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { mkdirSync } from "node:fs";

const [out = "docs/rebuild-screens/states", base = "http://127.0.0.1:3100"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

async function pdf(pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Sample page ${i + 1}`, { x: 60, y: 760, size: 28 });
    p.drawText("Contract between the parties named below.", { x: 60, y: 700, size: 14 });
  }
  return Buffer.from(await doc.save());
}
const file = async (name, pages) => ({ name, mimeType: "application/pdf", buffer: await pdf(pages) });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ["--no-sandbox"] });
for (const [width, height] of [[360, 740], [390, 844], [1280, 800]]) {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, hasTouch: width < 700 });
    const page = await ctx.newPage();
    const shot = (n) => page.screenshot({ path: `${out}/${n}-${width}-${theme}.png` });
    const pick = async (files) => {
      await page.waitForLoadState("networkidle");
      await page.locator('input[type="file"]:not([capture])').first().setInputFiles(files);
    };

    await page.goto(`${base}/merge-pdf`);
    await pick([await file("contract.pdf", 2), await file("payslip-october-2026.pdf", 1), await file("id.pdf", 1)]);
    await page.waitForTimeout(400);
    await shot("merge-files");

    await page.goto(`${base}/split-pdf`);
    await pick([await file("report.pdf", 6)]);
    await page.waitForTimeout(400);
    await shot("split-chosen");

    await page.goto(`${base}/organise-pdf`);
    await pick([await file("report.pdf", 6)]);
    await page.locator("ol button").first().waitFor();
    await page.waitForTimeout(800);
    await page.locator("ol button").nth(1).click();
    await shot("organise");

    await page.goto(`${base}/edit-pdf`);
    await pick([await file("agreement.pdf", 3)]);
    await page.locator('[data-page="1"] canvas').waitFor();
    await page.waitForTimeout(800);
    await shot("editor");
    const box = await page.locator('[data-page="1"] canvas').boundingBox();
    await page.mouse.click(box.x + 70, box.y + 150);
    await page.getByLabel("Your text").fill("Signed in Lagos");
    await page.waitForTimeout(400);
    await shot("editor-text-sheet");
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(300);
    await shot("editor-selected");

    await page.goto(`${base}/word-to-pdf`);
    await shot("server-empty");
    await page.route("**/api/convert", () => undefined);
    await pick([{ name: "letter.docx", mimeType: "application/octet-stream", buffer: Buffer.from([0x50, 0x4b, 3, 4, 1, 2, 3, 4]) }]);
    await page.getByRole("button", { name: "Word to PDF" }).click();
    await page.waitForTimeout(300);
    await shot("server-working");
    await ctx.close();
  }
}
await browser.close();
console.log("done");
