import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { toolBySlug } from "@/lib/tools";
import { OrganisePdf } from "@/tools/OrganisePdf";

const tool = toolBySlug("organise-pdf");

export const metadata: Metadata = { title: tool.name, description: `${tool.summary} Free, in your browser: your files are not uploaded.`, alternates: { canonical: "/organise-pdf" } };

export default function Page() {
  return (
    <ToolShell slug="organise-pdf" wide>
      <OrganisePdf />
    </ToolShell>
  );
}
