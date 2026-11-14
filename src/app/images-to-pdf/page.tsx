import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { toolBySlug } from "@/lib/tools";
import { ImagesToPdf } from "@/tools/ImagesToPdf";

const tool = toolBySlug("images-to-pdf");

export const metadata: Metadata = { title: tool.name, description: `${tool.summary} Free, in your browser: your files are not uploaded.`, alternates: { canonical: "/images-to-pdf" } };

export default function Page() {
  return (
    <ToolShell slug="images-to-pdf">
      <ImagesToPdf />
    </ToolShell>
  );
}
