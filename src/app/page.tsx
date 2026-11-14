import Link from "next/link";
import {
  ArrowRight,
  Combine,
  FileArchive,
  FileImage,
  FileOutput,
  FileSpreadsheet,
  FileText,
  Images,
  LayoutGrid,
  PenLine,
  Repeat,
  Scaling,
  Scissors,
  ShieldCheck,
  Shrink,
  type LucideIcon,
} from "lucide-react";
import { GROUPS, TOOLS } from "@/lib/tools";
import { WhereBadge } from "@/components/ToolShell";

const ICONS: Record<string, LucideIcon> = {
  "edit-pdf": PenLine,
  "merge-pdf": Combine,
  "split-pdf": Scissors,
  "organise-pdf": LayoutGrid,
  "images-to-pdf": Images,
  "pdf-to-images": FileImage,
  "convert-image": Repeat,
  "resize-image": Scaling,
  "compress-image": Shrink,
  "word-to-pdf": FileText,
  "pdf-to-word": FileOutput,
  "excel-to-pdf": FileSpreadsheet,
  "pdf-to-excel": FileSpreadsheet,
  "compress-pdf": FileArchive,
};

export default function Home() {
  const deviceCount = TOOLS.filter((t) => t.where === "device").length;
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          <ShieldCheck className="size-3.5" /> {deviceCount} of {TOOLS.length} tools never upload your files
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Edit and convert documents <span className="text-accent">without giving them away.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Edit, sign, merge, split and organise PDFs, and convert, resize and compress images. The work happens in your
          browser, so contracts, IDs and payslips stay on your device.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/edit-pdf" className="btn btn-primary px-5 py-3">
            Edit a PDF <ArrowRight className="size-4" />
          </Link>
          <Link href="#tools" className="btn btn-quiet px-5 py-3">
            See all tools
          </Link>
        </div>
      </section>

      <section id="tools" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6">
        {GROUPS.map((group) => (
          <div key={group} className="mt-10 first:mt-0">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-subtle">{group}</h2>
            {group === "Office and compression" && (
              <p className="mt-1 text-sm text-muted">These need a conversion server. Files up to 4 MB are sent to ConvertAPI and are not stored by DocuMorph.</p>
            )}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.filter((t) => t.group === group).map((t) => {
                const Icon = ICONS[t.slug] ?? FileText;
                return (
                  <li key={t.slug}>
                    <Link href={`/${t.slug}`} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent">
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                          <Icon className="size-5" />
                        </span>
                        {t.where === "server" && <WhereBadge where="server" />}
                      </span>
                      <span className="mt-4 font-medium">{t.name}</span>
                      <span className="mt-1 text-sm text-muted">{t.summary}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
