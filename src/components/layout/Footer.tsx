import Link from "next/link";
import { SITE } from "@/config/site";
import { CoffeeLink } from "./CoffeeLink";
import { FeedbackLink } from "@/features/feedback/FeedbackLink";

const LINK = "inline-flex min-h-11 items-center hover:text-fg underline-offset-4 hover:underline";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-body-sm text-muted sm:px-6">
        <p className="max-w-[68ch]">Most tools work entirely on your device, so those files are never uploaded.</p>
        <nav aria-label="Footer" className="mt-2 flex flex-wrap gap-x-5">
          <Link href="/privacy" className={LINK}>
            Privacy
          </Link>
          <Link href="/terms" className={LINK}>
            Terms
          </Link>
          <FeedbackLink className={LINK} />
          <CoffeeLink />
        </nav>
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
