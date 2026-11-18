"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useKeyboardOpen } from "@/components/ui/useKeyboardOpen";

/**
 * The main action of a tool. On phones it is a bar fixed to the bottom edge, within thumb reach,
 * padded for the home indicator and hidden while the keyboard is open; from 768 px it sits in the page.
 * Buttons go right-to-left in importance: secondary on the left, primary on the right.
 * A spacer as tall as the bar keeps the end of the page, and the footer, clear of it.
 */
export function ActionBar({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  const keyboard = useKeyboardOpen();
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(112);

  useEffect(() => {
    if (!bar) return;
    const ro = new ResizeObserver(
      ([e]) => e && setHeight(Math.ceil(e.borderBoxSize[0]?.blockSize ?? e.contentRect.height)),
    );
    ro.observe(bar);
    return () => ro.disconnect();
  }, [bar]);

  return (
    <>
      <div className="md:hidden" style={{ height: keyboard ? 0 : height + 16 }} aria-hidden />
      <div
        ref={setBar}
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
