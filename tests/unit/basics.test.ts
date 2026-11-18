import { describe, expect, it } from "vitest";
import { detectKind, formatBytes, renameTo, savedPercent } from "@/lib/files";
import { chunkPages, groupLabel, pagesInRanges, parseRanges, rangesFromPages } from "@/lib/ranges";
import { displaySize, displayToPdf, placeBox, type PageGeometry } from "@/lib/coords";
import { fitToSize } from "@/lib/target-size";
import { checkLimit, memoryCounter } from "@/server/rate-limit";
import { SERVER_TOOLS, serverToolBySlug } from "@/config/server-tools";

const bytes = (...n: number[]) => new Uint8Array([...n, ...Array(16).fill(0)]);

describe("detectKind", () => {
  it("recognises files by their first bytes, not their names", () => {
    expect(detectKind(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("pdf");
    expect(detectKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(detectKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(detectKind(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("webp");
    expect(detectKind(bytes(0x50, 0x4b, 0x03, 0x04))).toBe("zip-office");
    expect(detectKind(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe("ole-office");
    expect(detectKind(bytes(0x3c, 0x68, 0x74, 0x6d))).toBe("unknown");
  });
});

describe("file names and sizes", () => {
  it("renames safely", () => {
    expect(renameTo("Report.final.pdf", "png")).toBe("Report.final.png");
    expect(renameTo("a/b:c.docx", "pdf", "-signed")).toBe("a-b-c-signed.pdf");
    expect(renameTo("", "pdf")).toBe("file.pdf");
  });
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(savedPercent(1000, 600)).toBe(40);
  });
});

describe("parseRanges", () => {
  it("reads pages, ranges and open ends", () => {
    expect(parseRanges("1-3, 5, 8-", 9)).toEqual({ ok: true, groups: [[0, 1, 2], [4], [7, 8]] });
    expect(parseRanges("2", 2)).toEqual({ ok: true, groups: [[1]] });
  });
  it("explains mistakes", () => {
    expect(parseRanges("", 3).ok).toBe(false);
    expect(parseRanges("4", 3)).toEqual({ ok: false, error: "This document has 3 pages." });
    expect(parseRanges("3-1", 3)).toMatchObject({ ok: false });
    expect(parseRanges("a-b", 3)).toMatchObject({ ok: false });
    expect(parseRanges("0", 3)).toMatchObject({ ok: false });
  });
  it("chunks and labels", () => {
    expect(chunkPages(7, 3)).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
    expect(groupLabel([0, 1, 2])).toBe("1-3");
    expect(groupLabel([4])).toBe("5");
  });
});

describe("coordinates", () => {
  // Forward mapping (PDF to screen) written independently, to check the inverse.
  const pdfToDisplay = (p: PageGeometry, x: number, y: number) => {
    const u = x - p.x0;
    const v = y - p.y0;
    switch (p.rotation) {
      case 90:
        return { dx: v, dy: u };
      case 180:
        return { dx: p.width - u, dy: v };
      case 270:
        return { dx: p.height - v, dy: p.width - u };
      default:
        return { dx: u, dy: p.height - v };
    }
  };
  for (const rotation of [0, 90, 180, 270]) {
    it(`round-trips points on a page rotated ${rotation} degrees`, () => {
      const g = { width: 600, height: 800, x0: 10, y0: 20, rotation };
      const { width, height } = displaySize(g);
      const points: [number, number][] = [
        [0, 0],
        [width, height],
        [123, 45],
      ];
      for (const [dx, dy] of points) {
        const p = displayToPdf(g, dx, dy);
        expect(pdfToDisplay(g, p.x, p.y)).toEqual({ dx, dy });
      }
    });
  }
  it("places boxes from their lower-left corner, turned with the page", () => {
    const g = { width: 600, height: 800, x0: 0, y0: 0, rotation: 0 };
    expect(placeBox(g, 100, 100, 50)).toEqual({ x: 100, y: 650, rotate: 0 });
    expect(placeBox({ ...g, rotation: 90 }, 100, 100, 50).rotate).toBe(90);
  });
});

describe("fitToSize", () => {
  const fake = (q: number) => Promise.resolve(new Blob([new Uint8Array(Math.round(q * 1000))]));
  it("finds the highest quality under the target", async () => {
    const r = await fitToSize(fake, 500);
    expect(r.fits).toBe(true);
    expect(r.blob.size).toBeLessThanOrEqual(500);
    expect(r.quality).toBeGreaterThan(0.45);
  });
  it("says when the target cannot be met", async () => {
    const r = await fitToSize(fake, 10);
    expect(r.fits).toBe(false);
    expect(r.blob.size).toBe(50);
  });
});

describe("rate limit", () => {
  it("allows a visitor up to the limit, then refuses", async () => {
    const opts = { perVisitor: 2, perSite: 0, today: "t1" };
    expect((await checkLimit("a", opts, memoryCounter)).ok).toBe(true);
    expect((await checkLimit("a", opts, memoryCounter)).ok).toBe(true);
    expect(await checkLimit("a", opts, memoryCounter)).toMatchObject({ ok: false, reason: "visitor" });
    expect((await checkLimit("b", opts, memoryCounter)).ok).toBe(true);
  });
  it("applies the site-wide cap", async () => {
    const opts = { perVisitor: 5, perSite: 1, today: "t2" };
    expect((await checkLimit("a", opts, memoryCounter)).ok).toBe(true);
    expect(await checkLimit("b", opts, memoryCounter)).toMatchObject({ ok: false, reason: "site" });
  });
});

describe("server tools", () => {
  it("name the engine and output for each conversion", () => {
    expect(serverToolBySlug("word-to-pdf")).toMatchObject({ engine: "gotenberg", outExt: "pdf" });
    expect(serverToolBySlug("excel-to-pdf")).toMatchObject({ engine: "gotenberg", outExt: "pdf" });
    expect(serverToolBySlug("pdf-to-word")).toMatchObject({ engine: "adobe", outExt: "docx" });
    expect(serverToolBySlug("pdf-to-excel")).toMatchObject({ engine: "adobe", outExt: "xlsx" });
    expect(serverToolBySlug("nope")).toBeUndefined();
    expect(SERVER_TOOLS).toHaveLength(4);
  });
});

describe("page picking from thumbnails", () => {
  it("writes chosen pages as the shortest ranges", () => {
    expect(rangesFromPages([0, 1, 2, 4])).toBe("1-3, 5");
    expect(rangesFromPages([4, 0, 2, 1, 1])).toBe("1-3, 5");
    expect(rangesFromPages([])).toBe("");
    expect(rangesFromPages([6])).toBe("7");
  });
  it("reads typed ranges as chosen pages, and nothing while the text is not valid", () => {
    expect([...pagesInRanges("1-3, 5", 6)]).toEqual([0, 1, 2, 4]);
    expect(pagesInRanges("", 6).size).toBe(0);
    expect(pagesInRanges("9", 6).size).toBe(0);
    expect(pagesInRanges("1-", 3).size).toBe(3);
  });
  it("round-trips", () => {
    expect(rangesFromPages(pagesInRanges("2, 4-5, 9", 9))).toBe("2, 4-5, 9");
  });
});
