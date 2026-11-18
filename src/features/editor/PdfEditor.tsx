"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eraser,
  FileText,
  Highlighter,
  ImagePlus,
  MousePointer2,
  MoreHorizontal,
  Palette,
  PenLine,
  Redo2,
  Save,
  Share2,
  Signature,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, TextArea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { Stepper } from "@/components/ui/Slider";
import { Dropzone } from "@/features/files/Dropzone";
import { PageThumb } from "@/features/files/PageThumb";
import { usePdf } from "@/features/files/usePdf";
import { canShare, download, pdfBlob, share, type OutputFile } from "@/lib/download";
import { explain } from "@/lib/errors";
import { DEVICE_MAX_BYTES, renameTo } from "@/lib/files";
import type { FieldInfo, FontFamily } from "@/lib/pdf/ops";
import { cn } from "@/lib/cn";
import { EditorPage } from "./EditorPage";
import { commit, redo as redoStep, replace, snapshot, start, undo as undoStep, type History } from "./history";
import { SignaturePad, imageFromFile, type PlacedImage } from "./SignaturePad";
import { Swatches } from "./Swatches";
import { baselineRatio, type EdEdit, type TextStyle, type ToolName } from "./types";

const HINTS: Record<ToolName, string> = {
  select: "Tap an item to move, resize or delete it.",
  text: "Tap where the text should start.",
  whiteout: "Drag over the text you want to hide. To change wording, cover it, then add new text.",
  highlight: "Drag over text to highlight it.",
  outline: "Drag to draw a box around something.",
  image: "Tap where the image should go.",
  signature: "Tap where your signature should go.",
};

const MAIN_TOOLS: { id: ToolName; label: string; icon: typeof Type }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "text", label: "Text", icon: Type },
  { id: "signature", label: "Sign", icon: Signature },
  { id: "whiteout", label: "Cover", icon: Eraser },
  { id: "highlight", label: "Highlight", icon: Highlighter },
];

const FONTS: [FontFamily, string][] = [
  ["sans", "Sans (Helvetica)"],
  ["serif", "Serif (Times)"],
  ["mono", "Mono (Courier)"],
];

let seq = 0;
const nid = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;
const NUDGE = 4;

type Sheet = null | "text" | "colour" | "more" | "form" | "pages" | "close";

