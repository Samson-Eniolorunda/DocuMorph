"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bold,
  Eraser,
  Highlighter,
  ImagePlus,
  Loader2,
  MousePointer2,
  PenLine,
  Redo2,
  Save,
  Signature,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { Dropzone } from "@/features/files/Dropzone";
import { ErrorNote, explain } from "@/features/files/Results";
import { usePdf } from "@/features/files/usePdf";
import { DEVICE_MAX_BYTES, renameTo } from "@/lib/files";
import { download, pdfBlob } from "@/lib/download";
import { applyEdits, readFields, type FieldInfo, type FontFamily } from "@/lib/pdf/ops";
import { EditorPage } from "./EditorPage";
import { SignaturePad, imageFromFile, type PlacedImage } from "./SignaturePad";
import { baselineRatio, type EdEdit, type TextStyle, type ToolName } from "./types";

const TOOLS: { id: ToolName; label: string; icon: typeof Type; hint: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, hint: "Select an item to move, resize or delete it." },
  { id: "text", label: "Text", icon: Type, hint: "Click where the text should start, then type." },
  {
    id: "whiteout",
    label: "Cover",
    icon: Eraser,
    hint: "Drag over text to hide it. To change wording, cover it, then add new text on top.",
  },
  { id: "highlight", label: "Highlight", icon: Highlighter, hint: "Drag over text to highlight it." },
  { id: "outline", label: "Box", icon: Square, hint: "Drag to draw a box around something." },
  { id: "image", label: "Image", icon: ImagePlus, hint: "Click on the page to place the image." },
  { id: "signature", label: "Sign", icon: Signature, hint: "Click on the page to place your signature." },
];

let seq = 0;
const nid = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;

