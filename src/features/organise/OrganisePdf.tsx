"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, RotateCcw, RotateCw, Save, Trash2, Undo2 } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { Dropzone } from "@/features/files/Dropzone";
import { PageThumb } from "@/features/files/PageThumb";
import { Results } from "@/features/files/Results";
import { usePdf } from "@/features/files/usePdf";
import { pdfBlob, type OutputFile } from "@/lib/download";
import { explain } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { DEVICE_MAX_BYTES, renameTo } from "@/lib/files";

type Slot = { index: number; rotate: number; removed: boolean };

const fresh = (n: number): Slot[] => Array.from({ length: n }, (_, index) => ({ index, rotate: 0, removed: false }));

export function OrganisePdf() {
  const pdf = usePdf();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<OutputFile | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  // Pointer events can arrive faster than React renders, so the position being dragged is also kept here.
  const dragAt = useRef<number | null>(null);
  const drag = (i: number | null) => {
    dragAt.current = i;
    setDragging(i);
  };
  const cells = useRef<(HTMLLIElement | null)[]>([]);

  const update = (i: number, change: Partial<Slot>) =>
    setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...change } : x)));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= slots.length) return;
    setSlots((s) => {
      const next = [...s];
      const [x] = next.splice(i, 1);
      if (x) next.splice(to, 0, x);
      return next;
    });
    setSelected(to);
  };

  /** The cell under a point, for dragging a page across the grid. */
  const cellAt = (x: number, y: number) =>
    cells.current.findIndex((c) => {
      const r = c?.getBoundingClientRect();
      return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });

  async function save() {
    if (!pdf.bytes || !pdf.file) return;
    setBusy(true);
    setError("");
    try {
      const { organise } = await import("@/lib/pdf/ops");
      const bytes = await organise(
        pdf.bytes,
        slots.filter((s) => !s.removed),
      );
      setOut({ name: renameTo(pdf.file.name, "pdf", "-organised"), blob: pdfBlob(bytes) });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setOut(null);
    setSlots([]);
    setSelected(null);
    pdf.reset();
  };

  if (out) return <Results files={[out]} onReset={reset} />;

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
        {pdf.loading && <p className="text-muted">Opening…</p>}
        {pdf.error && <Notice tone="error">{pdf.error}</Notice>}
      </div>
    );

  const kept = slots.filter((s) => !s.removed).length;
  const slot = selected === null ? undefined : slots[selected];
  const doc = pdf.doc;

  return (
    <div className="space-y-4">
      <p className="text-muted">
        {pdf.file?.name}: <span className="tabular-nums">{kept}</span> of{" "}
        <span className="tabular-nums">{slots.length}</span> pages kept. Drag a page by its handle to move it, or tap a
        page and use the buttons below.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <ol
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        onPointerMove={(e) => {
          const from = dragAt.current;
          if (from === null) return;
          // Near the top or bottom edge the page scrolls, so a page can be carried a long way.
          if (e.clientY < 90) window.scrollBy(0, -14);
          else if (e.clientY > window.innerHeight - 150) window.scrollBy(0, 14);
          const target = cellAt(e.clientX, e.clientY);
          if (target >= 0 && target !== from) {
            move(from, target);
            drag(target);
          }
        }}
        onPointerUp={() => drag(null)}
        onPointerCancel={() => drag(null)}
      >
        {slots.map((s, i) => (
          <li
            key={s.index}
            ref={(el) => {
              cells.current[i] = el;
            }}
            className={cn("relative", dragging === i && "z-10 opacity-80")}
          >
            <button
              type="button"
              aria-label={`Drag page ${s.index + 1} to a new position`}
              className="absolute left-2 top-2 z-10 flex size-11 cursor-grab touch-none items-center justify-center rounded-full border border-line bg-surface text-muted shadow-sm"
              onPointerDown={(e) => {
                // Captured on the grid, which never moves, because moving a captured element drops the capture.
                e.currentTarget.closest("ol")?.setPointerCapture(e.pointerId);
                drag(i);
                setSelected(i);
              }}
            >
              <GripVertical className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-pressed={selected === i}
              aria-label={`Page ${s.index + 1}${s.removed ? ", marked for deletion" : ""}${s.rotate ? `, turned ${s.rotate} degrees` : ""}`}
              onClick={() => setSelected(selected === i ? null : i)}
              className={cn(
                "transition-quick flex w-full flex-col items-center gap-2 rounded-lg border-2 bg-surface p-2",
                selected === i ? "border-accent bg-accent-tint" : "border-line",
                s.removed && "opacity-50",
              )}
            >
              <PageThumb doc={doc} index={s.index} rotate={s.rotate} width={140} />
              <span className="tabular-nums text-body-sm text-subtle">
                {s.removed ? "Deleted · " : ""}
                {s.index + 1}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <ActionBar
        status={
          <div className="flex justify-between gap-1" role="toolbar" aria-label="Page actions">
            <PageAction
              label="Earlier"
              disabled={!slot || selected === 0}
              onClick={() => selected !== null && move(selected, selected - 1)}
            >
              <ArrowLeft className="size-5" />
            </PageAction>
            <PageAction
              label="Left"
              disabled={!slot}
              onClick={() => selected !== null && update(selected, { rotate: ((slot?.rotate ?? 0) + 270) % 360 })}
            >
              <RotateCcw className="size-5" />
            </PageAction>
            <PageAction
              label="Right"
              disabled={!slot}
              onClick={() => selected !== null && update(selected, { rotate: ((slot?.rotate ?? 0) + 90) % 360 })}
            >
              <RotateCw className="size-5" />
            </PageAction>
            <PageAction
              label={slot?.removed ? "Keep" : "Delete"}
              disabled={!slot}
              onClick={() => selected !== null && update(selected, { removed: !slot?.removed })}
            >
              {slot?.removed ? <Undo2 className="size-5" /> : <Trash2 className="size-5" />}
            </PageAction>
            <PageAction
              label="Later"
              disabled={!slot || selected === slots.length - 1}
              onClick={() => selected !== null && move(selected, selected + 1)}
            >
              <ArrowRight className="size-5" />
            </PageAction>
          </div>
        }
      >
        <Button variant="secondary" size="lg" onClick={() => (setSlots(fresh(slots.length)), setSelected(null))}>
          Reset
        </Button>
        <Button variant="primary" size="lg" busy={busy} disabled={kept === 0} onClick={save}>
          <Save className="size-5" aria-hidden /> Save PDF
        </Button>
      </ActionBar>
    </div>
  );
}

function PageAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="transition-quick flex min-h-12 min-w-11 flex-1 flex-col items-center justify-center rounded-md text-caption text-fg hover:bg-raised disabled:opacity-40"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
