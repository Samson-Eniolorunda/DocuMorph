import { expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { crc32, deflateSync } from "node:zlib";

export const TOOL_SLUGS = [
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
];

export async function makePdf(pages: number, label = "Page") {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${label} ${i + 1}`, { x: 60, y: 760, size: 24 });
  }
  return Buffer.from(await doc.save());
}

/** A valid RGBA PNG; with `noise` the pixels are random, so it cannot be compressed far. */
export function makePng(width: number, height: number, noise = false) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width * 4; x++)
      raw[y * (width * 4 + 1) + 1 + x] = noise ? Math.floor(Math.random() * 256) : (x * 37 + y * 11) % 256;
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const PNG = makePng(2, 2);

export async function pick(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await page.waitForLoadState("networkidle"); // the page must be interactive before a file is chosen
  await page.locator('input[type="file"]:not([capture])').first().setInputFiles(files);
}

export const pdfFile = async (name: string, pages = 1) => ({
  name,
  mimeType: "application/pdf",
  buffer: await makePdf(pages, name),
});

export async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

/** Every button, input and select that is on screen must be at least 44 px high. */
export async function targetsAre44(page: Page) {
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "button, input:not([type=hidden]):not([type=file]):not([type=range]):not([type=checkbox]):not([type=radio]), select, textarea, [role=button]",
      ),
    ]
      .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0)
      .map((e) => ({
        name: e.getAttribute("aria-label") ?? e.textContent?.trim().slice(0, 30) ?? e.tagName,
        h: Math.round(e.getBoundingClientRect().height),
        w: Math.round(e.getBoundingClientRect().width),
      }))
      .filter((e) => (e.h < 44 && e.w < 44) || e.h < 44),
  );
  expect(small, JSON.stringify(small)).toEqual([]);
}
