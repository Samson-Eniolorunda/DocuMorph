"use client";

import { useState } from "react";
import { Scissors } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Choice";
import { Notice } from "@/components/ui/Feedback";
import { RangesField } from "@/components/ui/RangesField";
import { Stepper } from "@/components/ui/Slider";
import { Dropzone } from "@/features/files/Dropzone";
import { Results } from "@/features/files/Results";
import { pdfBlob, readBytes, type OutputFile } from "@/lib/download";
import { explain } from "@/lib/errors";
import { DEVICE_MAX_BYTES, formatBytes, renameTo } from "@/lib/files";
import { chunkPages, groupLabel, parseRanges } from "@/lib/ranges";

type Mode = "ranges" | "every" | "each";

export function SplitPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState(0);
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<OutputFile[] | null>(null);

  async function open(f: File) {
    setError("");
    try {
      const { pageCount } = await import("@/lib/pdf/ops");
      const b = await readBytes(f);
      const n = await pageCount(b);
      setFile(f);
      setBytes(b);
      setPages(n);
      const half = Math.ceil(n / 2);
      const span = (from: number, to: number) => (from === to ? `${from}` : `${from}-${to}`);
      setRanges(n > 1 ? `${span(1, half)}, ${span(half + 1, n)}` : "1");
    } catch (e) {
      setError(explain(e));
    }
  }

  const parsed = mode === "ranges" ? parseRanges(ranges, pages) : null;
  const rangeError = parsed && !parsed.ok ? parsed.error : undefined;

  async function run() {
    if (!bytes || !file) return;
    setError("");
    let groups: number[][];
    if (parsed) {
      if (!parsed.ok) return;
      groups = parsed.groups;
    } else groups = chunkPages(pages, mode === "each" ? 1 : every);

    setBusy(true);
    try {
      const { split } = await import("@/lib/pdf/ops");
      const parts = await split(bytes, groups);
      setOut(
        parts.map((p, i) => ({
          name: renameTo(file.name, "pdf", `-pages-${groupLabel(groups[i] ?? [])}`),
          blob: pdfBlob(p),
        })),
      );
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setOut(null);
    setFile(null);
    setBytes(null);
  };

  if (out)
    return <Results files={out} zipName={renameTo(file?.name ?? "document.pdf", "zip", "-split")} onReset={reset} />;

  if (!file)
    return (
      <div className="space-y-3">
        <Dropzone kinds={["pdf"]} maxBytes={DEVICE_MAX_BYTES} onFiles={([p]) => void open(p.file)} />
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );

  return (
    <div className="space-y-5">
      <p className="min-w-0 truncate text-muted">
        {file.name}, <span className="font-mono">{formatBytes(file.size)}</span>, {pages} page{pages === 1 ? "" : "s"}
      </p>
      <RadioGroup
        legend="How to split"
        value={mode}
        onChange={setMode}
        options={[
          { value: "ranges", label: "By page ranges", hint: "One file for each range." },
          { value: "every", label: "Every few pages" },
          { value: "each", label: "Every page as its own file" },
        ]}
      />
      {mode === "ranges" && (
        <RangesField
          label="Page ranges"
          value={ranges}
          onChange={setRanges}
          error={ranges.trim() ? rangeError : undefined}
          hint="For example 1-3, 5, 8- (8- means page 8 to the end)."
        />
      )}
      {mode === "every" && (
        <Stepper label="Pages per file" value={every} onChange={setEvery} min={1} max={Math.max(1, pages)} />
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <ActionBar>
        <Button variant="secondary" size="lg" onClick={reset}>
          Choose another file
        </Button>
        <Button
          variant="primary"
          size="lg"
          busy={busy}
          disabled={Boolean(rangeError) || (mode === "ranges" && !ranges.trim())}
          onClick={run}
        >
          <Scissors className="size-5" aria-hidden /> Split PDF
        </Button>
      </ActionBar>
    </div>
  );
}
