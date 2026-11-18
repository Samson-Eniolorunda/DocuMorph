"use client";

import { cn } from "@/lib/cn";
import { useKeyboardOpen } from "@/components/ui/useKeyboardOpen";

/**
 * The main action of a tool. On phones it is a bar fixed to the bottom edge, within thumb reach,
 * padded for the home indicator and hidden while the keyboard is open; from 768 px it sits in the page.
 * Buttons go right-to-left in importance: secondary on the left, primary on the right.
 */
export function ActionBar({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  const keyboard = useKeyboardOpen();
  return (
    <>
      <div className="h-28 md:hidden" aria-hidden />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]",
          "md:static md:z-auto md:mt-6 md:border-0 md:bg-transparent md:p-0",
          keyboard && "max-md:hidden",
        )}
      >
        {status && <div className="mx-auto mb-2 max-w-4xl text-body-sm text-muted">{status}</div>}
        <div className="mx-auto flex max-w-4xl justify-end gap-3 [&>*]:max-md:flex-1">{children}</div>
      </div>
    </>
  );
}
