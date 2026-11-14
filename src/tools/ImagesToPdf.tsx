"use client";

import { useState } from "react";
import { Images, Loader2 } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { FileOrder, newId } from "@/components/FileOrder";
import { ErrorNote, Results, explain } from "@/components/Results";
import { DEVICE_MAX_BYTES, type FileKind } from "@/lib/files";
import { pdfBlob, readBytes, type OutputFile } from "@/lib/download";
import { decode, draw, encode } from "@/lib/image";
import { imagesToPdf, type PageSize, type PdfImageInput } from "@/lib/pdf/ops";

type Item = { id: string; file: File; kind: FileKind };

/** PDF accepts JPG and PNG directly; WebP is redrawn as PNG first. */
async function toPdfImage(item: Item): Promise<PdfImageInput> {
  if (item.kind === "jpg" || item.kind === "png") return { bytes: await readBytes(item.file), kind: item.kind };
  const bitmap = await decode(item.file);
  const png = await encode(draw(bitmap, bitmap.width, bitmap.height, "image/png"), "image/png");
  bitmap.close();
  return { bytes: await readBytes(png), kind: "png" };
}

export function ImagesToPdf() {
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState<PageSize>("a4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<OutputFile | null>(null);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const imgs = [];
      for (const it of items) imgs.push(await toPdfImage(it));
      setOut({ name: "images.pdf", blob: pdfBlob(await imagesToPdf(imgs, { size })) });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  if (out) return <Results files={[out]} onReset={() => (setOut(null), setItems([]))} />;

  return (
    <div className="space-y-4">
      <Dropzone kinds={["jpg", "png", "webp"]} multiple maxBytes={DEVICE_MAX_BYTES} onFiles={(f) => setItems((cur) => [...cur, ...f.map((p) => ({ id: newId(), file: p.file, kind: p.kind }))])} />
      {items.length > 0 && (
        <>
          <FileOrder items={items} onChange={setItems} />
          <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <legend className="mb-2 font-medium">Page size</legend>
            {(
              [
                ["a4", "A4"],
                ["letter", "US Letter"],
                ["fit", "Same as each image"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="size" checked={size === v} onChange={() => setSize(v)} className="accent-[var(--accent)]" /> {l}
              </label>
            ))}
          </fieldset>
          <ErrorNote message={error} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={run}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Images className="size-4" />}
            {busy ? "Creating…" : `Create PDF from ${items.length} image${items.length === 1 ? "" : "s"}`}
          </button>
        </>
      )}
    </div>
  );
}
