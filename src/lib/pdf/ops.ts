// PDF operations with pdf-lib. Pure functions over bytes: they run in the
// browser for the tools and in Node for the tests.

import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFFont,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { normaliseRotation, placeBox, type PageGeometry } from "../coords";

// pdf-lib refuses encrypted files unless told otherwise; owner-password-only
// files (common for "no editing" flags) still open with this option.
const LOAD = { ignoreEncryption: true } as const;

export async function pageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes, LOAD)).getPageCount();
}

export function geometryOf(page: PDFPage): PageGeometry {
  const box = page.getCropBox();
  return {
    width: box.width,
    height: box.height,
    x0: box.x,
    y0: box.y,
    rotation: normaliseRotation(page.getRotation().angle),
  };
}

/* ---------- Merge, organise, split ---------- */

export async function merge(files: Uint8Array[]) {
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes, LOAD);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

/** Builds a new PDF from pages of `bytes`, in the given order, each turned by `rotate` degrees clockwise. */
export async function organise(bytes: Uint8Array, pages: { index: number; rotate: number }[]) {
  if (!pages.length) throw new Error("Keep at least one page.");
  const src = await PDFDocument.load(bytes, LOAD);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    pages.map((p) => p.index),
  );
  copied.forEach((page, i) => {
    const turn = normaliseRotation(page.getRotation().angle + (pages[i]?.rotate ?? 0));
    page.setRotation(degrees(turn));
    out.addPage(page);
  });
  return out.save();
}

export async function split(bytes: Uint8Array, groups: number[][]) {
  return Promise.all(
    groups.map((g) =>
      organise(
        bytes,
        g.map((index) => ({ index, rotate: 0 })),
      ),
    ),
  );
}

/* ---------- Images to PDF ---------- */

export interface PdfImageInput {
  bytes: Uint8Array;
  kind: "jpg" | "png";
}

export type PageSize = "fit" | "a4" | "letter";
const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;

export async function imagesToPdf(
  images: PdfImageInput[],
  { size = "a4", margin = 24 }: { size?: PageSize; margin?: number } = {},
) {
  const out = await PDFDocument.create();
  for (const img of images) {
    const embedded = img.kind === "png" ? await out.embedPng(img.bytes) : await out.embedJpg(img.bytes);
    if (size === "fit") {
      const page = out.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      continue;
    }
    // Portrait or landscape to suit the image, then scale it to fit inside the margins.
    const [a, b] = SIZES[size];
    const landscape = embedded.width > embedded.height;
    const [pw, ph] = landscape ? [b, a] : [a, b];
    const page = out.addPage([pw, ph]);
    const scale = Math.min((pw - margin * 2) / embedded.width, (ph - margin * 2) / embedded.height, 1);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return out.save();
}

/** Builds a PDF whose pages are JPEG pictures drawn at the given size in points (used to shrink scanned or image-heavy PDFs). */
export async function pdfFromJpegs(pages: { bytes: Uint8Array; width: number; height: number }[]) {
  const out = await PDFDocument.create();
  for (const p of pages) {
    const image = await out.embedJpg(p.bytes);
    out.addPage([p.width, p.height]).drawImage(image, { x: 0, y: 0, width: p.width, height: p.height });
  }
  return out.save();
}

/** A lossless tidy-up: drops metadata and packs objects into compressed streams. Text stays text. */
export async function tidyPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, LOAD);
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("DocuMorph");
  doc.setCreator("DocuMorph");
  return doc.save({ useObjectStreams: true });
}

/* ---------- Forms ---------- */

export type FieldInfo =
  | { name: string; type: "text"; value: string; multiline: boolean }
  | { name: string; type: "checkbox"; value: boolean }
  | { name: string; type: "choice"; value: string; options: string[] };

export async function readFields(bytes: Uint8Array): Promise<FieldInfo[]> {
  const doc = await PDFDocument.load(bytes, LOAD);
  const out: FieldInfo[] = [];
  for (const f of doc.getForm().getFields()) {
    const name = f.getName();
    if (f instanceof PDFTextField)
      out.push({ name, type: "text", value: f.getText() ?? "", multiline: f.isMultiline() });
    else if (f instanceof PDFCheckBox) out.push({ name, type: "checkbox", value: f.isChecked() });
    else if (f instanceof PDFDropdown || f instanceof PDFOptionList)
      out.push({ name, type: "choice", value: f.getSelected()[0] ?? "", options: f.getOptions() });
    else if (f instanceof PDFRadioGroup)
      out.push({ name, type: "choice", value: f.getSelected() ?? "", options: f.getOptions() });
  }
  return out;
}

/* ---------- Editing ---------- */

export type FontFamily = "sans" | "serif" | "mono";

interface Base {
  id: string;
  /** Zero-based page index in the original document. */
  page: number;
  /** Position and size on the page as displayed, in points, from the top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Edit =
  | (Base & {
      type: "text";
      text: string;
      size: number;
      color: string;
      font: FontFamily;
      bold: boolean;
      /** Distance from the top of a line to its baseline, as a share of the size (from the editor's screen font). */
      baseline?: number;
    })
  | (Base & { type: "box"; style: "whiteout" | "highlight" | "outline"; color: string })
  | (Base & { type: "image"; bytes: Uint8Array; kind: "png" | "jpg" });

