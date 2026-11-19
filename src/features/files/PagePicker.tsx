"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { PageThumb } from "./PageThumb";

/** Page thumbnails that can be tapped to choose pages; each tap changes the matching range field. */
export function PagePicker({
  doc,
  selected,
  onToggle,
  label = "Tap pages to choose them",
}: {
  doc: PDFDocumentProxy;
  selected: Set<number>;
  onToggle: (index: number) => void;
  label?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-body font-medium">{label}</legend>
      <ol className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto overscroll-contain rounded-lg border border-line bg-raised p-2 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: doc.numPages }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              aria-pressed={selected.has(i)}
              aria-label={`Page ${i + 1}`}
              onClick={() => onToggle(i)}
              className={cn(
                "transition-quick relative flex w-full flex-col items-center gap-1 rounded-md border-2 bg-surface p-1.5",
                selected.has(i) ? "border-accent bg-accent-tint" : "border-line",
              )}
            >
              <PageThumb doc={doc} index={i} width={84} />
              <span className="tabular-nums text-caption text-subtle">{i + 1}</span>
              {selected.has(i) && (
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg">
                  <Check className="size-3.5" aria-hidden />
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
