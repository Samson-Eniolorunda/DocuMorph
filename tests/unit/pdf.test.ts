import { describe, expect, it, vi } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { PDFDict, PDFHexString, PDFName, PDFNumber } from "pdf-lib";
import {
  applyEdits,
  imagesToPdf,
  merge,
  organise,
  pageCount,
  readFields,
  split,
  tidyPdf,
  type Edit,
} from "@/lib/pdf/ops";
import { pagesAsPictures } from "@/features/compress-pdf/pictures";

async function makePdf(n: number, rotate = 0) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) {
    const p = doc.addPage([600, 800]);
    p.setRotation(degrees(rotate));
    p.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 12 });
  }
  return doc.save();
}

// A 1 x 1 transparent PNG.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("pdf operations", () => {
  it("merges documents in order", async () => {
    expect(await pageCount(await merge([await makePdf(2), await makePdf(3)]))).toBe(5);
  });

  it("reorders, rotates and drops pages", async () => {
    const out = await PDFDocument.load(
      await organise(await makePdf(3), [
        { index: 2, rotate: 90 },
        { index: 0, rotate: 0 },
      ]),
    );
    expect(out.getPageCount()).toBe(2);
    expect(out.getPage(0).getRotation().angle).toBe(90);
    expect(out.getPage(1).getRotation().angle).toBe(0);
  });

  it("adds rotation to pages that are already rotated", async () => {
    const out = await PDFDocument.load(await organise(await makePdf(1, 270), [{ index: 0, rotate: 180 }]));
    expect(out.getPage(0).getRotation().angle).toBe(90);
  });

  it("splits into groups", async () => {
    const parts = await split(await makePdf(5), [[0, 1], [4]]);
    expect(await Promise.all(parts.map(pageCount))).toEqual([2, 1]);
  });

  it("puts each image on its own page", async () => {
    const out = await PDFDocument.load(
      await imagesToPdf(
        [
          { bytes: PNG, kind: "png" },
          { bytes: PNG, kind: "png" },
        ],
        { size: "fit" },
      ),
    );
    expect(out.getPageCount()).toBe(2);
    expect(out.getPage(0).getSize()).toEqual({ width: 1, height: 1 });
  });

  it("writes edits and removes pages", async () => {
    const edits: Edit[] = [
      {
        id: "1",
        type: "text",
        page: 0,
        x: 40,
        y: 40,
        w: 200,
        h: 20,
        text: "Signed\nSecond line",
        size: 14,
        color: "#112233",
        font: "sans",
        bold: true,
      },
      { id: "2", type: "box", page: 0, x: 40, y: 80, w: 100, h: 20, style: "whiteout", color: "#ffffff" },
      { id: "3", type: "image", page: 1, x: 10, y: 10, w: 50, h: 20, bytes: PNG, kind: "png" },
    ];
    const before = await makePdf(3, 90);
    const after = await applyEdits(before, edits, { deletePages: [2] });
    expect(await pageCount(after)).toBe(2);
    expect(after.length).toBeGreaterThan(before.length);
  });

  it("refuses to delete every page", async () => {
    await expect(applyEdits(await makePdf(1), [], { deletePages: [0] })).rejects.toThrow("Keep at least one page.");
  });

  it("asks for a Unicode font for characters outside the standard set", async () => {
    const e: Edit = {
      id: "u",
      type: "text",
      page: 0,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      text: "Ọ mọ",
      size: 12,
      color: "#000000",
      font: "sans",
      bold: false,
    };
    await expect(applyEdits(await makePdf(1), [e])).rejects.toThrow("standard PDF fonts");
  });

  it("writes Yoruba text with the bundled Unicode font", async () => {
    const { readFile } = await import("node:fs/promises");
    const font = new Uint8Array(await readFile("public/fonts/NotoSans-Regular.ttf"));
    const e: Edit = {
      id: "y",
      type: "text",
      page: 0,
      x: 20,
      y: 20,
      w: 10,
      h: 10,
      text: "Ọmọ ẹ ṣe",
      size: 12,
      color: "#000000",
      font: "sans",
      bold: false,
    };
    const out = await applyEdits(await makePdf(1), [e], { loadUnicodeFont: async () => font });
    expect(await pageCount(out)).toBe(1);
  });

  it("reads, fills and flattens forms", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const form = doc.getForm();
    form.createTextField("full_name").addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
    form.createCheckBox("agree").addToPage(page, { x: 50, y: 650, width: 15, height: 15 });
    const bytes = await doc.save();

    expect(await readFields(bytes)).toEqual([
      { name: "full_name", type: "text", value: "", multiline: false },
      { name: "agree", type: "checkbox", value: false },
    ]);

    const filled = await applyEdits(bytes, [], { fields: { full_name: "Ada", agree: true } });
    expect(await readFields(filled)).toEqual([
      { name: "full_name", type: "text", value: "Ada", multiline: false },
      { name: "agree", type: "checkbox", value: true },
    ]);

    const flat = await applyEdits(bytes, [], { fields: { full_name: "Ada" }, flattenForm: true });
    expect(await readFields(flat)).toEqual([]);
  });
});

