"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileArchive, RotateCcw } from "lucide-react";
import { download, zip, type OutputFile } from "@/lib/download";
import { formatBytes, savedPercent } from "@/lib/files";

/** What a tool produced: one or more files to save, and a way to start again. */
export function Results({
  files,
  before,
  zipName,
  onReset,
  note,
}: {
  files: OutputFile[];
  before?: number;
  zipName?: string;
  onReset: () => void;
  note?: string | undefined;
}) {
  const [zipping, setZipping] = useState(false);
  const total = files.reduce((n, f) => n + f.blob.size, 0);

  async function all() {
    setZipping(true);
    try {
      download(await zip(files, zipName ?? "documorph-files.zip"));
    } finally {
      setZipping(false);
    }
  }

  return (
    <section aria-live="polite" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-5 text-accent" />{" "}
        {files.length === 1 ? "Your file is ready." : `${files.length} files are ready.`}
      </p>
      {before !== undefined && (
        <p className="mt-1 text-sm text-muted">
          {formatBytes(before)} → {formatBytes(total)}
          {savedPercent(before, total) > 0
            ? ` (${savedPercent(before, total)}% smaller)`
            : savedPercent(before, total) < 0
              ? " (larger than the original)"
              : ""}
        </p>
      )}
      {note && <p className="mt-1 text-sm text-warn">{note}</p>}

      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm">{f.name}</span>
              <span className="text-xs text-subtle">{formatBytes(f.blob.size)}</span>
            </span>
            <button type="button" className="btn btn-quiet shrink-0 px-3 py-1.5" onClick={() => download(f)}>
              <Download className="size-4" /> Save
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        {files.length > 1 && (
          <button type="button" className="btn btn-primary" onClick={all} disabled={zipping}>
            <FileArchive className="size-4" /> {zipping ? "Preparing…" : "Save all as .zip"}
          </button>
        )}
        {files.length === 1 && files[0] && (
          <button type="button" className="btn btn-primary" onClick={() => files[0] && download(files[0])}>
            <Download className="size-4" /> Save file
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={onReset}>
          <RotateCcw className="size-4" /> Start again
        </button>
      </div>
    </section>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}

/** Turns any thrown value into a sentence people can act on. */
export function explain(err: unknown, fallback = "Something went wrong. Please try again.") {
  const msg = err instanceof Error ? err.message : "";
  if (/encrypt|password/i.test(msg))
    return "This PDF is password-protected. Remove the password first, then try again.";
  if (/Invalid PDF|No PDF header|Failed to parse/i.test(msg))
    return "This file could not be read as a PDF. It may be damaged.";
  return msg || fallback;
}