export interface EditOptions {
  fields?: Record<string, string | boolean>;
  flattenForm?: boolean;
  deletePages?: number[];
  /** Supplies a Unicode font when text uses characters the standard fonts lack. */
  loadUnicodeFont?: () => Promise<Uint8Array>;
}

export function hexToRgb(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return rgb(0, 0, 0);
  const digits = m[1] ?? "000000";
  const full = digits.length === 3 ? digits.replace(/(.)/g, "$1$1") : digits;
  const n = parseInt(full, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const STANDARD: Record<FontFamily, [StandardFonts, StandardFonts]> = {
  sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
  mono: [StandardFonts.Courier, StandardFonts.CourierBold],
};

/** True when a standard PDF font can draw every character (Western European set). */
export function fitsStandardFont(font: PDFFont, text: string) {
  try {
    font.encodeText(text.replace(/\n/g, ""));
    return true;
  } catch {
    return false;
  }
}

export const LINE_HEIGHT = 1.2;

async function setFields(doc: PDFDocument, fields: Record<string, string | boolean>) {
  const form = doc.getForm();
  for (const [name, value] of Object.entries(fields)) {
    const f = form.getFieldMaybe(name);
    if (!f) continue;
    if (f instanceof PDFTextField) f.setText(String(value));
    else if (f instanceof PDFCheckBox) {
      if (value) f.check();
      else f.uncheck();
    } else if ((f instanceof PDFDropdown || f instanceof PDFOptionList) && value) f.select(String(value));
    else if (f instanceof PDFRadioGroup && value) f.select(String(value));
  }
}

export async function applyEdits(bytes: Uint8Array, edits: Edit[], opts: EditOptions = {}) {
  const doc = await PDFDocument.load(bytes, LOAD);
  const pages = doc.getPages();
  const fontCache = new Map<string, PDFFont>();
  let unicode: PDFFont | null = null;

  const fontFor = async (e: Extract<Edit, { type: "text" }>) => {
    const key = `${e.font}-${e.bold}`;
    let std = fontCache.get(key);
    if (!std) {
      std = await doc.embedFont(STANDARD[e.font][e.bold ? 1 : 0]);
      fontCache.set(key, std);
    }
    if (fitsStandardFont(std, e.text)) return std;
    if (!opts.loadUnicodeFont) throw new Error("Some characters cannot be written with the standard PDF fonts.");
    if (!unicode) {
      doc.registerFontkit(fontkit);
      unicode = await doc.embedFont(await opts.loadUnicodeFont(), { subset: true });
    }
    return unicode;
  };

  if (opts.fields && Object.keys(opts.fields).length) await setFields(doc, opts.fields);

  for (const e of edits) {
    const page = pages[e.page];
    if (!page) continue;
    const g = geometryOf(page);

    if (e.type === "box") {
      const at = placeBox(g, e.x, e.y, e.h);
      const common = { x: at.x, y: at.y, width: e.w, height: e.h, rotate: degrees(at.rotate) };
      if (e.style === "whiteout") page.drawRectangle({ ...common, color: hexToRgb(e.color || "#ffffff") });
      else if (e.style === "highlight")
        page.drawRectangle({ ...common, color: hexToRgb(e.color || "#ffe14d"), opacity: 0.4 });
      else page.drawRectangle({ ...common, borderColor: hexToRgb(e.color || "#d92d20"), borderWidth: 1.5 });
    } else if (e.type === "image") {
      const img = e.kind === "png" ? await doc.embedPng(e.bytes) : await doc.embedJpg(e.bytes);
      const at = placeBox(g, e.x, e.y, e.h);
      page.drawImage(img, { x: at.x, y: at.y, width: e.w, height: e.h, rotate: degrees(at.rotate) });
    } else if (e.type === "text" && e.text.trim()) {
      const font = await fontFor(e);
      const ascent = e.baseline !== undefined ? e.baseline * e.size : font.heightAtSize(e.size, { descender: false });
      e.text.split("\n").forEach((line, i) => {
        // Baseline of each line, measured on the displayed page.
        const baseline = e.y + ascent + i * e.size * LINE_HEIGHT;
        const at = placeBox(g, e.x, baseline, 0);
        page.drawText(line, {
          x: at.x,
          y: at.y,
          size: e.size,
          font,
          color: hexToRgb(e.color),
          rotate: degrees(at.rotate),
        });
      });
    }
  }

  if (opts.flattenForm) doc.getForm().flatten();

  const remove = [...new Set(opts.deletePages ?? [])].filter((i) => i >= 0 && i < pages.length).sort((a, b) => b - a);
  if (remove.length >= pages.length) throw new Error("Keep at least one page.");
  remove.forEach((i) => doc.removePage(i));

  return doc.save();
}
