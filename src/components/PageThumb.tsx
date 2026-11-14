"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPage } from "@/lib/pdf/render";

/** A page preview drawn only when it scrolls into view, so long documents stay fast. */
export function PageThumb({ doc, index, width = 140, rotate = 0 }: { doc: PDFDocumentProxy; index: number; width?: number; rotate?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || drawn) return;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || !canvas.current) return;
        io.disconnect();
        const r = await renderPage(doc, index, width, canvas.current);
        setRatio(r.height / r.width);
        setDrawn(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [doc, index, width, drawn]);

  const turned = rotate % 180 !== 0;
  return (
    <div ref={box} className="flex items-center justify-center" style={{ width, height: turned ? width / ratio : width * ratio }}>
      <canvas
        ref={canvas}
        aria-label={`Page ${index + 1}`}
        className={`border border-line bg-white shadow-sm transition-transform ${drawn ? "" : "animate-pulse bg-raised"}`}
        style={{ transform: `rotate(${rotate}deg) scale(${turned ? 1 / ratio : 1})`, width, height: width * ratio }}
      />
    </div>
  );
}
