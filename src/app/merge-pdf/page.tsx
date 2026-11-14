import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { toolBySlug } from "@/lib/tools";
import { MergePdf } from "@/tools/MergePdf";

const tool = toolBySlug("merge-pdf");

export const metadata: Metadata = { title: tool.name, description: `${tool.summary} Free, in your browser: your files are not uploaded.`, alternates: { canonical: "/merge-pdf" } };

export default function Page() {
  return (
    <ToolShell slug="merge-pdf">
      <MergePdf />
    </ToolShell>
  );
}
