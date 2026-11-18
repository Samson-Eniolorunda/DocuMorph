"use client";

import { useState } from "react";
import { Combine, Loader2 } from "lucide-react";
import { Dropzone } from "@/features/files/Dropzone";
import { FileOrder, newId } from "@/features/files/FileOrder";
import { ErrorNote, Results, explain } from "@/features/files/Results";
import { DEVICE_MAX_BYTES } from "@/lib/files";
import { pdfBlob, readBytes, type OutputFile } from "@/lib/download";
import { merge } from "@/lib/pdf/ops";

type Item = { id: string; file: File };

export function MergePdf() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<OutputFile | null>(null);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const bytes = await merge(await Promise.all(items.map((i) => readBytes(i.file))));
      setOut({ name: "merged.pdf", blob: pdfBlob(bytes) });
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
        kinds={["pdf"]}
        multiple
        maxBytes={DEVICE_MAX_BYTES}
        onFiles={(f) => setItems((cur) => [...cur, ...f.map((p) => ({ id: newId(), file: p.file }))])}
      />
      {items.length > 0 && (
        <>
          <p className="text-sm text-muted">
            Drag files, or use the arrows, to set the order. The first file comes first.
          </p>
          <FileOrder items={items} onChange={setItems} />
          <ErrorNote message={error} />
          <button type="button" className="btn btn-primary" disabled={items.length < 2 || busy} onClick={run}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Combine className="size-4" />}
            {busy ? "Merging…" : items.length < 2 ? "Add at least two PDFs" : `Merge ${items.length} PDFs`}
          </button>
        </>
      )}
    </div>
  );
}
