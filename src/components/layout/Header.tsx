"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { LayoutGrid, Moon, Sun } from "lucide-react";
import { Logo } from "./Logo";
import { ToolList } from "./ToolList";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog, afterSheetsClose } from "@/components/ui/Dialog";
import { CoffeeLink } from "./CoffeeLink";
import { FeedbackLink } from "@/features/feedback/FeedbackLink";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const isDark = () => document.documentElement.classList.contains("dark");
const THEME_COLOUR = { light: "#f6f7f9", dark: "#0d1117" };

function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    // The browser's own bar follows the visitor's choice, not only the device setting.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-manual]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.dataset.manual = "";
      document.head.append(meta);
    }
    meta.content = next ? THEME_COLOUR.dark : THEME_COLOUR.light;
    listeners.forEach((fn) => fn());
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage blocked: the choice lasts this visit
    }
  };
  return (
    <IconButton label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </IconButton>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-semibold tracking-tight">
          <Logo className="size-7" /> DocuMorph
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => setOpen(true)} aria-haspopup="dialog">
            <LayoutGrid className="size-5" aria-hidden /> Tools
          </Button>
          <ThemeToggle />
        </nav>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="All tools" side>
        <ToolList
          current={path.slice(1)}
          onNavigate={(href) => {
            setOpen(false);
            afterSheetsClose(() => router.push(href));
          }}
        />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-5 border-t border-line pt-3 text-muted">
          <FeedbackLink className="inline-flex min-h-11 items-center underline-offset-4 hover:text-fg hover:underline" />
          <CoffeeLink />
        </div>
      </Dialog>
    </header>
  );
}
