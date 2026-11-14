import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { toolBySlug } from "@/lib/tools";
import { ImageTool } from "@/tools/ImageTool";

const tool = toolBySlug("convert-image");

export const metadata: Metadata = { title: tool.name, description: `${tool.summary} Free, in your browser: your files are not uploaded.`, alternates: { canonical: "/convert-image" } };

export default function Page() {
  return (
    <ToolShell slug="convert-image">
      <ImageTool mode="convert" />
    </ToolShell>
  );
}
