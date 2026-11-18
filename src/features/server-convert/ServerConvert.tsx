"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { Dropzone } from "@/features/files/Dropzone";
import { ErrorNote } from "@/features/files/Results";
import { SERVER_MAX_BYTES, formatBytes } from "@/lib/files";
import { serverToolBySlug, type ServerTool } from "@/config/server-tools";

type Done = { name: string; size: number; url: string; fileId: string; before: number };

export function ServerConvert({ slug }: { slug: string }) {
  const tool = serverToolBySlug(slug);
  if (!tool) return null;
  return <ServerConvertTool tool={tool} />;
}

function ServerConvertTool({ tool }: { tool: ServerTool }) {
  const [file, setFile] = useState<File | null>(null);
  const [option, setOption] = useState(tool.option?.default ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [deleted, setDeleted] = useState<"" | "deleting" | "deleted" | "failed">("");

  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("tool", tool.slug);
      body.set("file", file);
      if (tool.option) body.set("option", option);
      const res = await fetch("/api/convert", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as Partial<Done> & { error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "The file could not be converted. Please try again.");
      if (data.name === undefined || data.size === undefined || data.fileId === undefined)
        throw new Error("The file could not be converted. Please try again.");
      setDone({ name: data.name, size: data.size, url: data.url, fileId: data.fileId, before: file.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file could not be converted.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!done) return;
    setDeleted("deleting");
    const res = await fetch(`/api/convert?fileId=${encodeURIComponent(done.fileId)}`, { method: "DELETE" }).catch(
      () => null,
    );
    setDeleted(res?.ok ? "deleted" : "failed");
  }

  const reset = () => {
    setDone(null);
    setFile(null);
    setDeleted("");
  };

  if (done)
    return (
      <section aria-live="polite" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-5 text-accent" /> Your file is ready.
        </p>
        <p className="mt-1 text-sm text-muted">
          {done.name} · {formatBytes(done.before)} → {formatBytes(done.size)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {deleted !== "deleted" && (
            <a
              href={done.url}
              className="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
              download={done.name}
            >
              <Download className="size-4" /> Download
            </a>
          )}
          <button
            type="button"
            className="btn btn-quiet"
            onClick={remove}
            disabled={deleted === "deleting" || deleted === "deleted"}
          >
            <Trash2 className="size-4" />{" "}
            {deleted === "deleted" ? "Deleted from the server" : deleted === "deleting" ? "Deleting…" : "Delete it now"}
          </button>
          <button type="button" className="btn btn-quiet" onClick={reset}>
            <RotateCcw className="size-4" /> Convert another
          </button>
        </div>
        <p className="mt-3 text-xs text-subtle">
          {deleted === "failed"
            ? "It could not be deleted just now; ConvertAPI removes it automatically within 3 hours."
            : "ConvertAPI keeps the converted file for up to 3 hours so you can download it. Delete it as soon as you have it."}
        </p>
      </section>
    );

  return (
    <div className="space-y-4">
      {!file ? (
        <Dropzone
          kinds={tool.kinds}
          extensions={tool.accept}
          maxBytes={SERVER_MAX_BYTES}
          onFiles={([p]) => setFile(p.file)}
        />
      ) : (
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm">
            {file.name} <span className="text-subtle">· {formatBytes(file.size)}</span>
          </p>
          {tool.option && (
            <label className="block max-w-sm text-sm">
              {tool.option.label}
              <select className="field mt-1" value={option} onChange={(e) => setOption(e.target.value)}>
                {tool.option.values.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ErrorNote message={error} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={run}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}{" "}
              {busy ? "Converting…" : tool.name}
            </button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setFile(null)}>
              Choose another file
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-subtle">
        This tool sends your file to ConvertAPI for conversion. DocuMorph does not store it. Each visitor can run a
        limited number of server conversions a day.
      </p>
    </div>
  );
}
