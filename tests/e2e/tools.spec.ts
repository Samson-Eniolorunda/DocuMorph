import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { PNG, makePdf, makePng, noHorizontalScroll, pdfFile, pick } from "./helpers";
import { readFileSync } from "node:fs";

async function saved(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent("download"), click()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: readFileSync(path) };
}

test("merge: three PDFs, reordered, saved as merged.pdf", async ({ page }) => {
  await page.goto("/merge-pdf");
  await pick(page, [await pdfFile("a.pdf", 1), await pdfFile("b.pdf", 2), await pdfFile("c.pdf", 3)]);
  const merge = page.getByRole("button", { name: "Merge 3 PDFs" });
  await expect(merge).toBeEnabled();
  await page.getByRole("button", { name: "Move c.pdf up" }).click();
  await page.getByRole("button", { name: "Move c.pdf up" }).click();
  await expect(page.locator("ol li").first()).toContainText("c.pdf");
  await noHorizontalScroll(page);
  await merge.click();
  await expect(page.getByText("Your file is ready")).toBeVisible();
  const file = await saved(page, () => page.getByRole("button", { name: "Save", exact: true }).click());
  expect(file.name).toBe("merged.pdf");
  expect((await PDFDocument.load(file.bytes)).getPageCount()).toBe(6);
});

test("merge: needs two PDFs and says so", async ({ page }) => {
  await page.goto("/merge-pdf");
  await pick(page, [await pdfFile("a.pdf")]);
  await expect(page.getByRole("button", { name: /Merge 1 PDFs/ })).toBeDisabled();
  await expect(page.getByText("Add at least two PDFs to merge them.")).toBeVisible();
});

test("a renamed file is refused by its contents", async ({ page }) => {
  await page.goto("/merge-pdf");
  await pick(page, [{ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf at all") }]);
  await expect(page.locator("main").getByRole("alert")).toContainText("fake.pdf");
  await expect(page.getByRole("button", { name: /Merge/ })).toHaveCount(0);
});

test("split: ranges, a mistyped range is explained, results zip", async ({ page }) => {
  await page.goto("/split-pdf");
  await pick(page, [await pdfFile("doc.pdf", 6)]);
  const field = page.getByRole("textbox", { name: "Page ranges" });
  await expect(field).toHaveValue("1-3, 4-6");
  await field.fill("9");
  await expect(page.locator("main").getByRole("alert")).toContainText(/page/i);
  await expect(page.getByRole("button", { name: "Split PDF" })).toBeDisabled();
  await field.fill("1-2, 5");
  await page.getByRole("button", { name: "Split PDF" }).click();
  await expect(page.getByText("2 files are ready")).toBeVisible();
  const zip = await saved(page, () => page.getByRole("button", { name: "Save all as .zip" }).click());
  expect(zip.name).toBe("doc-split.zip");
});

test("organise: rotate, delete and save", async ({ page }) => {
  await page.goto("/organise-pdf");
  await pick(page, [await pdfFile("doc.pdf", 3)]);
  await page.getByRole("button", { name: /^Page 1/ }).click();
  await page.getByRole("button", { name: "Right" }).click();
  await page.getByRole("button", { name: /^Page 2/ }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Save PDF" }).click();
  const file = await saved(page, () => page.getByRole("button", { name: "Save", exact: true }).click());
  expect(file.name).toBe("doc-organised.pdf");
  const out = await PDFDocument.load(file.bytes);
  expect(out.getPageCount()).toBe(2);
  expect(out.getPage(0).getRotation().angle).toBe(90);
});

test("images to PDF", async ({ page }) => {
  await page.goto("/images-to-pdf");
  await expect(page.getByRole("button", { name: "Take a photo" })).toBeVisible();
  await pick(page, [
    { name: "one.png", mimeType: "image/png", buffer: PNG },
    { name: "two.png", mimeType: "image/png", buffer: PNG },
  ]);
  await page.getByRole("button", { name: "Create PDF from 2 images" }).click();
  const file = await saved(page, () => page.getByRole("button", { name: "Save", exact: true }).click());
  expect(file.name).toBe("images.pdf");
  expect((await PDFDocument.load(file.bytes)).getPageCount()).toBe(2);
});

test("PDF to images with a zip", async ({ page }) => {
  await page.goto("/pdf-to-images");
  await pick(page, [await pdfFile("doc.pdf", 2)]);
  await page.getByRole("button", { name: "Create images" }).click();
  await expect(page.getByText("2 files are ready")).toBeVisible();
  const zip = await saved(page, () => page.getByRole("button", { name: "Save all as .zip" }).click());
  expect(zip.name).toBe("doc-images.zip");
});

test("resize an image, showing its size before and after", async ({ page }) => {
  await page.goto("/resize-image");
  await pick(page, [{ name: "tiny.png", mimeType: "image/png", buffer: PNG }]);
  await expect(page.getByText("2 × 2 px")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resize 1 image" })).toBeDisabled();
  await page.getByLabel("Width (px)").fill("10");
  await page.getByRole("button", { name: "Resize 1 image" }).click();
  await expect(page.getByText("2 × 2")).toBeVisible();
  await expect(page.getByText("10 × 10")).toBeVisible();
});

test("convert an image to JPG and compress to a target that cannot be met", async ({ page }) => {
  await page.goto("/convert-image");
  await pick(page, [{ name: "tiny.png", mimeType: "image/png", buffer: PNG }]);
  await page.getByRole("button", { name: "Convert 1 image" }).click();
  const file = await saved(page, () => page.getByRole("button", { name: "Save", exact: true }).click());
  expect(file.name).toBe("tiny.jpg");

  await page.goto("/compress-image");
  await pick(page, [{ name: "noise.png", mimeType: "image/png", buffer: makePng(500, 500, true) }]);
  await page.getByLabel("To a file size").check();
  await page.getByLabel("Largest size per image").fill("5");
  await page.getByLabel("Unit").selectOption("KB");
  await page.getByRole("button", { name: "Compress 1 image" }).click();
  await expect(page.getByText("Your file is ready")).toBeVisible();
  await expect(page.locator("main").getByRole("status")).toContainText("could not reach 5 KB");
});

test("the device tools send no file and contact no other site", async ({ page }) => {
  const requests: { url: string; method: string; size: number }[] = [];
  page.on("request", (r) => requests.push({ url: r.url(), method: r.method(), size: r.postDataBuffer()?.length ?? 0 }));
  await page.goto("/merge-pdf");
  await pick(page, [await pdfFile("a.pdf"), await pdfFile("b.pdf")]);
  await page.getByRole("button", { name: "Merge 2 PDFs" }).click();
  await expect(page.getByText("Your file is ready")).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(
    requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith("data:") && !r.url.startsWith("blob:")),
  ).toEqual([]);
  expect(requests.filter((r) => r.method !== "GET" || r.size > 0)).toEqual([]);
});

test("makePdf helper gives a readable PDF", async () => {
  expect((await PDFDocument.load(await makePdf(2))).getPageCount()).toBe(2);
});
