// Takes screenshots of every page at the review widths, in light and dark.
// Usage: node scripts/screens.mjs <outDir> [baseUrl] [widths, comma separated] [slugs, comma separated]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [out = "docs/rebuild-screens/after", base = "http://127.0.0.1:3100", w = "360,390,430,768,1280,1536", only = ""] =
  process.argv.slice(2);
const widths = w.split(",").map(Number);
const pages = [
  "",
  "edit-pdf",
  "merge-pdf",
  "split-pdf",
  "organise-pdf",
  "images-to-pdf",
  "pdf-to-images",
  "convert-image",
  "resize-image",
  "compress-image",
  "word-to-pdf",
  "pdf-to-word",
  "excel-to-pdf",
  "pdf-to-excel",
  "compress-pdf",
  "privacy",
  "terms",
  "no-such-page",
];
const list = only ? only.split(",") : pages;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ["--no-sandbox"] });
const problems = [];
for (const theme of ["light", "dark"]) {
  for (const width of widths) {
    const ctx = await browser.newContext({
      viewport: { width, height: width < 700 ? 800 : 900 },
      colorScheme: theme,
      deviceScaleFactor: 1,
      hasTouch: width < 700,
    });
    const page = await ctx.newPage();
    for (const slug of list) {
      await page.goto(`${base}/${slug}`, { waitUntil: "networkidle" });
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (over > 0) problems.push(`${slug || "home"} @${width} ${theme}: horizontal overflow ${over}px`);
      await page.screenshot({ path: `${out}/${slug || "home"}-${width}-${theme}.png`, fullPage: false });
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems.length ? problems.join("\n") : "No horizontal overflow on any page.");
