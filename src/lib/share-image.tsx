import { ImageResponse } from "next/og";

export const SHARE_SIZE = { width: 1200, height: 630 };

/** The 1200 × 630 picture shown when a link is shared: the logo mark, a headline in two lines, and one line of detail. */
export function shareImage({
  heading,
  accent,
  detail,
  label,
}: {
  heading: string;
  accent?: string;
  detail: string;
  label?: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f6f7f9",
        color: "#111827",
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 700 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#0f766e", display: "flex" }} />
          DocuMorph
        </div>
        {label && (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#0f766e",
              border: "2px solid #0f766e",
              borderRadius: 999,
              padding: "6px 22px",
            }}
          >
            {label}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{heading}</div>
        {accent && (
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, color: "#0f766e" }}>
            {accent}
          </div>
        )}
      </div>
      <div style={{ display: "flex", fontSize: 30, color: "#4b5563" }}>{detail}</div>
    </div>,
    SHARE_SIZE,
  );
}
