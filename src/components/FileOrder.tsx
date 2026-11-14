"use client";

import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { useState } from "react";
import { formatBytes } from "@/lib/files";

/** A list people can reorder by dragging or with the arrow buttons (keyboard friendly). */
export function FileOrder<T extends { id: string; file: File }>({ items, onChange }: { items: T[]; onChange: (items: T[]) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  return (
    <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {items.map((it, i) => (
        <li
          key={it.id}
          draggable
          onDragStart={() => setDragging(i)}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragging !== null && dragging !== i) {
              move(dragging, i);
              setDragging(i);
            }
          }}
          onDragEnd={() => setDragging(null)}
          className={`flex items-center gap-3 px-3 py-2.5 ${dragging === i ? "opacity-50" : ""}`}
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-subtle" aria-hidden />
          <span className="w-6 shrink-0 text-right font-mono text-xs text-subtle">{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{it.file.name}</span>
            <span className="text-xs text-subtle">{formatBytes(it.file.size)}</span>
          </span>
          <span className="flex shrink-0 gap-1">
            <button type="button" aria-label={`Move ${it.file.name} up`} className="btn btn-quiet size-8 p-0" disabled={i === 0} onClick={() => move(i, i - 1)}>
              <ArrowUp className="size-4" />
            </button>
            <button type="button" aria-label={`Move ${it.file.name} down`} className="btn btn-quiet size-8 p-0" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
              <ArrowDown className="size-4" />
            </button>
            <button type="button" aria-label={`Remove ${it.file.name}`} className="btn btn-quiet size-8 p-0" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X className="size-4" />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

let counter = 0;
export const newId = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`;
