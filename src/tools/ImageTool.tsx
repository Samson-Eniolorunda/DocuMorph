"use client";

// One component for the three image tools: convert, resize and compress.
// Each works on several images at once and keeps the original names.

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ErrorNote, Results, explain } from "@/components/Results";
import { DEVICE_MAX_BYTES, renameTo, type FileKind } from "@/lib/files";
import type { OutputFile } from "@/lib/download";
import { EXT, compressToTarget, decode, draw, encode, targetDimensions, type ImageType } from "@/lib/image";

export type ImageMode = "convert" | "resize" | "compress";

const TYPE_OF: Partial<Record<FileKind, ImageType>> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const FORMATS: [ImageType, string][] = [
  ["image/jpeg", "JPG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"],
];

export function ImageTool({ mode }: { mode: ImageMode }) {
  const [files, setFiles] = useState<{ file: File; kind: FileKind }[]>([]);
  const [format, setFormat] = useState<ImageType | "same">(mode === "convert" ? "image/jpeg" : "same");
  const [quality, setQuality] = useState(mode === "compress" ? 70 : 90);
  const [resizeBy, setResizeBy] = useState<"size" | "percent">("size");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [percent, setPercent] = useState(50);
  const [keepRatio, setKeepRatio] = useState(true);
  const [compressBy, setCompressBy] = useState<"quality" | "target">("quality");
  const [targetKb, setTargetKb] = useState(200);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<{ files: OutputFile[]; before: number; note?: string } | null>(null);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const results: OutputFile[] = [];
      let missed = 0;
      for (const { file, kind } of files) {
        const bitmap = await decode(file);
        let type = format === "same" ? TYPE_OF[kind]! : format;
        // PNG ignores quality, so compressing a PNG means saving it as WebP.
        if (mode === "compress" && type === "image/png") type = "image/webp";
        let blob: Blob;
        if (mode === "resize") {
          const dims = resizeBy === "percent" ? targetDimensions(bitmap, { percent }) : targetDimensions(bitmap, { width: Number(width) || undefined, height: Number(height) || undefined }, keepRatio);
          blob = await encode(draw(bitmap, dims.width, dims.height, type), type, quality / 100);
        } else if (mode === "compress" && compressBy === "target") {
          const r = await compressToTarget(bitmap, type, targetKb * 1024);
          if (!r.fits) missed++;
          blob = r.blob;
        } else {
          blob = await encode(draw(bitmap, bitmap.width, bitmap.height, type), type, quality / 100);
        }
        bitmap.close();
        results.push({ name: renameTo(file.name, EXT[type], mode === "convert" ? "" : `-${mode === "resize" ? "resized" : "compressed"}`), blob });
      }
      setOut({
        files: results,
        before: files.reduce((n, f) => n + f.file.size, 0),
        note: missed ? `${missed} image${missed === 1 ? "" : "s"} could not reach ${targetKb} KB; the smallest result is given instead.` : undefined,
      });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  if (out) return <Results files={out.files} before={out.before} note={out.note} zipName={`images-${mode}.zip`} onReset={() => (setOut(null), setFiles([]))} />;

  const resizeInvalid = mode === "resize" && resizeBy === "size" && !Number(width) && !Number(height);

  return (
    <div className="space-y-5">
      <Dropzone kinds={["jpg", "png", "webp"]} multiple maxBytes={DEVICE_MAX_BYTES} onFiles={(f) => setFiles((cur) => [...cur, ...f])} />

      {files.length > 0 && (
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">
            {files.length} image{files.length === 1 ? "" : "s"} selected.{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => setFiles([])}>
              Clear
            </button>
          </p>

          {mode === "resize" && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                {(["size", "percent"] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2">
                    <input type="radio" checked={resizeBy === v} onChange={() => setResizeBy(v)} className="accent-[var(--accent)]" />
                    {v === "size" ? "Exact size" : "Percentage"}
                  </label>
                ))}
              </div>
              {resizeBy === "size" ? (
                <div className="grid max-w-md grid-cols-2 gap-3">
                  <label className="text-sm">
                    Width (px)
                    <input className="field mt-1" inputMode="numeric" value={width} onChange={(e) => setWidth(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1200" />
                  </label>
                  <label className="text-sm">
                    Height (px)
                    <input className="field mt-1" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} placeholder="auto" />
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} className="accent-[var(--accent)]" /> Keep proportions
                  </label>
                </div>
              ) : (
                <label className="block max-w-md text-sm">
                  Scale: {percent}%
                  <input type="range" min={5} max={200} step={5} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" />
                </label>
              )}
            </div>
          )}

          {mode === "compress" && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                {(["quality", "target"] as const).map((v) => (
                  <label key={v} className="flex items-center gap-2">
                    <input type="radio" checked={compressBy === v} onChange={() => setCompressBy(v)} className="accent-[var(--accent)]" />
                    {v === "quality" ? "By quality" : "To a file size"}
                  </label>
                ))}
              </div>
              {compressBy === "target" && (
                <label className="block max-w-xs text-sm">
                  Largest size per image (KB)
                  <input className="field mt-1" inputMode="numeric" value={targetKb} onChange={(e) => setTargetKb(Math.max(5, Number(e.target.value.replace(/\D/g, "")) || 5))} />
                </label>
              )}
            </div>
          )}

          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Format
              <select className="field mt-1" value={format} onChange={(e) => setFormat(e.target.value as ImageType | "same")}>
                {mode !== "convert" && <option value="same">Keep the same</option>}
                {FORMATS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {!(mode === "compress" && compressBy === "target") && (
              <label className="text-sm">
                Quality: {quality}%
                <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="mt-3 w-full accent-[var(--accent)]" />
              </label>
            )}
          </div>
          {mode === "compress" && <p className="text-xs text-subtle">PNG files are saved as WebP when compressed, because PNG cannot be made smaller by lowering quality.</p>}

          <ErrorNote message={error} />
          <button type="button" className="btn btn-primary" disabled={busy || resizeInvalid} onClick={run}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {busy ? "Working…" : mode === "convert" ? "Convert" : mode === "resize" ? "Resize" : "Compress"}
          </button>
        </div>
      )}
    </div>
  );
}
