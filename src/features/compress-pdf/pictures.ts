// Turns each page of a PDF into a JPEG, for the "Smaller" levels of Compress PDF. The pdf.js document is always
// destroyed afterwards (on success, failure and cancellation), so its memory and worker are released.

export interface PictureDeps<Doc extends { numPages: number; loadingTask: { destroy: () => Promise<void> } }, Page> {
  open: (bytes: Uint8Array) => Promise<Doc>;
  render: (doc: Doc, index: number, dpi: number, quality: number) => Promise<Page>;
}

/** Returns the pages, or null when cancelled. */
export async function pagesAsPictures<
  Doc extends { numPages: number; loadingTask: { destroy: () => Promise<void> } },
  Page,
>(
  bytes: Uint8Array,
  level: { dpi: number; quality: number },
  deps: PictureDeps<Doc, Page>,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<Page[] | null> {
  const doc = await deps.open(bytes);
  try {
    const pages: Page[] = [];
    onProgress(0, doc.numPages);
    for (let i = 0; i < doc.numPages; i++) {
      if (isCancelled()) return null;
      pages.push(await deps.render(doc, i, level.dpi, level.quality));
      onProgress(i + 1, doc.numPages);
    }
    return pages;
  } finally {
    await doc.loadingTask.destroy().catch(() => undefined);
  }
}
