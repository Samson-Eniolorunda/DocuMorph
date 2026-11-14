import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { toolBySlug } from "@/lib/tools";
import { ImageTool } from "@/tools/ImageTool";

const tool = toolBySlug("resize-image");

export const metadata: Metadata = { title: tool.name, description: `${tool.summary} Free, in your browser: your files are not uploaded.`, alternates: { canonical: "/resize-image" } };

export default function Page() {
  return (
    <ToolShell slug="resize-image">
      <ImageTool mode="resize" />
    </ToolShell>
  );
}
