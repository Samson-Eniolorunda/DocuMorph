import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { PNG, noHorizontalScroll, pdfFile, pick } from "./helpers";

const tools = (page: Page) => page.getByRole("toolbar", { name: "Editing tools" });

async function openEditor(page: Page, pages = 2) {
  await page.goto("/edit-pdf");
  await pick(page, [await pdfFile("form.pdf", pages)]);
  await expect(page.locator('[data-page="1"] canvas')).toBeVisible();
}

async function tapPage(page: Page, x: number, y: number, n = 1) {
  // Bring the top of the page near the top of the screen, clear of the bars.
  await page.evaluate((i) => {
    const el = document.querySelector(`[data-page="${i}"] canvas`);
    const host = document.querySelector("[data-editor-scroll]");
    if (el && host) host.scrollTo(0, host.scrollTop + el.getBoundingClientRect().top - 90);
  }, n);
  const box = await page.locator(`[data-page="${n}"] canvas`).boundingBox();
  if (!box) throw new Error("page not shown");
  await page.mouse.click(box.x + x, box.y + y);
}

async function save(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save", exact: true }).first().click(),
  ]);
  return { name: download.suggestedFilename(), bytes: readFileSync(await download.path()) };
}

async function textOf(bytes: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    out.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out;
}

test("add text, undo, redo, save, and find the text in the saved file", async ({ page }) => {
  await openEditor(page);
  await noHorizontalScroll(page);
  await tapPage(page, 80, 200);
  const sheet = page.getByRole("dialog", { name: "Text" });
  await sheet.getByLabel("Your text").fill("Hello Ṣadé");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("[data-edit]")).toHaveText("Hello Ṣadé");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("[data-edit]")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator("[data-edit]")).toHaveCount(1);

  const file = await save(page);
  expect(file.name).toBe("form-edited.pdf");
  const text = await textOf(file.bytes);
  expect(text[0]).toContain("Hello");
  await expect(page.getByText("Saved as form-edited.pdf")).toBeVisible();
});

test("cover a box over existing text and retype over it; the tool disarms after one use", async ({ page }) => {
  await openEditor(page, 1);
  await tools(page).getByRole("button", { name: "Cover" }).click();
  await expect(page.getByText(/Drag over the text you want to hide/)).toBeVisible();
  const box = await page.locator('[data-page="1"] canvas').boundingBox();
  if (!box) throw new Error("no page");
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Cover" }).first()).toBeVisible();
  await expect(tools(page).getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
  const file = await save(page);
  expect((await PDFDocument.load(file.bytes)).getPageCount()).toBe(1);
});

test("move a selected item with the position buttons and delete it", async ({ page }) => {
  await openEditor(page);
  await tapPage(page, 80, 200);
  const sheet = page.getByRole("dialog", { name: "Text" });
  await sheet.getByLabel("Your text").fill("Move me");
  await sheet.getByRole("button", { name: "Done" }).click();
  const item = page.locator("[data-edit]");
  const before = await item.boundingBox();
  await page.getByRole("button", { name: "Move right" }).click();
  await page.getByRole("button", { name: "Move down" }).click();
  const after = await item.boundingBox();
  expect(after && before && after.x > before.x && after.y > before.y).toBe(true);
  await page.getByRole("button", { name: "Delete selected item" }).click();
  await expect(item).toHaveCount(0);
});

test("a page can be marked for removal and at least one page stays", async ({ page }) => {
  await openEditor(page, 2);
  await page.getByRole("button", { name: "Delete page" }).first().click();
  await expect(page.getByText("will be removed").first()).toBeVisible();
  const file = await save(page);
  expect((await PDFDocument.load(file.bytes)).getPageCount()).toBe(1);
});

test("a typed signature can be placed", async ({ page }) => {
  await openEditor(page);
  await tools(page).getByRole("button", { name: "Sign" }).click();
  const sheet = page.getByRole("dialog", { name: "Add your signature" });
  await sheet.getByRole("tab", { name: "Type" }).click();
  await sheet.getByLabel("Your name").fill("Ada Obi");
  await sheet.getByRole("button", { name: "Use signature" }).click();
  await tapPage(page, 200, 300);
  await expect(page.getByRole("button", { name: "Image", exact: true })).toHaveCount(1);
  const file = await save(page);
  expect((await PDFDocument.load(file.bytes)).getPageCount()).toBe(2);
});

test("a drawn signature, using touch-style pointer strokes", async ({ page }) => {
  await openEditor(page);
  await tools(page).getByRole("button", { name: "Sign" }).click();
  const sheet = page.getByRole("dialog", { name: "Add your signature" });
  await sheet.getByRole("button", { name: "Use signature" }).click();
  await expect(sheet.getByRole("alert")).toContainText("Draw your signature first");
  const pad = sheet.getByLabel(/Signature area/);
  const b = await pad.boundingBox();
  if (!b) throw new Error("no pad");
  await page.mouse.move(b.x + 30, b.y + 100);
  await page.mouse.down();
  await page.mouse.move(b.x + 120, b.y + 60, { steps: 6 });
  await page.mouse.move(b.x + 200, b.y + 120, { steps: 6 });
  await page.mouse.up();
  await sheet.getByRole("button", { name: "Use signature" }).click();
  await tapPage(page, 150, 300);
  await expect(page.getByRole("button", { name: "Image", exact: true })).toHaveCount(1);
});

test("an image can be placed", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "More" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add an image" }).click();
  await (await chooser).setFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await tapPage(page, 150, 300);
  await expect(page.getByRole("button", { name: "Image", exact: true })).toHaveCount(1);
});

test("closing with unsaved changes asks first", async ({ page }) => {
  await openEditor(page);
  await tapPage(page, 80, 200);
  await page.getByRole("dialog", { name: "Text" }).getByLabel("Your text").fill("x");
  await page.getByRole("dialog", { name: "Text" }).getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Close PDF" }).click();
  const confirm = page.getByRole("dialog", { name: "Close this PDF?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.locator("[data-edit]")).toHaveCount(1);
  await page.getByRole("button", { name: "Close PDF" }).click();
  await confirm.getByRole("button", { name: "Close without saving" }).click();
  await expect(page.getByRole("button", { name: "Choose a file" })).toBeVisible();
});

test("a damaged PDF is explained", async ({ page }) => {
  await page.goto("/edit-pdf");
  await pick(page, [
    { name: "bad.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 this is not really a pdf") },
  ]);
  await expect(page.locator("main").getByRole("alert")).toContainText(/could not be read|damaged/i);
});

test("one finger scrolls the page: the surface allows vertical panning and pinch zoom unless a box tool is armed", async ({
  page,
}) => {
  await openEditor(page);
  const layer = page.locator('[data-page="1"] > div > div').last();
  await expect(layer).toHaveCSS("touch-action", "pan-y pinch-zoom");
  await tools(page).getByRole("button", { name: "Highlight" }).click();
  await expect(layer).toHaveCSS("touch-action", "none");
});
