import { ImageResponse } from "next/og";
import { SITE, TOOLS } from "@/lib/tools";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const onDevice = TOOLS.filter((t) => t.where === "device").length;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f6f7f9", color: "#111827", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 700 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#0f766e", display: "flex" }} />
          DocuMorph
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Edit and convert documents</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, color: "#0f766e" }}>without giving them away.</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#4b5563" }}>
          {onDevice} of {TOOLS.length} tools run entirely in your browser. Your files stay on your device.
        </div>
      </div>
    ),
    size,
  );
}