/** A PDF whose trailer carries an /Encrypt dictionary, as an owner-password-only file does. */
async function ownerPasswordPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]).drawText("Secret", { x: 20, y: 100, size: 12 });
  const dict = PDFDict.withContext(doc.context);
  dict.set(PDFName.of("Filter"), PDFName.of("Standard"));
  dict.set(PDFName.of("V"), PDFNumber.of(1));
  dict.set(PDFName.of("R"), PDFNumber.of(2));
  dict.set(PDFName.of("P"), PDFNumber.of(-3904));
  dict.set(PDFName.of("O"), PDFHexString.of("00".repeat(32)));
  dict.set(PDFName.of("U"), PDFHexString.of("00".repeat(32)));
  doc.context.trailerInfo.Encrypt = doc.context.register(dict);
  return doc.save({ useObjectStreams: false });
}

describe("light compression", () => {
  it("refuses a protected PDF with a clear message instead of writing a corrupt file", async () => {
    await expect(tidyPdf(await ownerPasswordPdf())).rejects.toThrow(
      "This PDF is protected, so it cannot be compressed here.",
    );
  });
  it("still tidies an ordinary PDF", async () => {
    expect(await pageCount(await tidyPdf(await makePdf(2)))).toBe(2);
  });
});

describe("pages as pictures", () => {
  const make = (renderFails = false) => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const doc = { numPages: 3, loadingTask: { destroy } };
    return {
      destroy,
      deps: {
        open: async () => doc,
        render: async (_d: typeof doc, i: number) => {
          if (renderFails && i === 1) throw new Error("render failed");
          return i;
        },
      },
    };
  };
  it("destroys the pdf.js document after success", async () => {
    const { deps, destroy } = make();
    expect(
      await pagesAsPictures(
        new Uint8Array(),
        { dpi: 96, quality: 0.6 },
        deps,
        () => undefined,
        () => false,
      ),
    ).toEqual([0, 1, 2]);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
  it("destroys it after a failure", async () => {
    const { deps, destroy } = make(true);
    await expect(
      pagesAsPictures(
        new Uint8Array(),
        { dpi: 96, quality: 0.6 },
        deps,
        () => undefined,
        () => false,
      ),
    ).rejects.toThrow("render failed");
    expect(destroy).toHaveBeenCalledTimes(1);
  });
  it("destroys it after a cancellation", async () => {
    const { deps, destroy } = make();
    expect(
      await pagesAsPictures(
        new Uint8Array(),
        { dpi: 96, quality: 0.6 },
        deps,
        () => undefined,
        () => true,
      ),
    ).toBeNull();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
