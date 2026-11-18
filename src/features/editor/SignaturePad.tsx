"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { context2d } from "@/lib/canvas";
import { readBytes } from "@/lib/download";
import { sniff } from "@/lib/files";

export interface PlacedImage {
  bytes: Uint8Array;
  kind: "png" | "jpg";
  width: number;
  height: number;
  url: string;
}

const INK = "#1d2b64";

/** Crops a canvas to its drawn pixels, with a small margin, and returns a PNG. */
async function trimmedPng(src: HTMLCanvasElement): Promise<PlacedImage | null> {
  const ctx = context2d(src);
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return null;
  const pad = 6;
  const w = Math.min(width, maxX - minX + 1 + pad * 2);
  const h = Math.min(height, maxY - minY + 1 + pad * 2);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  context2d(out).drawImage(src, Math.max(0, minX - pad), Math.max(0, minY - pad), w, h, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/png"));
  if (!blob) return null;
  return { bytes: await readBytes(blob), kind: "png", width: w, height: h, url: URL.createObjectURL(blob) };
}

/** Opens an image file chosen by the visitor (PNG or JPG; WebP is redrawn as PNG). */
export async function imageFromFile(file: File): Promise<PlacedImage> {
  const kind = await sniff(file);
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  if (kind === "png" || kind === "jpg") {
    bitmap.close();
    return { bytes: await readBytes(file), kind, ...size, url: URL.createObjectURL(file) };
  }
  const c = document.createElement("canvas");
  c.width = size.width;
  c.height = size.height;
  context2d(c).drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) throw new Error("This image could not be used.");
  return { bytes: await readBytes(blob), kind: "png", ...size, url: URL.createObjectURL(blob) };
}

type Tab = "draw" | "type" | "upload";
type Point = readonly [number, number];

const TABS: [Tab, string][] = [
  ["draw", "Draw"],
  ["type", "Type"],
  ["upload", "Upload"],
];

/**
 * A sheet for making a signature: drawn with a finger, typed in one bundled script face, or from a photo.
 * Strokes are kept as points and redrawn whenever the sheet changes size, so turning the phone never
 * moves a line away from where it was drawn, and a touch taken over by the system loses nothing.
 */
export function SignaturePad({ onDone, onClose }: { onDone: (img: PlacedImage) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("draw");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const pad = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const current = useRef<Point[] | null>(null);

  const redraw = useCallback(() => {
    const c = pad.current;
    if (!c) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * ratio) || c.height !== Math.round(h * ratio)) {
      c.width = Math.round(w * ratio);
      c.height = Math.round(h * ratio);
    }
    const ctx = context2d(c);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    for (const stroke of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      const [first, ...rest] = stroke;
      if (!first) continue;
      ctx.beginPath();
      ctx.moveTo(first[0], first[1]);
      if (rest.length === 0) ctx.lineTo(first[0] + 0.1, first[1] + 0.1);
      // Smooth the line through the midpoints of neighbouring points.
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        const b = rest[i + 1];
        if (!a) continue;
        if (b) ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        else ctx.lineTo(a[0], a[1]);
      }
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const c = pad.current;
    if (!c || tab !== "draw") return;
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [tab, redraw]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const finish = () => {
    if (current.current) strokes.current.push(current.current);
    current.current = null;
    redraw();
  };

  async function applyDrawn() {
    const canvas = pad.current;
    const img = canvas && strokes.current.length ? await trimmedPng(canvas) : null;
    if (!img) return setError("Draw your signature first.");
    onDone(img);
  }

  async function applyTyped() {
    if (!name.trim()) return setError("Type your name first.");
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-script").trim() || "cursive";
    await document.fonts.load(`110px ${family}`, name).catch(() => []);
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 300;
    const ctx = context2d(c);
    ctx.fillStyle = INK;
    ctx.font = `110px ${family}`;
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim(), 20, 150, 1160);
    const img = await trimmedPng(c);
    if (img) onDone(img);
  }

  async function applyUploaded(file?: File) {
    if (!file) return;
    try {
      onDone(await imageFromFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "This image could not be used.");
    }
  }

  return (
    <Dialog open onClose={onClose} title="Add your signature">
      <div role="tablist" aria-label="Signature type" className="flex gap-1 rounded-md bg-raised p-1">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            id={`sig-tab-${t}`}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls="sig-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => {
              setTab(t);
              setError("");
            }}
            onKeyDown={(e) => {
              const k = TABS.findIndex(([id]) => id === tab);
              const next = e.key === "ArrowRight" ? k + 1 : e.key === "ArrowLeft" ? k - 1 : null;
              const target = next === null ? undefined : TABS[(next + TABS.length) % TABS.length];
              if (target) {
                setTab(target[0]);
                document.getElementById(`sig-tab-${target[0]}`)?.focus();
              }
            }}
            className={cn(
              "transition-quick min-h-11 flex-1 rounded-sm font-medium",
              tab === t ? "bg-surface shadow-sm" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="sig-panel" role="tabpanel" aria-labelledby={`sig-tab-${tab}`} className="mt-4 space-y-4">
        {tab === "draw" && (
          <>
            <div className="relative">
              <canvas
                ref={pad}
                aria-label="Signature area. Draw with your finger or a mouse."
                className="h-56 w-full touch-none rounded-lg border border-dashed border-control bg-white"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  current.current = [point(e)];
                  setError("");
                  redraw();
                }}
                onPointerMove={(e) => {
                  if (!current.current) return;
                  current.current.push(point(e));
                  redraw();
                }}
                onPointerUp={finish}
                onPointerCancel={finish}
              />
              <span
                className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-neutral-300"
                aria-hidden
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  strokes.current = [];
                  current.current = null;
                  redraw();
                }}
              >
                <Eraser className="size-5" aria-hidden /> Clear
              </Button>
              <Button variant="primary" onClick={applyDrawn}>
                Use signature
              </Button>
            </div>
          </>
        )}
        {tab === "type" && (
          <>
            <Field
              label="Your name"
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="done"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p
              className="min-h-16 truncate rounded-lg border border-line bg-white px-3 py-2 text-5xl text-[#1d2b64]"
              style={{ fontFamily: "var(--font-script), cursive" }}
              aria-hidden
            >
              {name || "Your name"}
            </p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={applyTyped}>
                Use signature
              </Button>
            </div>
          </>
        )}
        {tab === "upload" && (
          <>
            <p className="text-muted">Choose a photo or scan of your signature on white paper.</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Signature image"
              className="block min-h-11 w-full"
              onChange={(e) => void applyUploaded(e.target.files?.[0])}
            />
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}
