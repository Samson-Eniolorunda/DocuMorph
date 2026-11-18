import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cloud, ShieldCheck } from "lucide-react";
import { toolBySlug } from "@/config/tools";

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
    <div className={`mx-auto px-4 pb-20 pt-6 sm:px-6 ${wide ? "max-w-7xl" : "max-w-4xl"}`}>
      <Link href="/#tools" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All tools
      </Link>
      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{tool.name}</h1>
          <p className="mt-1 text-muted">{tool.summary}</p>
        </div>
        <WhereBadge where={tool.where} />
      </header>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function WhereBadge({ where }: { where: "device" | "server" }) {
  return where === "device" ? (
    <p className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
      <ShieldCheck className="size-3.5" /> Runs on your device
    </p>
  ) : (
    <p className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
      <Cloud className="size-3.5" /> Processed on a server
    </p>
  );
}
