"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, RotateCcw, RotateCw, Save, Trash2, Undo2 } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { PageThumb } from "@/components/PageThumb";
import { ErrorNote, Results, explain } from "@/components/Results";
import { usePdf } from "@/components/usePdf";
import { DEVICE_MAX_BYTES, renameTo } from "@/lib/files";
import { pdfBlob, type OutputFile } from "@/lib/download";
import { organise } from "@/lib/pdf/ops";

type Slot = { index: number; rotate: number; removed: boolean };

export function OrganisePdf() {
  const pdf = usePdf();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<OutputFile | null>(null);

  const update = (i: number, change: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...change } : x)));
  const move = (i: number, to: number) =>
    setSlots((s) => {
      if (to < 0 || to >= s.length) return s;
      const next = [...s];
      const [x] = next.splice(i, 1);
      next.splice(to, 0, x);
      return next;
    });

  async function save() {
    setBusy(true);
    setError("");
    try {
      const keep = slots.filter((s) => !s.removed);
      const bytes = await organise(pdf.bytes!, keep);
      setOut({ name: renameTo(pdf.file!.name, "pdf", "-organised"), blob: pdfBlob(bytes) });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  if (out)
    return (
      <Results
        files={[out]}
        onReset={() => {
          setOut(null);
          setSlots([]);
          pdf.reset();
        }}
      />
    );

  if (!pdf.doc || !slots.length)
    return (
      <div className="space-y-3">
        <Dropzone
          kinds={["pdf"]}
          maxBytes={DEVICE_MAX_BYTES}
          onFiles={async ([p]) => {
            const d = await pdf.load(p.file);
            if (d) setSlots(fresh(d.numPages));
          }}
        />
        {pdf.loading && <p className="text-sm text-muted">Opening…</p>}
        <ErrorNote message={pdf.error} />
      </div>
    );

  const kept = slots.filter((s) => !s.removed).length;
  return (
    <div className="space-y-5">
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <p className="text-sm text-muted">
          {pdf.file?.name} · {kept} of {slots.length} pages kept
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-quiet" onClick={() => setSlots(fresh(slots.length))}>
            <Undo2 className="size-4" /> Reset
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || kept === 0} onClick={save}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save PDF
          </button>
        </div>
      </div>
      <ErrorNote message={error} />
      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {slots.map((s, i) => (
          <li key={s.index} className={`flex flex-col items-center gap-2 rounded-xl border p-3 ${s.removed ? "border-danger/40 opacity-40" : "border-line bg-surface"}`}>
            <PageThumb doc={pdf.doc!} index={s.index} rotate={s.rotate} width={120} />
            <p className="text-xs text-subtle">Page {s.index + 1}</p>
            <div className="flex flex-wrap justify-center gap-1">
              <Icon label="Move left" onClick={() => move(i, i - 1)} disabled={i === 0}>
                <ArrowLeft className="size-3.5" />
              </Icon>
              <Icon label="Rotate left" onClick={() => update(i, { rotate: (s.rotate + 270) % 360 })}>
                <RotateCcw className="size-3.5" />
              </Icon>
              <Icon label="Rotate right" onClick={() => update(i, { rotate: (s.rotate + 90) % 360 })}>
                <RotateCw className="size-3.5" />
              </Icon>
              <Icon label={s.removed ? "Keep page" : "Delete page"} onClick={() => update(i, { removed: !s.removed })}>
                {s.removed ? <Undo2 className="size-3.5" /> : <Trash2 className="size-3.5" />}
              </Icon>
              <Icon label="Move right" onClick={() => move(i, i + 1)} disabled={i === slots.length - 1}>
                <ArrowRight className="size-3.5" />
              </Icon>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Icon({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="btn btn-quiet size-7 rounded-md p-0">
      {children}
    </button>
  );
}

const fresh = (n: number): Slot[] => Array.from({ length: n }, (_, index) => ({ index, rotate: 0, removed: false }));
