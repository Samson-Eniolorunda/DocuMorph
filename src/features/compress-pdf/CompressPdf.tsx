"use client";

import { useRef, useState } from "react";
import { Minimize2 } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Choice";
import { Notice, ProgressBar } from "@/components/ui/Feedback";
import { Dropzone } from "@/features/files/Dropzone";
import { Results } from "@/features/files/Results";
import { pdfBlob, readBytes, type OutputFile } from "@/lib/download";
import { explain } from "@/lib/errors";
import { DEVICE_MAX_BYTES, formatBytes, renameTo } from "@/lib/files";
import { largePdfWarning } from "@/lib/limits";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pagesAsPictures } from "./pictures";

type Mode = "tidy" | "screen" | "ebook" | "printer";

/** Resolution and JPEG quality for each level of "pages as pictures". */
const LEVELS = {
  screen: { dpi: 96, quality: 0.6 },
  ebook: { dpi: 130, quality: 0.72 },
  printer: { dpi: 170, quality: 0.82 },
} as const;

export function CompressPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("ebook");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [out, setOut] = useState<{ file: OutputFile; note?: string } | null>(null);
  const cancelled = useRef(false);

  async function run() {
    if (!file) return;
    setError("");
    cancelled.current = false;
    setProgress({ done: 0, total: 0 });
    try {
      const bytes = await readBytes(file);
      const ops = await import("@/lib/pdf/ops");
      let result: Uint8Array;
      if (mode === "tidy") result = await ops.tidyPdf(bytes);
      else {
        const { openPdf, pageToJpeg } = await import("@/lib/pdf/render");
        const pages = await pagesAsPictures<PDFDocumentProxy, Awaited<ReturnType<typeof pageToJpeg>>>(
          bytes,
          LEVELS[mode],
          { open: openPdf, render: pageToJpeg },
          (done, total) => setProgress({ done, total }),
          () => cancelled.current,
        );
        if (!pages) return;
        result = await ops.pdfFromJpegs(pages);
      }
      const blob = pdfBlob(result);
      // A "smaller" file that is not smaller is not offered as a result.
      if (blob.size >= file.size) {
        setOut({
          file: { name: renameTo(file.name, "pdf", "-compressed"), blob: file },
          note:
            mode === "tidy"
              ? "This PDF is already tightly packed, so it could not be made smaller without changing how it looks. The original is returned. Try “Smaller” to turn the pages into pictures."
              : "Compressing this PDF would not make it smaller, so the original is returned unchanged.",
        });
      } else setOut({ file: { name: renameTo(file.name, "pdf", "-compressed"), blob } });
    } catch (e) {
      setError(explain(e));
    } finally {
      setProgress(null);
    }
  }

  const reset = () => {
    setOut(null);
    setFile(null);
    setError("");
  };

  if (out) return <Results files={[out.file]} before={file?.size ?? 0} note={out.note} onReset={reset} />;

  if (!file)
    return (
      <div className="space-y-3">
        <Dropzone kinds={["pdf"]} maxBytes={DEVICE_MAX_BYTES} onFiles={([p]) => setFile(p.file)} />
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );

  const warning = largePdfWarning(file);
  const working = progress !== null;
  const label = progress && progress.total ? `Page ${progress.done} of ${progress.total}` : "Working…";

  return (
    <div className="space-y-5">
      <p className="min-w-0 truncate text-muted">
        {file.name}, <span className="font-mono">{formatBytes(file.size)}</span>
      </p>
      {warning && <Notice tone="warning">{warning}</Notice>}
      <RadioGroup
        legend="How much to compress"
        value={mode}
        onChange={setMode}
        disabled={working}
        options={[
          { value: "tidy", label: "Light, keeps text", hint: "Removes waste. Text stays selectable. Small saving." },
          {
            value: "printer",
            label: "Smaller, good quality",
            hint: "Pages become pictures; text can no longer be selected.",
          },
          {
            value: "ebook",
            label: "Smaller, balanced",
            hint: "Pages become pictures; text can no longer be selected.",
          },
          { value: "screen", label: "Smallest, for the screen", hint: "Pages become pictures at a lower resolution." },
        ]}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <ActionBar
        status={
          working ? (
            <div>
              <p className="mb-1 font-mono">{label}</p>
              <ProgressBar
                label={label}
                value={progress.total ? Math.round((progress.done / progress.total) * 100) : undefined}
              />
            </div>
          ) : undefined
        }
      >
        {working ? (
          <Button variant="secondary" size="lg" onClick={() => (cancelled.current = true)}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" onClick={reset}>
              Change file
            </Button>
            <Button variant="primary" size="lg" onClick={run}>
              <Minimize2 className="size-5" aria-hidden /> Compress PDF
            </Button>
          </>
        )}
      </ActionBar>
    </div>
  );
}
