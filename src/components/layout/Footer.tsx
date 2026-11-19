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
        <nav aria-label="Footer" className="mt-2 grid grid-cols-2 gap-x-5 sm:flex sm:flex-wrap sm:items-center">
          <Link href="/privacy" className={LINK}>
            Privacy
          </Link>
          <Link href="/terms" className={`${LINK} justify-self-end sm:justify-self-auto`}>
            Terms
          </Link>
          <FeedbackLink className={LINK} />
          <CoffeeLink className="justify-self-end sm:ml-auto sm:justify-self-auto" />
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
