"use client";

import { useState } from "react";
import { Combine } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { Dropzone } from "@/features/files/Dropzone";
import { FileOrder, newId } from "@/features/files/FileOrder";
import { Results } from "@/features/files/Results";
import { pdfBlob, readBytes, type OutputFile } from "@/lib/download";
import { explain } from "@/lib/errors";
import { DEVICE_MAX_BYTES } from "@/lib/files";

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
      const { merge } = await import("@/lib/pdf/ops");
      const bytes = await merge(await Promise.all(items.map((i) => readBytes(i.file))));
      setOut({ name: "merged.pdf", blob: pdfBlob(bytes) });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  if (out) return <Results files={[out]} onReset={() => (setOut(null), setItems([]))} />;

  const enough = items.length >= 2;
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
          <p className="text-muted">
            Drag the handle, or use the arrows, to set the order. The first file comes first.
          </p>
          <FileOrder items={items} onChange={setItems} />
          {error && <Notice tone="error">{error}</Notice>}
          <ActionBar status={!enough ? "Add at least two PDFs to merge them." : undefined}>
            <Button variant="primary" size="lg" busy={busy} disabled={!enough} onClick={run}>
              <Combine className="size-5" aria-hidden /> {busy ? "Merging…" : `Merge ${items.length} PDFs`}
            </Button>
          </ActionBar>
        </>
      )}
    </div>
  );
}
