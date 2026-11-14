// Page rendering with pdf.js (browser only). The library and its worker are
// loaded on first use, from this site, so pages that do not show PDFs stay light.

import type { PDFDocumentProxy } from "pdfjs-dist";

let lib: Promise<typeof import("pdfjs-dist")> | null = null;

function pdfjs() {
  lib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return m;
  });
  return lib;
}

export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  // pdf.js takes ownership of the buffer it is given, so pass a copy.
  return m.getDocument({ data: bytes.slice() }).promise;
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** Size of the page as displayed, in PDF points (scale 1). */
  width: number;
  height: number;
}

/** Draws page `index` (zero-based) at `cssWidth` pixels wide, sharp on high-density screens. */
export async function renderPage(doc: PDFDocumentProxy, index: number, cssWidth: number, canvas = document.createElement("canvas")): Promise<RenderedPage> {
  const page = await doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${(cssWidth * base.height) / base.width}px`;
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
  page.cleanup();
  return { canvas, width: base.width, height: base.height };
}

/** Renders a page to an image file at a given resolution (dots per inch). */
export async function pageToImage(doc: PDFDocumentProxy, index: number, dpi: number, type: "image/png" | "image/jpeg", quality = 0.92) {
  const page = await doc.getPage(index + 1);
  const viewport = page.getViewport({ scale: dpi / 72 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  canvas.width = canvas.height = 0; // release memory on phones
  if (!blob) throw new Error("This browser could not create the image.");
  return blob;
}
