import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { applyEdits, imagesToPdf, merge, organise, pageCount, readFields, split, type Edit } from "../pdf/ops";

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
      { id: "1", type: "text", page: 0, x: 40, y: 40, w: 200, h: 20, text: "Signed\nSecond line", size: 14, color: "#112233", font: "sans", bold: true },
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
    const e: Edit = { id: "u", type: "text", page: 0, x: 0, y: 0, w: 10, h: 10, text: "Ọ mọ", size: 12, color: "#000000", font: "sans", bold: false };
    await expect(applyEdits(await makePdf(1), [e])).rejects.toThrow("standard PDF fonts");
  });

  it("writes Yoruba text with the bundled Unicode font", async () => {
    const { readFile } = await import("node:fs/promises");
    const font = new Uint8Array(await readFile("public/fonts/NotoSans-Regular.ttf"));
    const e: Edit = { id: "y", type: "text", page: 0, x: 20, y: 20, w: 10, h: 10, text: "Ọmọ ẹ ṣe", size: 12, color: "#000000", font: "sans", bold: false };
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
