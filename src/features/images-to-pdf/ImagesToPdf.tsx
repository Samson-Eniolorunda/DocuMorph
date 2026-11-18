"use client";

import { useState } from "react";
import { FileImage } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Choice";
import { Notice } from "@/components/ui/Feedback";
import { Dropzone } from "@/features/files/Dropzone";
import { FileOrder, newId } from "@/features/files/FileOrder";
import { Results } from "@/features/files/Results";
import { pdfBlob, readBytes, type OutputFile } from "@/lib/download";
import { explain } from "@/lib/errors";
import { DEVICE_MAX_BYTES, type FileKind } from "@/lib/files";
import { decode, draw, encode } from "@/lib/image";
import type { PageSize, PdfImageInput } from "@/lib/pdf/ops";

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
      const { imagesToPdf } = await import("@/lib/pdf/ops");
      const images: PdfImageInput[] = [];
      for (const it of items) images.push(await toPdfImage(it));
      setOut({ name: "images.pdf", blob: pdfBlob(await imagesToPdf(images, { size })) });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  if (out) return <Results files={[out]} onReset={() => (setOut(null), setItems([]))} />;

  return (
    <div className="space-y-4">
      <Dropzone
        kinds={["jpg", "png", "webp"]}
        multiple
        camera
        maxBytes={DEVICE_MAX_BYTES}
        onFiles={(f) => setItems((cur) => [...cur, ...f.map((p) => ({ id: newId(), file: p.file, kind: p.kind }))])}
      />
      {items.length > 0 && (
        <>
          <FileOrder items={items} onChange={setItems} />
          <RadioGroup
            legend="Page size"
            value={size}
            onChange={setSize}
            options={[
              { value: "a4", label: "A4" },
              { value: "letter", label: "US Letter" },
              { value: "fit", label: "Same size as each image" },
            ]}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <ActionBar>
            <Button variant="primary" size="lg" busy={busy} onClick={run}>
              <FileImage className="size-5" aria-hidden />{" "}
              {busy ? "Creating…" : `Create PDF from ${items.length} image${items.length === 1 ? "" : "s"}`}
            </Button>
          </ActionBar>
        </>
      )}
    </div>
  );
}
