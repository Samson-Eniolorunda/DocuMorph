"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { readBytes } from "@/lib/download";
import { explain } from "@/lib/errors";

/** Opens a chosen PDF for preview and keeps one copy of its bytes for the writer. */
export function usePdf() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(f: File): Promise<PDFDocumentProxy | null> {
    setLoading(true);
    setError("");
    try {
      const { openPdf } = await import("@/lib/pdf/render");
      const b = await readBytes(f);
      const d = await openPdf(b);
      setFile(f);
      setBytes(b);
      setDoc(d);
      return d;
    } catch (e) {
      setError(explain(e));
      return null;
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    void doc?.loadingTask.destroy();
    setFile(null);
    setBytes(null);
    setDoc(null);
  }

  // Release pdf.js memory when the page is left.
  useEffect(() => () => void doc?.loadingTask.destroy(), [doc]);

  return { file, bytes, doc, error, loading, load, reset, setError };
}
