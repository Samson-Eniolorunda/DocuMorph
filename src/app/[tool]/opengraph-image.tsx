import { toolBySlug } from "@/config/tools";
import { SHARE_SIZE, shareImage } from "@/lib/share-image";

export const size = SHARE_SIZE;
export const contentType = "image/png";
export const alt = "DocuMorph tool";

export default async function Image({ params }: { params: Promise<{ tool: string }> }) {
  const tool = toolBySlug((await params).tool);
  if (!tool) return shareImage({ heading: "DocuMorph", detail: "Private PDF and image tools." });
  return shareImage({
    heading: tool.name,
    detail: tool.summary,
    label: tool.where === "device" ? "Runs on your device" : "Server, up to 4 MB",
  });
}
