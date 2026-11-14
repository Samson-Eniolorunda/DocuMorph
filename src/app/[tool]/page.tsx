import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/ToolShell";
import { SERVER_TOOLS, serverToolBySlug } from "@/lib/server-tools";
import { ServerConvert } from "@/tools/ServerConvert";

// The server conversions: /word-to-pdf, /pdf-to-word, /excel-to-pdf, /pdf-to-excel, /compress-pdf.
export const dynamicParams = false;

export function generateStaticParams() {
  return SERVER_TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const t = serverToolBySlug((await params).tool);
  return t ? { title: t.name, description: t.summary, alternates: { canonical: `/${t.slug}` } } : {};
}

export default async function Page({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!serverToolBySlug(tool)) notFound();
  return (
    <ToolShell slug={tool}>
      <ServerConvert slug={tool} />
    </ToolShell>
  );
}