export function PdfEditor() {
  const pdf = usePdf();
  const [sizes, setSizes] = useState<{ width: number; height: number }[]>([]);
  const [hist, setHist] = useState<History<EdEdit[]>>(() => start<EdEdit[]>([]));
  const edits = hist.present;
  const [tool, setTool] = useState<ToolName>("text");
  const [selected, setSelected] = useState<string | null>(null);
  const [style, setStyle] = useState<TextStyle>({ size: 14, color: "#111111", font: "sans", bold: false });
  const [boxColor, setBoxColor] = useState({ whiteout: "#ffffff", highlight: "#ffe14d", outline: "#d92d20" });
  const [pending, setPending] = useState<PlacedImage | null>(null);
  const [freeResize, setFreeResize] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [flatten, setFlatten] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<OutputFile | null>(null);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(360);
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState(1);
  const imageInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const dirty = edits.length > 0 || deleted.size > 0 || Object.keys(values).length > 0;
  const sel = edits.find((e) => e.id === selected);

  /* ---------- Opening and closing ---------- */

  async function open(file: File) {
    const doc = await pdf.load(file);
    if (!doc) return;
    const s: { width: number; height: number }[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      s.push({ width: vp.width, height: vp.height });
      page.cleanup();
    }
    setSizes(s);
    try {
      const { readFields } = await import("@/lib/pdf/ops");
      setFields(await readFields(new Uint8Array(await file.arrayBuffer())));
    } catch {
      setFields([]);
    }
  }

  function close() {
    edits.forEach((e) => e.url && URL.revokeObjectURL(e.url));
    pdf.reset();
    setHist(start<EdEdit[]>([]));
    setSizes([]);
    setDeleted(new Set());
    setFields([]);
    setValues({});
    setSaved(null);
    setSelected(null);
    setSheet(null);
  }

  /* ---------- Editing ---------- */

  const checkpoint = useCallback(() => setHist(snapshot), []);
  const setEdits = useCallback((fn: (cur: EdEdit[]) => EdEdit[]) => setHist((h) => replace(h, fn(h.present))), []);
  const change = useCallback(
    (id: string, patch: Partial<EdEdit>) =>
      setEdits((cur) => cur.map((e) => (e.id === id ? ({ ...e, ...patch } as EdEdit) : e))),
    [setEdits],
  );

  const undo = useCallback(() => {
    setHist(undoStep);
    setSelected(null);
  }, []);
  const redo = useCallback(() => {
    setHist(redoStep);
    setSelected(null);
  }, []);

  const removeSelected = useCallback(() => {
    if (!selected) return;
    setHist((h) =>
      commit(
        h,
        h.present.filter((e) => e.id !== selected),
      ),
    );
    setSelected(null);
  }, [selected]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!selected) return;
      setHist((h) =>
        commit(
          h,
          h.present.map((e) => (e.id === selected ? ({ ...e, x: e.x + dx, y: Math.max(0, e.y + dy) } as EdEdit) : e)),
        ),
      );
    },
    [selected],
  );

  function place(page: number, box: { x: number; y: number; w: number; h: number }, dragged: boolean) {
    setSaved(null);
    if (tool === "text") {
      const id = nid();
      setHist((h) =>
        commit(h, [
          ...h.present,
          {
            id,
            type: "text",
            page,
            x: box.x,
            y: Math.max(0, box.y - style.size * 0.6),
            w: 0,
            h: 0,
            text: "",
            ...style,
          },
        ]),
      );
      setSelected(id);
      setSheet("text");
      return;
    }
    if (tool === "whiteout" || tool === "highlight" || tool === "outline") {
      const id = nid();
      const b = dragged ? box : { x: box.x - 60, y: box.y - 10, w: 120, h: 20 };
      const kind = tool;
      setHist((h) => commit(h, [...h.present, { id, type: "box", page, ...b, style: kind, color: boxColor[kind] }]));
      setSelected(id);
      setTool("select"); // a tool is used once, so the page scrolls again
      return;
    }
    if ((tool === "image" || tool === "signature") && pending) {
      const id = nid();
      const w = Math.min(tool === "signature" ? 160 : 220, pending.width);
      const h = (w * pending.height) / pending.width;
      setHist((h0) =>
        commit(h0, [
          ...h0.present,
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
        ]),
      );
      setSelected(id);
      setTool("select");
      setPending(null);
    }
  }

  function closeTextSheet() {
    setSheet(null);
    const t = sel?.type === "text" ? sel : null;
    if (t && !t.text.trim()) {
      setHist((h) =>
        replace(
          h,
          h.present.filter((e) => e.id !== t.id),
        ),
      );
      setSelected(null);
    }
  }

  function chooseTool(t: ToolName) {
    setTool(t);
    setSelected(null);
    setSheet(null);
    if (t === "signature") setSigning(true);
    if (t === "image") imageInput.current?.click();
  }

  function setTextStyle(patch: Partial<TextStyle>) {
    setStyle((s) => ({ ...s, ...patch }));
    if (sel?.type === "text") change(sel.id, patch);
  }

  function setBox(colour: string) {
    if (sel?.type !== "box") return;
    setBoxColor((c) => ({ ...c, [sel.style]: colour }));
    setHist((h) =>
      commit(
        h,
        h.present.map((e) => (e.id === sel.id ? ({ ...e, color: colour } as EdEdit) : e)),
      ),
    );
  }

  /* ---------- Saving ---------- */

  async function save() {
    if (!pdf.bytes || !pdf.file) return;
    setSaving(true);
    setError("");
    try {
      const { applyEdits } = await import("@/lib/pdf/ops");
      const ready = edits.map((e) => (e.type === "text" ? { ...e, baseline: baselineRatio(e) } : e));
      const bytes = await applyEdits(pdf.bytes, ready, {
        fields: values,
        flattenForm: flatten,
        deletePages: [...deleted],
        loadUnicodeFont: async () => new Uint8Array(await (await fetch("/fonts/NotoSans-Regular.ttf")).arrayBuffer()),
      });
      const out = { name: renameTo(pdf.file.name, "pdf", "-edited"), blob: pdfBlob(bytes) };
      download(out);
      setSaved(out);
    } catch (e) {
      setError(explain(e));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Keyboard, page width, leaving ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === "TEXTAREA" || el?.tagName === "INPUT" || el?.tagName === "SELECT";
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && selected) {
        e.preventDefault();
        removeSelected();
      } else if (e.key.startsWith("Arrow") && !typing && selected) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE * 4 : NUDGE;
        nudge(
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
        );
      } else if (e.key === "Escape" && !sheet && !signing) {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selected, removeSelected, nudge, sheet, signing]);

  // The page area exists only once the document is open, so the observer is attached through a callback ref.
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

  // Which page is in the middle of the screen, for the "3 / 12" indicator.
  useEffect(() => {
    if (!area) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = scroller.current?.getBoundingClientRect();
      const mid = box ? box.top + box.height / 2 : window.innerHeight / 2;
      const pages = Array.from(area.querySelectorAll<HTMLElement>("[data-page]"));
      const hit = pages.find((p) => p.getBoundingClientRect().bottom > mid);
      if (hit) setCurrent(Number(hit.dataset.page));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const host = scroller.current;
    host?.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      host?.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [area, sizes.length]);

  const cssW = useMemo(() => Math.min(width, 900), [width]);

  /* ---------- Rendering ---------- */

  if (!pdf.doc || !sizes.length)
    return (
      <div className="space-y-3">
        <Dropzone kinds={["pdf"]} maxBytes={DEVICE_MAX_BYTES} onFiles={([p]) => void open(p.file)} />
        {pdf.loading && <p className="text-muted">Opening…</p>}
        {pdf.error && <Notice tone="error">{pdf.error}</Notice>}
        <p className="text-muted">
          Need to reorder or rotate pages? Use{" "}
          <Link href="/organise-pdf" className="text-accent underline underline-offset-4">
            Organise pages
          </Link>
          .
        </p>
      </div>
    );

  const doc = pdf.doc;
  const text = sel?.type === "text" ? sel : null;
  const textStyle: TextStyle = text ? { size: text.size, color: text.color, font: text.font, bold: text.bold } : style;
  const keptPages = sizes.length - deleted.size;

  const togglePage = (i: number) =>
    setDeleted((d) => {
      const n = new Set(d);
      if (n.has(i)) n.delete(i);
      else if (n.size < sizes.length - 1) n.add(i);
      return n;
    });

  // While a document is open the editor takes the whole screen: its own slim bar replaces the site header,
  // so two bars never stack and the page gets all the room.
  return (
    <div
      ref={scroller}
      data-editor-scroll
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg px-3 pt-[env(safe-area-inset-top)] sm:px-6"
    >
      {/* Top bar: close, page, undo, redo, save */}
      <div className="sticky top-0 z-20 -mx-3 flex items-center gap-1 border-b border-line bg-surface px-2 sm:-mx-6">
        <IconButton label="Close PDF" onClick={() => (dirty && !saved ? setSheet("close") : close())}>
          <X className="size-5" />
        </IconButton>
        <button
          type="button"
          onClick={() => setSheet("pages")}
          className="min-h-11 rounded-md px-3 font-mono text-[15px] hover:bg-raised"
          aria-label={`Page ${current} of ${sizes.length}. Open the page list.`}
        >
          {current} / {sizes.length}
        </button>
        <span className="flex-1" />
        <IconButton label="Undo" disabled={!hist.past.length} onClick={undo}>
          <Undo2 className="size-5" />
        </IconButton>
        <IconButton label="Redo" disabled={!hist.future.length} onClick={redo}>
          <Redo2 className="size-5" />
        </IconButton>
        <Button variant="primary" busy={saving} onClick={save} className="ml-1">
          <Save className="size-5" aria-hidden /> Save
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        {error && <Notice tone="error">{error}</Notice>}
        {saved && (
          <Notice tone="success" title={`Saved as ${saved.name}`}>
            <p>You can keep editing and save again.</p>
            {canShare([saved]) && (
              <Button variant="secondary" className="mt-2" onClick={() => void share([saved])}>
                <Share2 className="size-5" aria-hidden /> Share
              </Button>
            )}
          </Notice>
        )}
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
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

      {/* Pages */}
      <div ref={setArea} className="mt-4 space-y-6 pb-56">
        {sizes.map((size, i) => {
          const scale = cssW / size.width;
          const isDeleted = deleted.has(i);
          return (
            <section key={i} aria-label={`Page ${i + 1}`} data-page={i + 1}>
              <div
                className="mx-auto mb-1 flex items-center justify-between text-body-sm text-subtle"
                style={{ width: cssW }}
              >
                <span className="font-mono">
                  Page {i + 1} of {sizes.length}
                  {isDeleted && " · will be removed"}
                </span>
                <Button variant="ghost" onClick={() => togglePage(i)}>
                  {isDeleted ? "Keep page" : "Delete page"}
                </Button>
              </div>
              <EditorPage
                doc={doc}
                index={i}
                size={size}
                scale={scale}
                edits={edits.filter((e) => e.page === i)}
                tool={tool}
                selected={selected}
                deleted={isDeleted}
                freeResize={freeResize}
                onSelect={setSelected}
                onPlace={place}
                onEditText={(id) => {
                  setSelected(id);
                  checkpoint();
                  setSheet("text");
                }}
                onChange={change}
                onCheckpoint={checkpoint}
              />
            </section>
          );
        })}
      </div>

      {/* Bottom: hint, selection actions, tool bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-4xl">
          <p className="px-4 pt-2 text-body-sm text-muted">{pending ? "Tap on the page to place it." : HINTS[tool]}</p>
          {sel && (
            <div
              className="flex items-center gap-1 overflow-x-auto px-2 py-1"
              role="toolbar"
              aria-label="Selected item"
            >
              {text && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    checkpoint();
                    setSheet("text");
                  }}
                >
                  <Type className="size-5" aria-hidden /> Edit
                </Button>
              )}
              {sel.type === "box" && (
                <Button variant="secondary" onClick={() => setSheet("colour")}>
                  <Palette className="size-5" aria-hidden /> Colour
                </Button>
              )}
              {sel.type === "image" && (
                <Button variant="secondary" aria-pressed={freeResize} onClick={() => setFreeResize((v) => !v)}>
                  Free resize {freeResize ? "on" : "off"}
                </Button>
              )}
              <Button variant="danger" onClick={removeSelected} aria-label="Delete selected item">
                <Trash2 className="size-5" aria-hidden /> Delete
              </Button>
              <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
              <IconButton label="Move left" onClick={() => nudge(-NUDGE, 0)}>
                <ArrowLeft className="size-5" />
              </IconButton>
              <IconButton label="Move up" onClick={() => nudge(0, -NUDGE)}>
                <ArrowUp className="size-5" />
              </IconButton>
              <IconButton label="Move down" onClick={() => nudge(0, NUDGE)}>
                <ArrowDown className="size-5" />
              </IconButton>
              <IconButton label="Move right" onClick={() => nudge(NUDGE, 0)}>
                <ArrowRight className="size-5" />
              </IconButton>
            </div>
          )}
          <div role="toolbar" aria-label="Editing tools" className="flex px-1 pb-1 pt-0.5">
            {MAIN_TOOLS.map((t) => (
              <ToolButton key={t.id} label={t.label} active={tool === t.id} onClick={() => chooseTool(t.id)}>
                <t.icon className="size-6" />
              </ToolButton>
            ))}
            <ToolButton label="More" active={sheet === "more"} onClick={() => setSheet("more")}>
              <MoreHorizontal className="size-6" />
            </ToolButton>
          </div>
        </div>
      </div>

      {/* Sheets */}
      <Dialog
        open={sheet === "text"}
        onClose={() => sheet === "text" && closeTextSheet()}
        title="Text"
        footer={
          <Button variant="primary" size="lg" onClick={closeTextSheet}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          {text && (
            <TextArea
              label="Your text"
              value={text.text}
              onChange={(e) => change(text.id, { text: e.target.value })}
              autoCapitalize="sentences"
              spellCheck
              enterKeyHint="enter"
            />
          )}
          <Stepper
            label="Size (pt)"
            value={textStyle.size}
            min={6}
            max={96}
            onChange={(size) => setTextStyle({ size })}
          />
          <Select
            label="Font"
            value={textStyle.font}
            onChange={(e) => setTextStyle({ font: e.target.value as FontFamily })}
          >
            {FONTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Checkbox label="Bold" checked={textStyle.bold} onChange={(bold) => setTextStyle({ bold })} />
          <Swatches label="Colour" value={textStyle.color} onChange={(color) => setTextStyle({ color })} />
        </div>
      </Dialog>

      <Dialog open={sheet === "colour"} onClose={() => setSheet(null)} title="Colour">
        {sel?.type === "box" && (
          <Swatches
            label={
              sel.style === "whiteout" ? "Cover colour" : sel.style === "highlight" ? "Highlight colour" : "Box colour"
            }
            value={sel.color}
            onChange={setBox}
          />
        )}
      </Dialog>

      <Dialog open={sheet === "more"} onClose={() => setSheet(null)} title="More tools">
        <div className="grid gap-2">
          <Button variant="secondary" className="justify-start" onClick={() => chooseTool("outline")}>
            <Square className="size-5" aria-hidden /> Box
          </Button>
          <Button variant="secondary" className="justify-start" onClick={() => chooseTool("image")}>
            <ImagePlus className="size-5" aria-hidden /> Add an image
          </Button>
          <Button variant="secondary" className="justify-start" onClick={() => setSheet("pages")}>
            <FileText className="size-5" aria-hidden /> Pages ({keptPages} kept)
          </Button>
          {fields.length > 0 && (
            <Button variant="secondary" className="justify-start" onClick={() => setSheet("form")}>
              <PenLine className="size-5" aria-hidden /> Form ({fields.length} field{fields.length === 1 ? "" : "s"})
            </Button>
          )}
        </div>
      </Dialog>

      <Dialog open={sheet === "pages"} onClose={() => setSheet(null)} title="Pages">
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {sizes.map((_, i) => (
            <li key={i} className={cn("rounded-md border border-line p-1.5", deleted.has(i) && "opacity-60")}>
              <button
                type="button"
                aria-label={`Go to page ${i + 1}${deleted.has(i) ? ", will be removed" : ""}`}
                className="flex w-full flex-col items-center gap-1 rounded-md hover:bg-raised"
                onClick={() => {
                  setSheet(null);
                  document
                    .querySelector(`[data-page="${i + 1}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {pdf.doc && <PageThumb doc={pdf.doc} index={i} width={84} />}
                <span className="font-mono text-caption">{i + 1}</span>
              </button>
              <Button variant="ghost" className="mt-0.5 w-full" onClick={() => togglePage(i)}>
                {deleted.has(i) ? "Keep" : "Delete"}
              </Button>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-body-sm text-subtle">Tap a page to go to it. At least one page is always kept.</p>
      </Dialog>

      <Dialog
        open={sheet === "form"}
        onClose={() => setSheet(null)}
        title="Fill in the form"
        footer={
          <Button variant="primary" size="lg" onClick={() => setSheet(null)}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          {fields.map((f, i) => {
            const label = f.name || `Field ${i + 1}`;
            const value = (values[f.name] as string | undefined) ?? (typeof f.value === "string" ? f.value : "");
            if (f.type === "checkbox")
              return (
                <Checkbox
                  key={f.name}
                  label={label}
                  checked={(values[f.name] as boolean | undefined) ?? f.value}
                  onChange={(v) => setValues((cur) => ({ ...cur, [f.name]: v }))}
                />
              );
            if (f.type === "choice")
              return (
                <Select
                  key={f.name}
                  label={label}
                  value={value}
                  onChange={(e) => setValues((cur) => ({ ...cur, [f.name]: e.target.value }))}
                >
                  <option value="">Choose…</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              );
            if (f.multiline)
              return (
                <TextArea
                  key={f.name}
                  label={label}
                  value={value}
                  onChange={(e) => setValues((cur) => ({ ...cur, [f.name]: e.target.value }))}
                />
              );
            return (
              <Field
                key={f.name}
                label={label}
                type="text"
                enterKeyHint="next"
                value={value}
                onChange={(e) => setValues((cur) => ({ ...cur, [f.name]: e.target.value }))}
              />
            );
          })}
          <Checkbox
            label="Lock the answers when saving"
            hint="The form can no longer be changed afterwards."
            checked={flatten}
            onChange={setFlatten}
          />
        </div>
      </Dialog>

      <Dialog
        open={sheet === "close"}
        onClose={() => setSheet(null)}
        title="Close this PDF?"
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setSheet(null)}>
              Keep editing
            </Button>
            <Button variant="danger" size="lg" onClick={close}>
              Close without saving
            </Button>
          </>
        }
      >
        <p>Changes that have not been saved will be lost.</p>
      </Dialog>
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "transition-quick flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-caption font-medium",
        active ? "bg-accent-tint text-accent" : "text-fg hover:bg-raised",
      )}
    >
      {children}
      {label}
    </button>
  );
}