export function PdfEditor() {
  const pdf = usePdf();
  const [sizes, setSizes] = useState<{ width: number; height: number }[]>([]);
  const [edits, setEdits] = useState<EdEdit[]>([]);
  const undo = useRef<EdEdit[][]>([]);
  const redo = useRef<EdEdit[][]>([]);
  const [hist, setHist] = useState({ u: 0, r: 0 });
  const syncHist = () => setHist({ u: undo.current.length, r: redo.current.length });
  const [tool, setTool] = useState<ToolName>("text");
  const [selected, setSelected] = useState<string | null>(null);
  const [style, setStyle] = useState<TextStyle>({ size: 14, color: "#111111", font: "sans", bold: false });
  const [boxColor, setBoxColor] = useState({ whiteout: "#ffffff", highlight: "#ffe14d", outline: "#d92d20" });
  const [pending, setPending] = useState<PlacedImage | null>(null);
  const [signing, setSigning] = useState(false);
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [flatten, setFlatten] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [width, setWidth] = useState(800);
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const dirty = edits.length > 0 || deleted.size > 0 || Object.keys(values).length > 0;

  /* ---------- Opening ---------- */

  async function open(file: File) {
    const doc = await pdf.load(file);
    if (!doc) return;
    const s: { width: number; height: number }[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const vp = (await doc.getPage(i)).getViewport({ scale: 1 });
      s.push({ width: vp.width, height: vp.height });
    }
    setSizes(s);
    try {
      setFields(await readFields(new Uint8Array(await file.arrayBuffer())));
    } catch {
      setFields([]);
    }
  }

  function close() {
    if (dirty && !confirm("Close this PDF? Changes that have not been saved will be lost.")) return;
    edits.forEach((e) => e.url && URL.revokeObjectURL(e.url));
    pdf.reset();
    setEdits([]);
    setSizes([]);
    setDeleted(new Set());
    setFields([]);
    setValues({});
    setSaved("");
    undo.current = [];
    redo.current = [];
    syncHist();
  }

  /* ---------- History ---------- */

  const checkpoint = useCallback(() => {
    undo.current.push(edits);
    if (undo.current.length > 100) undo.current.shift();
    redo.current = [];
    syncHist();
  }, [edits]);

  const step = useCallback(
    (from: React.RefObject<EdEdit[][]>, to: React.RefObject<EdEdit[][]>) => {
      // Skip checkpoints where nothing changed (for example a click into text without typing).
      let prev = from.current.pop();
      while (prev === edits && from.current.length) prev = from.current.pop();
      if (!prev || prev === edits) return;
      to.current.push(edits);
      setEdits(prev);
      setSelected(null);
      syncHist();
    },
    [edits],
  );

  const change = useCallback(
    (id: string, patch: Partial<EdEdit>) =>
      setEdits((cur) => cur.map((e) => (e.id === id ? ({ ...e, ...patch } as EdEdit) : e))),
    [],
  );

  const removeSelected = useCallback(() => {
    if (!selected) return;
    checkpoint();
    setEdits((cur) => cur.filter((e) => e.id !== selected));
    setSelected(null);
  }, [selected, checkpoint]);

  /* ---------- Placing ---------- */

  function place(page: number, box: { x: number; y: number; w: number; h: number }, dragged: boolean) {
    setSaved("");
    if (tool === "text") {
      checkpoint();
      const id = nid();
      setEdits((cur) => [
        ...cur,
        { id, type: "text", page, x: box.x, y: Math.max(0, box.y - style.size * 0.6), w: 0, h: 0, text: "", ...style },
      ]);
      setSelected(id);
      // Focus the new text box once it is on screen.
      requestAnimationFrame(() =>
        (document.querySelector(`[data-edit="${id}"]`) as HTMLTextAreaElement | null)?.focus(),
      );
      return;
    }
    if (tool === "whiteout" || tool === "highlight" || tool === "outline") {
      checkpoint();
      const id = nid();
      const b = dragged ? box : { x: box.x - 60, y: box.y - 10, w: 120, h: 20 };
      setEdits((cur) => [...cur, { id, type: "box", page, ...b, style: tool, color: boxColor[tool] }]);
      setSelected(id);
      return;
    }
    if ((tool === "image" || tool === "signature") && pending) {
      checkpoint();
      const id = nid();
      const w = Math.min(tool === "signature" ? 160 : 220, pending.width);
      const h = (w * pending.height) / pending.width;
      setEdits((cur) => [
        ...cur,
        {
          id,
          type: "image",
          page,
          x: box.x - w / 2,
          y: box.y - h / 2,
          w,
          h,
          bytes: pending.bytes,
          kind: pending.kind,
          url: pending.url,
        },
      ]);
      setSelected(id);
      setTool("select");
      setPending(null);
    }
  }

  function chooseTool(t: ToolName) {
    setTool(t);
    setSelected(null);
    if (t === "signature") setSigning(true);
    if (t === "image") imageInput.current?.click();
  }

  /* ---------- Styling the selected item ---------- */

  const sel = edits.find((e) => e.id === selected);

  function setTextStyle(patch: Partial<TextStyle>) {
    setStyle((s) => ({ ...s, ...patch }));
    if (sel?.type === "text") {
      checkpoint();
      change(sel.id, patch);
    }
  }

  function setBox(color: string) {
    const kind =
      sel?.type === "box" ? sel.style : tool === "whiteout" || tool === "highlight" || tool === "outline" ? tool : null;
    if (!kind) return;
    setBoxColor((c) => ({ ...c, [kind]: color }));
    if (sel?.type === "box") {
      checkpoint();
      change(sel.id, { color });
    }
  }

  /* ---------- Saving ---------- */

  async function save() {
    if (!pdf.bytes || !pdf.file) return;
    setSaving(true);
    setError("");
    try {
      const ready = edits.map((e) => (e.type === "text" ? { ...e, baseline: baselineRatio(e) } : e));
      const bytes = await applyEdits(pdf.bytes, ready, {
        fields: values,
        flattenForm: flatten,
        deletePages: [...deleted],
        loadUnicodeFont: async () => new Uint8Array(await (await fetch("/fonts/NotoSans-Regular.ttf")).arrayBuffer()),
      });
      const name = renameTo(pdf.file.name, "pdf", "-edited");
      download({ name, blob: pdfBlob(bytes) });
      setSaved(name);
    } catch (e) {
      setError(explain(e));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Keyboard, page width, leaving ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT";
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) step(redo, undo);
        else step(undo, redo);
      } else if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        step(redo, undo);
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && selected) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") {
        setSelected(null);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, selected, removeSelected]);

  // The page area only exists once the document and its page sizes are known,
  // so the observer is attached through a callback ref, not on open.
  useEffect(() => {
    if (!area) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.floor(e.contentRect.width)));
    ro.observe(area);
    return () => ro.disconnect();
  }, [area]);

  useEffect(() => {
    if (!dirty || saved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);

  /* ---------- Rendering ---------- */

  if (!pdf.doc || !sizes.length)
    return (
      <div className="space-y-3">
        <Dropzone kinds={["pdf"]} maxBytes={DEVICE_MAX_BYTES} onFiles={([p]) => void open(p.file)} />
        {pdf.loading && <p className="text-sm text-muted">Opening…</p>}
        <ErrorNote message={pdf.error} />
        <p className="text-sm text-muted">
          Need to reorder or rotate pages? Use{" "}
          <Link href="/organise-pdf" className="text-accent underline underline-offset-4">
            Organise pages
          </Link>
          .
        </p>
      </div>
    );

  const showText = tool === "text" || sel?.type === "text";
  const boxKind =
    sel?.type === "box" ? sel.style : tool === "whiteout" || tool === "highlight" || tool === "outline" ? tool : null;
  const textStyle: TextStyle =
    sel?.type === "text" ? { size: sel.size, color: sel.color, font: sel.font, bold: sel.bold } : style;
  const hint = TOOLS.find((t) => t.id === tool)?.hint ?? "";

  return (
    <div>
      {/* Toolbar */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="toolbar" aria-label="Editing tools" className="flex flex-wrap gap-1">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tool === t.id}
                title={t.hint}
                onClick={() => chooseTool(t.id)}
                className={`btn px-2.5 py-1.5 ${tool === t.id ? "btn-primary" : "btn-quiet"}`}
              >
                <t.icon className="size-4" /> <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <button
            type="button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="btn btn-quiet px-2.5 py-1.5"
            disabled={!hist.u}
            onClick={() => step(undo, redo)}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            className="btn btn-quiet px-2.5 py-1.5"
            disabled={!hist.r}
            onClick={() => step(redo, undo)}
          >
            <Redo2 className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Delete selected"
            title="Delete selected (Delete)"
            className="btn btn-quiet px-2.5 py-1.5"
            disabled={!selected}
            onClick={removeSelected}
          >
            <Trash2 className="size-4" />
          </button>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              className="btn btn-quiet px-2.5 py-1.5"
              onClick={close}
              aria-label="Close PDF"
              title="Close PDF"
            >
              <X className="size-4" />
            </button>
            <button type="button" className="btn btn-primary px-3 py-1.5" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save PDF
            </button>
          </div>
        </div>

        {(showText || boxKind) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2 text-sm">
            {showText && (
              <>
                <select
                  aria-label="Font"
                  className="field w-auto py-1"
                  value={textStyle.font}
                  onChange={(e) => setTextStyle({ font: e.target.value as FontFamily })}
                >
                  <option value="sans">Sans (Helvetica)</option>
                  <option value="serif">Serif (Times)</option>
                  <option value="mono">Mono (Courier)</option>
                </select>
                <label className="flex items-center gap-1">
                  <span className="sr-only">Size</span>
                  <input
                    type="number"
                    min={6}
                    max={96}
                    aria-label="Font size"
                    className="field w-16 py-1"
                    value={textStyle.size}
                    onChange={(e) => setTextStyle({ size: Math.min(96, Math.max(6, Number(e.target.value) || 12)) })}
                  />
                  pt
                </label>
                <button
                  type="button"
                  aria-pressed={textStyle.bold}
                  aria-label="Bold"
                  className={`btn px-2 py-1 ${textStyle.bold ? "btn-primary" : "btn-quiet"}`}
                  onClick={() => setTextStyle({ bold: !textStyle.bold })}
                >
                  <Bold className="size-4" />
                </button>
                <label className="flex items-center gap-1.5">
                  Colour
                  <input
                    type="color"
                    aria-label="Text colour"
                    value={textStyle.color}
                    onChange={(e) => setTextStyle({ color: e.target.value })}
                    className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent"
                  />
                </label>
              </>
            )}
            {boxKind && (
              <label className="flex items-center gap-1.5">
                {boxKind === "whiteout" ? "Cover colour" : boxKind === "highlight" ? "Highlight colour" : "Box colour"}
                <input
                  type="color"
                  aria-label="Colour"
                  value={sel?.type === "box" ? sel.color : boxColor[boxKind]}
                  onChange={(e) => setBox(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent"
                />
              </label>
            )}
          </div>
        )}
        <p className="mt-1.5 text-xs text-subtle">{pending ? "Click on the page to place it." : hint}</p>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return setTool("select");
          try {
            setPending(await imageFromFile(f));
          } catch (err) {
            setError(explain(err));
          }
        }}
      />
      {signing && (
        <SignaturePad
          onClose={() => {
            setSigning(false);
            if (!pending) setTool("select");
          }}
          onDone={(img) => {
            setPending(img);
            setSigning(false);
          }}
        />
      )}

      <div className="mt-4 space-y-3">
        <ErrorNote message={error} />
        {saved && (
          <p role="status" className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
            Saved as <strong>{saved}</strong>. You can keep editing and save again.
          </p>
        )}
        {fields.length > 0 && (
          <details open className="rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer font-medium">
              <PenLine className="mr-1.5 inline size-4" /> This PDF has a form ({fields.length} field
              {fields.length === 1 ? "" : "s"})
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.name} className="text-sm">
                  <span className="mb-1 block truncate text-muted">{f.name}</span>
                  {f.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={(values[f.name] as boolean | undefined) ?? f.value}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))}
                    />
                  ) : f.type === "choice" ? (
                    <select
                      className="field"
                      value={(values[f.name] as string | undefined) ?? f.value}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    >
                      <option value="">Choose…</option>
                      {f.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.multiline ? (
                    <textarea
                      className="field"
                      rows={3}
                      value={(values[f.name] as string | undefined) ?? f.value}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className="field"
                      value={(values[f.name] as string | undefined) ?? f.value}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={flatten}
                onChange={(e) => setFlatten(e.target.checked)}
              />
              Lock the answers when saving (the form can no longer be changed)
            </label>
          </details>
        )}
      </div>

      {/* Pages */}
      <div ref={setArea} className="mt-6 space-y-8">
        {sizes.map((size, i) => {
          const cssW = Math.min(width, 900);
          const scale = cssW / size.width;
          const isDeleted = deleted.has(i);
          return (
            <section key={i} aria-label={`Page ${i + 1}`}>
              <div
                className="mx-auto mb-2 flex items-center justify-between text-xs text-subtle"
                style={{ width: cssW }}
              >
                <span>
                  Page {i + 1} of {sizes.length}
                  {isDeleted && " · will be removed"}
                </span>
                <button
                  type="button"
                  className="rounded px-2 py-1 hover:bg-raised hover:text-fg"
                  onClick={() =>
                    setDeleted((d) => {
                      const n = new Set(d);
                      if (n.has(i)) n.delete(i);
                      else if (n.size < sizes.length - 1) n.add(i);
                      return n;
                    })
                  }
                >
                  {isDeleted ? "Keep page" : "Delete page"}
                </button>
              </div>
              <EditorPage
                doc={pdf.doc!}
                index={i}
                size={size}
                scale={scale}
                edits={edits.filter((e) => e.page === i)}
                tool={tool}
                selected={selected}
                deleted={isDeleted}
                onSelect={setSelected}
                onPlace={place}
                onChange={change}
                onCheckpoint={checkpoint}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
