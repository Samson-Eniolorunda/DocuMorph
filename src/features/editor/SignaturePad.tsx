"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, X } from "lucide-react";
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

export function SignaturePad({ onDone, onClose }: { onDone: (img: PlacedImage) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("draw");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const pad = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  useEffect(() => {
    const c = pad.current;
    if (!c || tab !== "draw") return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = context2d(c);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
  }, [tab]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  async function applyDrawn() {
    const canvas = pad.current;
    const img = canvas ? await trimmedPng(canvas) : null;
    if (!img) return setError("Draw your signature first.");
    onDone(img);
  }

  async function applyTyped() {
    if (!name.trim()) return setError("Type your name first.");
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 300;
    const ctx = context2d(c);
    ctx.fillStyle = INK;
    ctx.font = "italic 110px 'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive";
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
    <dialog
      ref={dialog}
      onCancel={onClose}
      className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-line bg-surface p-0 text-fg backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-semibold">Add your signature</h2>
        <button type="button" aria-label="Close" className="btn btn-quiet size-8 p-0" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
      <div className="p-5">
        <div role="tablist" className="flex gap-1 rounded-lg bg-raised p-1 text-sm">
          {(["draw", "type", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`flex-1 rounded-md px-3 py-1.5 capitalize ${tab === t ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "draw" && (
          <div className="mt-4">
            <canvas
              ref={pad}
              className="h-44 w-full touch-none rounded-xl border border-dashed border-line bg-white"
              onPointerDown={(e) => {
                drawing.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                const ctx = context2d(e.currentTarget);
                const [x, y] = point(e);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + 0.1, y + 0.1);
                ctx.stroke();
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                const ctx = context2d(e.currentTarget);
                const [x, y] = point(e);
                ctx.lineTo(x, y);
                ctx.stroke();
              }}
              onPointerUp={() => (drawing.current = false)}
            />
            <div className="mt-3 flex justify-between">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  const c = pad.current;
                  if (c) context2d(c).clearRect(0, 0, c.width, c.height);
                }}
              >
                <Eraser className="size-4" /> Clear
              </button>
              <button type="button" className="btn btn-primary" onClick={applyDrawn}>
                Use signature
              </button>
            </div>
          </div>
        )}

        {tab === "type" && (
          <div className="mt-4 space-y-3">
            <input
              className="field"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p
              className="min-h-16 rounded-xl border border-dashed border-line bg-white px-4 py-3 text-4xl italic"
              style={{ color: INK, fontFamily: "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive" }}
            >
              {name || " "}
            </p>
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" onClick={applyTyped}>
                Use signature
              </button>
            </div>
          </div>
        )}

        {tab === "upload" && (
          <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted hover:border-subtle">
            Choose a photo or scan of your signature (PNG, JPG or WebP). A PNG with a transparent background looks best.
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => void applyUploaded(e.target.files?.[0])}
            />
          </label>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
