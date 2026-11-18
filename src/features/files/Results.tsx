"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileArchive, RotateCcw, Share2 } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { canShare, download, share, zip, type OutputFile } from "@/lib/download";
import { formatBytes, savedPercent } from "@/lib/files";
import { explain } from "@/lib/errors";
import { isInAppBrowser } from "@/lib/limits";
import { SITE } from "@/config/site";
import { CoffeeLink } from "@/components/layout/CoffeeLink";

export interface Dimensions {
  width: number;
  height: number;
}

/** What a tool produced: files to save or share, the saving, and a way to start again. */
export function Results({
  files,
  before,
  zipName,
  onReset,
  note,
  dimensions,
}: {
  files: OutputFile[];
  before?: number;
  zipName?: string;
  onReset: () => void;
  note?: string | undefined;
  /** Pixel size before and after, for image tools. */
  dimensions?: { before: Dimensions; after: Dimensions } | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = files.reduce((n, f) => n + f.blob.size, 0);
  const saved = before === undefined ? 0 : savedPercent(before, total);
  const multiple = files.length > 1;

  async function run(job: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  const saveAll = () =>
    run(async () => download(multiple ? await zip(files, zipName ?? "documorph-files.zip") : (files[0] as OutputFile)));
  const shareAll = () =>
    run(async () => share(multiple ? [await zip(files, zipName ?? "documorph-files.zip")] : files));

  return (
    <div>
      <section aria-live="polite">
        <h2 className="flex items-center gap-2 text-title font-semibold">
          <CheckCircle2 className="size-6 text-accent" aria-hidden />{" "}
          {multiple ? `${files.length} files are ready` : "Your file is ready"}
        </h2>
        {before !== undefined && (
          <p className="mt-1 text-muted">
            <span className="font-mono">{formatBytes(before)}</span> to{" "}
            <span className="font-mono">{formatBytes(total)}</span>
            {saved > 0 ? `, ${saved}% smaller.` : saved < 0 ? ", larger than the original." : ", the same size."}
          </p>
        )}
        {dimensions && (
          <p className="mt-1 text-muted">
            <span className="font-mono">
              {dimensions.before.width} × {dimensions.before.height}
            </span>{" "}
            to{" "}
            <span className="font-mono">
              {dimensions.after.width} × {dimensions.after.height}
            </span>{" "}
            pixels.
          </p>
        )}
      </section>
      {note && (
        <Notice tone="warning" className="mt-3">
          {note}
        </Notice>
      )}
      {isInAppBrowser() && (
        <Notice tone="warning" className="mt-3" title="Saving may not work in this app">
          Open this page in your browser, such as Safari or Chrome, to save the file.
        </Notice>
      )}
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 py-1 pl-3 pr-1.5">
            <span className="min-w-0">
              <span className="block truncate">{f.name}</span>
              <span className="font-mono text-body-sm text-subtle">{formatBytes(f.blob.size)}</span>
            </span>
            {multiple && (
              <Button variant="ghost" aria-label={`Save ${f.name}`} onClick={() => download(f)}>
                Save
              </Button>
            )}
          </li>
        ))}
      </ul>

      {SITE.coffeeUrl && (
        <p className="mt-4 text-body-sm text-subtle">
          DocuMorph is free and has no adverts. If it saved you time, you can{" "}
          <CoffeeLink inline className="text-accent" />.
        </p>
      )}

      <ActionBar>
        <Button variant="secondary" size="lg" onClick={onReset}>
          <RotateCcw className="size-5" aria-hidden /> Start again
        </Button>
        {canShare(multiple ? [{ name: "x", blob: new Blob() }] : files) && (
          <Button variant="secondary" size="lg" busy={busy} onClick={shareAll}>
            <Share2 className="size-5" aria-hidden /> Share
          </Button>
        )}
        <Button variant="primary" size="lg" busy={busy} onClick={saveAll}>
          {multiple ? <FileArchive className="size-5" aria-hidden /> : <Download className="size-5" aria-hidden />}{" "}
          {multiple ? "Save all as .zip" : "Save"}
        </Button>
      </ActionBar>
    </div>
  );
}
