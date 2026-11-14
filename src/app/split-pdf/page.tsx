import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { toolBySlug } from "@/lib/tools";
import { SplitPdf } from "@/tools/SplitPdf";

const tool = toolBySlug("split-pdf");

export const metadata: Metadata = { title: tool.name, description: `${tool.summary} Free, in your browser: your files are not uploaded.`, alternates: { canonical: "/split-pdf" } };

export default function Page() {
  return (
    <ToolShell slug="split-pdf">
      <SplitPdf />
    </ToolShell>
  );
}
