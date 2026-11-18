import { SITE } from "@/config/site";
import { TOOLS } from "@/config/tools";
import { SHARE_SIZE, shareImage } from "@/lib/share-image";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default function Image() {
  const onDevice = TOOLS.filter((t) => t.where === "device").length;
  return shareImage({
    heading: "Edit and convert documents",
    accent: "without giving them away.",
    detail: `${onDevice} of ${TOOLS.length} tools run entirely in your browser. Your files stay on your device.`,
  });
}
