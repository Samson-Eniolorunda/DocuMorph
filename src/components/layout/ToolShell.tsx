import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cloud, ShieldCheck } from "lucide-react";
import { toolBySlug } from "@/config/tools";
import { cn } from "@/lib/cn";

/** Frame for every tool page: title, summary and where the file is processed. */
export function ToolShell({
  slug,
  wide = false,
  children,
}: {
  slug: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  return (
    <div className={cn("mx-auto px-4 pb-8 pt-4 sm:px-6", wide ? "max-w-7xl" : "max-w-4xl")}>
      <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-muted hover:text-fg">
        <ArrowLeft className="size-5" aria-hidden /> All tools
      </Link>
      <header className="mt-2">
        <h1 className="text-display font-semibold tracking-[-0.01em] md:text-display-lg">{tool.name}</h1>
        <p className="mt-1 max-w-[68ch] text-muted">{tool.summary}</p>
        <WhereLine where={tool.where} />
      </header>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** States, before a file is chosen, where it will be processed. */
export function WhereLine({ where }: { where: "device" | "server" }) {
  return where === "device" ? (
    <p className="mt-3 flex items-start gap-2 text-accent">
      <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden /> Runs on your device. Your file is not uploaded.
    </p>
  ) : (
    <p className="mt-3 flex items-start gap-2 text-muted">
      <Cloud className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>
        Sent to ConvertAPI to be converted, up to 4 MB. DocuMorph does not keep it.{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-4">
          What happens to my file?
        </Link>
      </span>
    </p>
  );
}
