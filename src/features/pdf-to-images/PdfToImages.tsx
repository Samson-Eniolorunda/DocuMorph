"use client";

import { useState } from "react";
import { FileImage, Loader2 } from "lucide-react";
import { Dropzone } from "@/features/files/Dropzone";
import { ErrorNote, Results, explain } from "@/features/files/Results";
import { usePdf } from "@/features/files/usePdf";
import { DEVICE_MAX_BYTES, renameTo } from "@/lib/files";
import type { OutputFile } from "@/lib/download";
import { pageToImage } from "@/lib/pdf/render";
import { parseRanges } from "@/lib/ranges";

const DPI = [
  [72, "Screen (72 dpi)"],
  [150, "Standard (150 dpi)"],
  [300, "Print (300 dpi)"],
] as const;

export function PdfToImages() {
  const pdf = usePdf();
  const [format, setFormat] = useState<"image/png" | "image/jpeg">("image/png");
  const [dpi, setDpi] = useState(150);
  const [which, setWhich] = useState("");
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");
  const [out, setOut] = useState<OutputFile[] | null>(null);

  async function run() {
    const { doc, file } = pdf;
    if (!doc || !file) return;
    const n = doc.numPages;
    let pages = Array.from({ length: n }, (_, i) => i);
    if (which.trim()) {
      const r = parseRanges(which, n);
      if (!r.ok) return setError(r.error);
      pages = [...new Set(r.groups.flat())];
    }
    setError("");
    try {
      const files: OutputFile[] = [];
      for (const [k, i] of pages.entries()) {
        setProgress(`Page ${k + 1} of ${pages.length}…`);
        const blob = await pageToImage(doc, i, dpi, format);
        files.push({ name: renameTo(file.name, format === "image/png" ? "png" : "jpg", `-page-${i + 1}`), blob });
      }
      setOut(files);
    } catch (e) {
      setError(explain(e));
    } finally {
      setProgress("");
    }
  }

  if (out)
    return (
      <Results
        files={out}
        zipName={renameTo(pdf.file?.name ?? "document.pdf", "zip", "-images")}
        onReset={() => (setOut(null), pdf.reset())}
      />
    );

  if (!pdf.doc)
    return (
      <div className="space-y-3">
        <Dropzone kinds={["pdf"]} maxBytes={DEVICE_MAX_BYTES} onFiles={([p]) => void pdf.load(p.file)} />
        {pdf.loading && <p className="text-sm text-muted">Opening…</p>}
        <ErrorNote message={pdf.error} />
      </div>
    );

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">
        {pdf.file?.name} · {pdf.doc.numPages} page{pdf.doc.numPages === 1 ? "" : "s"}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          Format
          <select className="field mt-1" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="image/png">PNG (sharpest)</option>
            <option value="image/jpeg">JPG (smaller)</option>
          </select>
        </label>
        <label className="text-sm">
          Resolution
          <select className="field mt-1" value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
            {DPI.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Pages (blank for all)
          <input
            className="field mt-1"
            placeholder="e.g. 1-3, 6"
            value={which}
            onChange={(e) => setWhich(e.target.value)}
          />
        </label>
      </div>
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={!!progress} onClick={run}>
          {progress ? <Loader2 className="size-4 animate-spin" /> : <FileImage className="size-4" />}{" "}
          {progress || "Create images"}
        </button>
        <button type="button" className="btn btn-quiet" disabled={!!progress} onClick={pdf.reset}>
          Choose another file
        </button>
      </div>
    </div>
  );
}
