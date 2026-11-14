"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { GripVertical } from "lucide-react";
import { renderPage } from "@/lib/pdf/render";
import { CSS_FONT, measureText, type EdEdit, type TextStyle, type ToolName } from "./types";

export interface PageProps {
  doc: PDFDocumentProxy;
  index: number;
  /** Displayed page size in points. */
  size: { width: number; height: number };
  /** CSS pixels per point. */
  scale: number;
  edits: EdEdit[];
  tool: ToolName;
  selected: string | null;
  deleted: boolean;
  onSelect: (id: string | null) => void;
  /** Place a new item at a point (or over a dragged box) on this page. */
  onPlace: (page: number, box: { x: number; y: number; w: number; h: number }, dragged: boolean) => void;
  onChange: (id: string, patch: Partial<EdEdit>) => void;
  /** Called once before a move, resize or typing starts, so it can be undone. */
  onCheckpoint: () => void;
}

type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; orig: { x: number; y: number; w: number; h: number }; ratio: number };

export function EditorPage(p: PageProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const cssW = p.size.width * p.scale;
  const cssH = p.size.height * p.scale;

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvas.current) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) void renderPage(p.doc, p.index, cssW, canvas.current!);
    }, 120); // wait for resizing to settle
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [visible, p.doc, p.index, cssW]);

  const toPt = (e: React.PointerEvent) => {
    const r = layer.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / p.scale, y: (e.clientY - r.top) / p.scale };
  };

  const drawsBox = p.tool === "whiteout" || p.tool === "highlight" || p.tool === "outline";

  const placesItem = p.tool === "text" || p.tool === "image" || p.tool === "signature";

  function layerDown(e: React.PointerEvent) {
    if (p.deleted || (e.target as HTMLElement).tagName === "TEXTAREA") return;
    const onPage = e.target === layer.current;
    // Text, images and signatures can be placed over an existing box: that is
    // how "cover, then retype" works. Boxes are only drawn on the page itself.
    if (!onPage && !placesItem) return;
    const pt = toPt(e);
    if (p.tool === "select") return p.onSelect(null);
    if (drawsBox) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraft({ x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y });
      return;
    }
    p.onPlace(p.index, { x: pt.x, y: pt.y, w: 0, h: 0 }, false);
  }

  function layerMove(e: React.PointerEvent) {
    if (draft) {
      const pt = toPt(e);
      setDraft({ ...draft, x1: Math.max(0, Math.min(p.size.width, pt.x)), y1: Math.max(0, Math.min(p.size.height, pt.y)) });
    }
  }

  function layerUp() {
    if (!draft) return;
    const box = { x: Math.min(draft.x0, draft.x1), y: Math.min(draft.y0, draft.y1), w: Math.abs(draft.x1 - draft.x0), h: Math.abs(draft.y1 - draft.y0) };
    setDraft(null);
    p.onPlace(p.index, box, box.w > 4 && box.h > 4);
  }

  function startDrag(e: React.PointerEvent, ed: EdEdit, mode: Drag["mode"]) {
    e.stopPropagation();
    e.preventDefault();
    p.onSelect(ed.id);
    p.onCheckpoint();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: ed.id, mode, startX: e.clientX, startY: e.clientY, orig: { x: ed.x, y: ed.y, w: ed.w, h: ed.h }, ratio: ed.w / Math.max(1, ed.h) };
  }

  function dragMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / p.scale;
    const dy = (e.clientY - d.startY) / p.scale;
    if (d.mode === "move") {
      p.onChange(d.id, { x: clamp(d.orig.x + dx, -d.orig.w + 10, p.size.width - 10), y: clamp(d.orig.y + dy, 0, p.size.height - 10) });
    } else {
      const w = Math.max(8, d.orig.w + dx);
      const ed = p.edits.find((x) => x.id === d.id);
      // Images keep their proportions unless Shift is held.
      const h = ed?.type === "image" && !e.shiftKey ? w / d.ratio : Math.max(6, d.orig.h + dy);
      p.onChange(d.id, { w, h });
    }
  }

  const endDrag = () => (drag.current = null);

  return (
    <div className={`relative mx-auto shadow-md ${p.deleted ? "opacity-30" : ""}`} style={{ width: cssW, height: cssH }}>
      <canvas ref={canvas} className="absolute inset-0 bg-white" style={{ width: cssW, height: cssH }} aria-label={`Page ${p.index + 1}`} />
      <div
        ref={layer}
        className={`absolute inset-0 touch-none ${p.tool === "select" ? "" : drawsBox ? "cursor-crosshair" : "cursor-copy"}`}
        onPointerDown={layerDown}
        onPointerMove={layerMove}
        onPointerUp={layerUp}
      >
        {p.edits.map((ed) => {
          const isSel = p.selected === ed.id;
          const style: React.CSSProperties = { left: ed.x * p.scale, top: ed.y * p.scale };

          if (ed.type === "text") {
            const ts: TextStyle = { size: ed.size, color: ed.color, font: ed.font, bold: ed.bold };
            const m = measureText(ed.text || "Type here", ts);
            return (
              <div key={ed.id} className="absolute" style={style} onPointerMove={dragMove} onPointerUp={endDrag}>
                {isSel && (
                  <span
                    role="button"
                    aria-label="Move text"
                    tabIndex={-1}
                    onPointerDown={(e) => startDrag(e, ed, "move")}
                    className="absolute -left-5 top-0 flex h-5 w-4 cursor-move items-center justify-center rounded-sm bg-accent text-accent-fg"
                  >
                    <GripVertical className="size-3" />
                  </span>
                )}
                <textarea
                  data-edit={ed.id}
                  value={ed.text}
                  placeholder="Type here"
                  spellCheck
                  onFocus={() => {
                    p.onSelect(ed.id);
                    p.onCheckpoint();
                  }}
                  onChange={(e) => p.onChange(ed.id, { text: e.target.value })}
                  className={`block resize-none overflow-hidden bg-transparent p-0 outline-none placeholder:text-black/35 ${isSel ? "ring-1 ring-accent ring-dashed" : "hover:ring-1 hover:ring-black/20"}`}
                  style={{
                    width: m.width * p.scale + 6,
                    height: m.height * p.scale,
                    fontFamily: CSS_FONT[ed.font],
                    fontSize: ed.size * p.scale,
                    fontWeight: ed.bold ? 700 : 400,
                    lineHeight: 1.2,
                    color: ed.color,
                  }}
                />
              </div>
            );
          }

          const boxStyle: React.CSSProperties = { ...style, width: ed.w * p.scale, height: ed.h * p.scale };
          return (
            <div
              key={ed.id}
              className={`absolute ${placesItem ? "" : "cursor-move"} ${isSel ? "outline-2 outline-offset-1 outline-accent" : ""}`}
              style={boxStyle}
              onPointerDown={(e) => {
                if (!placesItem) startDrag(e, ed, "move");
              }}
              onPointerMove={dragMove}
              onPointerUp={endDrag}
            >
              {ed.type === "box" && (
                <div
                  className="size-full"
                  style={
                    ed.style === "whiteout"
                      ? { background: ed.color, boxShadow: isSel ? undefined : "0 0 0 1px rgba(0,0,0,0.08)" }
                      : ed.style === "highlight"
                        ? { background: ed.color, opacity: 0.4 }
                        : { border: `${1.5 * p.scale}px solid ${ed.color}` }
                  }
                />
              )}
              {ed.type === "image" && ed.url && (
                // eslint-disable-next-line @next/next/no-img-element -- a local preview of the visitor's own image
                <img src={ed.url} alt="" draggable={false} className="pointer-events-none size-full select-none" />
              )}
              {isSel && (
                <span
                  role="button"
                  aria-label="Resize"
                  tabIndex={-1}
                  onPointerDown={(e) => startDrag(e, ed, "resize")}
                  className="absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize rounded-sm border border-white bg-accent"
                />
              )}
            </div>
          );
        })}

        {draft && (
          <div
            className="pointer-events-none absolute border border-dashed border-accent bg-accent-soft"
            style={{
              left: Math.min(draft.x0, draft.x1) * p.scale,
              top: Math.min(draft.y0, draft.y1) * p.scale,
              width: Math.abs(draft.x1 - draft.x0) * p.scale,
              height: Math.abs(draft.y1 - draft.y0) * p.scale,
            }}
          />
        )}
      </div>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
