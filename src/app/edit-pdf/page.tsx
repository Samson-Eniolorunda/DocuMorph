import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { toolBySlug } from "@/lib/tools";
import { PdfEditor } from "@/tools/editor/PdfEditor";

const tool = toolBySlug("edit-pdf");

export const metadata: Metadata = { title: tool.name, description: `${tool.summary} Free, in your browser: your files are not uploaded.`, alternates: { canonical: "/edit-pdf" } };

export default function Page() {
  return (
    <ToolShell slug="edit-pdf" wide>
      <PdfEditor />
    </ToolShell>
  );
}
