import Link from "next/link";
import { SITE } from "@/lib/tools";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Most tools run entirely in your browser: your files are not uploaded.</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <a href={SITE.repo} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
            Source code
          </a>
          <a href={SITE.author.url} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
            Built by {SITE.author.name}
          </a>
        </p>
      </div>
    </footer>
  );
}
