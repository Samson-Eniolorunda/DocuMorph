import Link from "next/link";
import { ChevronRight, Coffee } from "lucide-react";
import { SITE } from "@/config/site";
import { CoffeeLink } from "./CoffeeLink";
import { FeedbackLink } from "@/features/feedback/FeedbackLink";

const LINK = "inline-flex min-h-11 items-center hover:text-fg underline-offset-4 hover:underline";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-body-sm text-muted sm:px-6">
        <p className="max-w-[68ch]">Most tools work entirely on your device, so those files are never uploaded.</p>
        {/* Phones (owner 2026-11-19): support is one full-width row, styled like the tool rows, instead of a
            button left alone on a line. From 640 px it is the small outlined button at the end of the links. */}
        {SITE.coffeeUrl && (
          <a
            href={SITE.coffeeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-fg transition-colors hover:border-accent sm:hidden"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
              <Coffee className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Buy me a coffee</span>
              <span className="block text-muted">DocuMorph is free, with no adverts.</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
          </a>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5">
            <Link href="/privacy" className={LINK}>
              Privacy
            </Link>
            <Link href="/terms" className={LINK}>
              Terms
            </Link>
            <FeedbackLink className={LINK} />
          </nav>
          <span className="ml-auto hidden sm:block">
            <CoffeeLink className="rounded-full border border-line px-4 text-fg transition-colors hover:border-accent hover:no-underline" />
          </span>
        </div>
        <p className="mt-1 flex min-h-11 items-center">
          <span>
            © {new Date().getFullYear()}{" "}
            {SITE.portfolioUrl ? (
              <a
                href={SITE.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-fg"
              >
                {SITE.owner}
              </a>
            ) : (
              SITE.owner
            )}
            . All rights reserved.
          </span>
        </p>
      </div>
    </footer>
  );
}
