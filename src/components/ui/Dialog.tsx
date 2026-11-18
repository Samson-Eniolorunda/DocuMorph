"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { cn } from "@/lib/cn";

// Android's Back gesture and button close the topmost sheet instead of leaving the page. Each open sheet
// adds one history entry (keeping the router's own state in it) and removes it when it closes.
const stack: { id: number; close: () => void }[] = [];
let counter = 0;
let skipPops = 0;
let listening = false;
let afterClose: (() => void) | null = null;

/**
 * Runs `fn` once every open sheet has finished closing, so a page change never races a sheet's history entry.
 * Without an open sheet it runs at once.
 */
export function afterSheetsClose(fn: () => void) {
  if (stack.length === 0 && skipPops === 0) fn();
  else afterClose = fn;
}

function flushAfterClose() {
  if (skipPops === 0 && stack.length === 0 && afterClose) {
    const fn = afterClose;
    afterClose = null;
    fn();
  }
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", () => {
    if (skipPops > 0) {
      skipPops -= 1;
      flushAfterClose();
      return;
    }
    stack.pop()?.close();
    flushAfterClose();
  });
}

function useBackToClose(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    listen();
    const id = ++counter;
    const state: unknown = window.history.state;
    window.history.pushState({ ...(typeof state === "object" && state ? state : {}), dmSheet: id }, "");
    stack.push({ id, close: () => close.current() });
    return () => {
      const at = stack.findIndex((s) => s.id === id);
      if (at >= 0) stack.splice(at, 1);
      else return; // closed by Back: the entry is already gone
      const now: unknown = window.history.state;
      if (typeof now === "object" && now && (now as { dmSheet?: number }).dmSheet === id) {
        skipPops += 1;
        window.history.back();
        return;
      }
      flushAfterClose();
    };
  }, [open]);
}

/** Dragging the top of a sheet down closes it (phones). Anything under a threshold springs back. */
function useSwipeDown(ref: React.RefObject<HTMLDialogElement | null>, onClose: () => void) {
  return {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      const el = ref.current;
      if (!el || !window.matchMedia("(max-width: 767px)").matches || (e.target as HTMLElement).closest("button"))
        return;
      const startY = e.clientY;
      const startAt = e.timeStamp;
      let dy = 0;
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const move = (m: PointerEvent) => {
        dy = Math.max(0, m.clientY - startY);
        el.style.transition = "none";
        el.style.transform = `translateY(${dy}px)`;
      };
      const end = (u: PointerEvent) => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        el.style.transition = "";
        const fast = dy / Math.max(1, u.timeStamp - startAt) > 0.6;
        if (dy > 96 || (fast && dy > 24)) onClose();
        el.style.transform = "";
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    },
  };
}

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
  useBackToClose(open, onClose);
  const swipe = useSwipeDown(ref, onClose);

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
        <div {...swipe} className="flex touch-none flex-col border-b border-line md:touch-auto" data-sheet-handle>
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-control md:hidden" />
          <div className="flex items-center justify-between gap-2 py-1 pl-4 pr-2">
            <h2 className="text-title font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-5" />
            </IconButton>
          </div>
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
