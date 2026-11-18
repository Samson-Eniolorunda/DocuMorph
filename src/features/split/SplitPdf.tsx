"use client";

import { useState } from "react";
import { Loader2, Scissors } from "lucide-react";
import { Dropzone } from "@/features/files/Dropzone";
import { ErrorNote, Results, explain } from "@/features/files/Results";
import { DEVICE_MAX_BYTES, renameTo } from "@/lib/files";
import { pdfBlob, readBytes, type OutputFile } from "@/lib/download";
import { pageCount, split } from "@/lib/pdf/ops";
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

  async function run() {
    if (!bytes || !file) return;
    setError("");
    let groups: number[][];
    if (mode === "ranges") {
      const r = parseRanges(ranges, pages);
      if (!r.ok) return setError(r.error);
      groups = r.groups;
    } else groups = chunkPages(pages, mode === "each" ? 1 : every);

    setBusy(true);
    try {
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

  if (out)
    return (
      <Results
        files={out}
        zipName={renameTo(file?.name ?? "document.pdf", "zip", "-split")}
        onReset={() => (setOut(null), setFile(null))}
      />
    );

  if (!file)
    return (
      <div className="space-y-3">
        <Dropzone kinds={["pdf"]} maxBytes={DEVICE_MAX_BYTES} onFiles={([p]) => void open(p.file)} />
        <ErrorNote message={error} />
      </div>
    );

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">
        {file.name} · {pages} page{pages === 1 ? "" : "s"}
      </p>
      <fieldset className="space-y-3 text-sm">
        <legend className="mb-2 font-medium">How to split</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "ranges"}
            onChange={() => setMode("ranges")}
            className="accent-[var(--accent)]"
          />{" "}
          Page ranges (one file per range)
        </label>
        {mode === "ranges" && (
          <div className="pl-6">
            <input
              className="field max-w-sm"
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              aria-label="Page ranges"
            />
            <p className="mt-1 text-xs text-subtle">For example: 1-3, 5, 8- (8- means page 8 to the end)</p>
          </div>
        )}
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "every"}
            onChange={() => setMode("every")}
            className="accent-[var(--accent)]"
          />{" "}
          Every
          <input
            type="number"
            min={1}
            max={pages}
            value={every}
            onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))}
            className="field w-20"
            aria-label="Pages per file"
            onFocus={() => setMode("every")}
          />
          pages
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "each"}
            onChange={() => setMode("each")}
            className="accent-[var(--accent)]"
          />{" "}
          Every page as its own file
        </label>
      </fieldset>
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={run}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Scissors className="size-4" />} Split PDF
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setFile(null)}>
          Choose another file
        </button>
      </div>
    </div>
  );
}
