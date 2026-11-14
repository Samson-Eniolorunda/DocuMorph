import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { toolBySlug } from "@/lib/tools";
import { PdfToImages } from "@/tools/PdfToImages";

const tool = toolBySlug("pdf-to-images");

export const metadata: Metadata = { title: tool.name, description: `${tool.summary} Free, in your browser: your files are not uploaded.`, alternates: { canonical: "/pdf-to-images" } };

export default function Page() {
  return (
    <ToolShell slug="pdf-to-images">
      <PdfToImages />
    </ToolShell>
  );
}
