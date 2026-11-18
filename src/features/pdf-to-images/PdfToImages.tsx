"use client";

import { useRef, useState } from "react";
import { FileImage } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Notice, ProgressBar } from "@/components/ui/Feedback";
import { RangesField } from "@/components/ui/RangesField";
import { Dropzone } from "@/features/files/Dropzone";
import { Results } from "@/features/files/Results";
import { usePdf } from "@/features/files/usePdf";
import type { OutputFile } from "@/lib/download";
import { explain } from "@/lib/errors";
import { DEVICE_MAX_BYTES, formatBytes, renameTo } from "@/lib/files";
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [out, setOut] = useState<OutputFile[] | null>(null);
  const cancelled = useRef(false);

  const n = pdf.doc?.numPages ?? 0;
  const parsed = which.trim() ? parseRanges(which, n) : null;
  const rangeError = parsed && !parsed.ok ? parsed.error : undefined;

  async function run() {
    const { doc, file } = pdf;
    if (!doc || !file) return;
    let pages = Array.from({ length: n }, (_, i) => i);
    if (parsed) {
      if (!parsed.ok) return;
      pages = [...new Set(parsed.groups.flat())];
    }
    setError("");
    setNote("");
    cancelled.current = false;
    try {
      const { pageToImage } = await import("@/lib/pdf/render");
      const files: OutputFile[] = [];
      let scaledDown = false;
      for (const [k, i] of pages.entries()) {
        if (cancelled.current) return;
        setProgress({ done: k, total: pages.length });
        const r = await pageToImage(doc, i, dpi, format);
        scaledDown ||= r.scaledDown;
        files.push({
          name: renameTo(file.name, format === "image/png" ? "png" : "jpg", `-page-${i + 1}`),
          blob: r.blob,
        });
      }
      if (scaledDown)
        setNote(
          "Some pages were too large to draw at this resolution on this device, so they were saved at a lower one.",
        );
      setOut(files);
    } catch (e) {
      setError(explain(e));
    } finally {
      setProgress(null);
    }
  }

  const reset = () => {
    setOut(null);
    pdf.reset();
  };

  if (out)
    return (
      <Results
        files={out}
        note={note}
        zipName={renameTo(pdf.file?.name ?? "document.pdf", "zip", "-images")}
        onReset={reset}
      />
    );

  if (!pdf.doc)
    return (
      <div className="space-y-3">
        <Dropzone kinds={["pdf"]} maxBytes={DEVICE_MAX_BYTES} onFiles={([p]) => void pdf.load(p.file)} />
        {pdf.loading && <p className="text-muted">Opening…</p>}
        {pdf.error && <Notice tone="error">{pdf.error}</Notice>}
      </div>
    );

  return (
    <div className="space-y-5">
      <p className="min-w-0 truncate text-muted">
        {pdf.file?.name}, <span className="font-mono">{formatBytes(pdf.file?.size ?? 0)}</span>, {n} page
        {n === 1 ? "" : "s"}
      </p>
      <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
        <option value="image/png">PNG (sharpest)</option>
        <option value="image/jpeg">JPG (smaller)</option>
      </Select>
      <Select label="Resolution" value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
        {DPI.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <RangesField
        label="Pages (leave blank for all)"
        value={which}
        onChange={setWhich}
        error={rangeError}
        placeholder="For example 1-3, 6"
      />
      {error && <Notice tone="error">{error}</Notice>}
      <ActionBar
        status={
          progress ? (
            <div>
              <p className="mb-1 font-mono">
                Page {Math.min(progress.done + 1, progress.total)} of {progress.total}
              </p>
              <ProgressBar label="Creating images" value={(progress.done / progress.total) * 100} />
            </div>
          ) : undefined
        }
      >
        {progress ? (
          <Button variant="secondary" size="lg" onClick={() => (cancelled.current = true)}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" onClick={pdf.reset}>
              Change file
            </Button>
            <Button variant="primary" size="lg" disabled={Boolean(rangeError)} onClick={run}>
              <FileImage className="size-5" aria-hidden /> Create images
            </Button>
          </>
        )}
      </ActionBar>
    </div>
  );
}
