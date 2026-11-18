"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { cn } from "@/lib/cn";

/**
 * A modal dialog on the platform's own <dialog>: it traps focus, closes on Escape and
 * returns focus to where it was. On phones it is a sheet that rises from the bottom,
 * padded for the home indicator; from 768 px it is a centred panel (or a side panel).
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** From 768 px, dock to the right edge instead of centring. */
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "sheet fixed m-0 max-h-[85dvh] w-full max-w-none overflow-hidden bg-surface p-0 text-fg shadow-md backdrop:bg-black/50",
        "inset-x-0 bottom-0 top-auto rounded-t-lg border border-b-0 border-line",
        side
          ? "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-96 md:rounded-none md:border-b md:border-r-0"
          : "md:inset-auto md:left-1/2 md:top-1/2 md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border-b",
      )}
    >
      <div className="flex max-h-[85dvh] flex-col md:max-h-[inherit]">
        <div className="flex items-center justify-between gap-2 border-b border-line py-2 pl-4 pr-2">
          <h2 className="text-title font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </dialog>
  );
}
