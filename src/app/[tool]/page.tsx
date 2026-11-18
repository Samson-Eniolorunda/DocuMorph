import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/layout/ToolShell";
import { ToolView } from "@/components/layout/ToolView";
import { TOOLS, toolBySlug } from "@/config/tools";

// Every tool lives at /<slug>, generated from the one registry.
export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const t = toolBySlug((await params).tool);
  if (!t) return {};
  const note = t.where === "device" ? " Free, in your browser: your files are not uploaded." : "";
  return { title: t.name, description: `${t.summary}${note}`, alternates: { canonical: `/${t.slug}` } };
}

export default async function Page({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!toolBySlug(tool)) notFound();
  return (
    <ToolShell slug={tool} wide={tool === "edit-pdf"}>
      <ToolView slug={tool} />
    </ToolShell>
  );
}
