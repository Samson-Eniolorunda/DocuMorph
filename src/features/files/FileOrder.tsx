"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/files";

/** Reorders a list: press and drag the handle with a finger or mouse, or use Move up and Move down. */
export function FileOrder<T extends { id: string; file: File }>({
  items,
  onChange,
}: {
  items: T[];
  onChange: (items: T[]) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  // Pointer events can arrive faster than React renders, so the row being dragged is also kept here.
  const dragAt = useRef<number | null>(null);
  const drag = (i: number | null) => {
    dragAt.current = i;
    setDragging(i);
  };
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    if (x === undefined) return;
    next.splice(to, 0, x);
    onChange(next);
  };

  const overRow = (y: number) =>
    rows.current.findIndex((r) => r && y >= r.getBoundingClientRect().top && y <= r.getBoundingClientRect().bottom);

  return (
    <ol
      className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
      onPointerMove={(e) => {
        const from = dragAt.current;
        if (from === null) return;
        const target = overRow(e.clientY);
        if (target >= 0 && target !== from) {
          move(from, target);
          drag(target);
        }
      }}
      onPointerUp={() => drag(null)}
      onPointerCancel={() => drag(null)}
    >
      {items.map((it, i) => (
        <li
          key={it.id}
          ref={(el) => {
            rows.current[i] = el;
          }}
          className={cn(
            "flex flex-wrap items-center gap-x-1 gap-y-0 py-1 pl-1 pr-2",
            dragging === i && "bg-accent-tint",
          )}
        >
          <button
            type="button"
            aria-label={`Drag ${it.file.name} to a new position`}
            className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-subtle"
            onPointerDown={(e) => {
              // Captured on the list, which never moves: moving a captured element drops the capture.
              e.currentTarget.closest("ol")?.setPointerCapture(e.pointerId);
              drag(i);
            }}
          >
            <GripVertical className="size-5" aria-hidden />
          </button>
          <span className="w-6 shrink-0 text-right tabular-nums text-body-sm text-subtle">{i + 1}</span>
          <span className="min-w-0 flex-1 basis-40 px-2">
            <span className="block truncate">{it.file.name}</span>
            <span className="tabular-nums text-body-sm text-subtle">{formatBytes(it.file.size)}</span>
          </span>
          <span className="ml-auto flex">
            <IconButton label={`Move ${it.file.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
              <ArrowUp className="size-5" />
            </IconButton>
            <IconButton
              label={`Move ${it.file.name} down`}
              disabled={i === items.length - 1}
              onClick={() => move(i, i + 1)}
            >
              <ArrowDown className="size-5" />
            </IconButton>
            <IconButton label={`Remove ${it.file.name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X className="size-5" />
            </IconButton>
          </span>
        </li>
      ))}
    </ol>
  );
}

let counter = 0;
export const newId = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`;
