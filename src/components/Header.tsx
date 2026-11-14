"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Logo } from "./Logo";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const isDark = () => document.documentElement.classList.contains("dark");

function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = () => {
    document.documentElement.classList.toggle("dark", !dark);
    listeners.forEach((fn) => fn());
    try {
      localStorage.setItem("theme", dark ? "light" : "dark");
    } catch {
      // storage blocked: the choice lasts this visit
    }
  };
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} className="btn btn-quiet size-9 p-0">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo className="size-7" /> DocuMorph
        </Link>
        <nav aria-label="Main" className="flex items-center gap-2">
          <Link href="/#tools" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-fg sm:block">
            All tools
          </Link>
          <Link href="/privacy" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-fg sm:block">
            Privacy
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
