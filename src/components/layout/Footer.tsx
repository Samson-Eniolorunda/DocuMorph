import Link from "next/link";
import { SITE } from "@/config/tools";

const LINK = "inline-flex min-h-11 items-center hover:text-fg underline-offset-4 hover:underline";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-body-sm text-muted sm:px-6">
        <p className="max-w-[68ch]">
          Nine of the fourteen tools work entirely on your device, so those files are never uploaded.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-5">
          <Link href="/privacy" className={LINK}>
            Privacy
          </Link>
          <a href={SITE.repo} target="_blank" rel="noopener noreferrer" className={LINK}>
            Source code
          </a>
          <a href={SITE.author.url} target="_blank" rel="noopener noreferrer" className={LINK}>
            Built by {SITE.author.name}
          </a>
        </p>
      </div>
    </footer>
  );
}
